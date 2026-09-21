import fs from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { app } from "electron";
import {
  getPrimaryRecordPhotoPath,
  mapRecordPhotoPaths,
  parseRecordPhotos,
  serializeRecordPhotos,
} from "../models/record.js";
import { APP_USER_FOLDER } from "../appSettings.js";
import {
  buildPhotoPreviewUrl,
  buildRecordPhotoDirectory,
  buildSiblingPhotoArchivePath,
  buildStagedPhotoDirectory,
  createTimestampPhotoFileName,
  isManagedPhotoPath,
  isSafePhotoRelativePath,
  isStagedPhotoPath,
  normalizePhotoRelativePath,
  replacePhotoRecordId,
  toPlatformPath,
  PHOTO_ARCHIVE_SUFFIX,
  PHOTO_ROOT_FOLDER,
  PHOTO_STAGING_FOLDER,
} from "./photoStorageShared.js";
import type {
  PhotoArchiveResult,
  PhotoAssetResult,
  PhotoImportIdMapEntry,
  PhotoSyncImportResult,
  SyncablePhotoFile,
} from "./photoTypes.js";

const createStagingToken = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const ensureDirectory = (directoryPath: string): void => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const safeUnlink = (targetPath: string): void => {
  try {
    fs.unlinkSync(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};

const safeRemoveDirectory = (directoryPath: string): void => {
  try {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};

const collectFilesRecursively = (directoryPath: string): string[] => {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursively(entryPath));
      continue;
    }
    files.push(entryPath);
  }
  return files;
};

const createContentHash = (buffer: Buffer): string =>
  createHash("sha256").update(buffer).digest("hex");

class PhotoStorageNodeService {
  private getUserRoot(): string {
    const rootPath = path.join(app.getPath("userData"), APP_USER_FOLDER);
    ensureDirectory(rootPath);
    return rootPath;
  }

  private getPhotosRoot(): string {
    const photosRoot = path.join(this.getUserRoot(), PHOTO_ROOT_FOLDER);
    ensureDirectory(photosRoot);
    return photosRoot;
  }

  private resolveAbsolutePath(relativePath: string): string {
    const normalized = normalizePhotoRelativePath(relativePath);
    return path.join(this.getUserRoot(), toPlatformPath(normalized));
  }

  private ensureParentDirectory(relativePath: string): string {
    const absolutePath = this.resolveAbsolutePath(relativePath);
    ensureDirectory(path.dirname(absolutePath));
    return absolutePath;
  }

  private createManagedPhotoResult(relativePath: string): PhotoAssetResult {
    return {
      photo: serializeRecordPhotos([{ path: relativePath }]),
      previewUrl: buildPhotoPreviewUrl(relativePath),
      path: relativePath,
    };
  }

  private cleanupEmptyParentDirectories(relativePath: string): void {
    let currentDirectory = path.dirname(this.resolveAbsolutePath(relativePath));
    const stopDirectory = this.getPhotosRoot();

    while (
      currentDirectory.startsWith(stopDirectory) &&
      currentDirectory !== stopDirectory
    ) {
      if (!fs.existsSync(currentDirectory)) {
        currentDirectory = path.dirname(currentDirectory);
        continue;
      }
      if (fs.readdirSync(currentDirectory).length > 0) {
        break;
      }
      fs.rmdirSync(currentDirectory);
      currentDirectory = path.dirname(currentDirectory);
    }
  }

  private getManagedRecordPaths(photoRaw: string, recordId?: number): string[] {
    return parseRecordPhotos(photoRaw)
      .map((entry) => normalizePhotoRelativePath(entry.path))
      .filter((relativePath) => {
        if (!isManagedPhotoPath(relativePath)) {
          return false;
        }
        if (typeof recordId !== "number") {
          return true;
        }
        return relativePath.startsWith(
          `${buildRecordPhotoDirectory(recordId)}/`,
        );
      });
  }

  private buildImportedPhotoRaw(
    photoRaw: string,
    idMapEntries: readonly PhotoImportIdMapEntry[],
  ): string {
    const mapping = new Map<number, number>();
    for (const entry of idMapEntries) {
      mapping.set(entry.sourceId, entry.targetId);
    }

    return mapRecordPhotoPaths(photoRaw, (photoPath) => {
      const normalized = normalizePhotoRelativePath(photoPath);
      const parts = normalized.split("/");
      if (parts.length < 3 || parts[0] !== PHOTO_ROOT_FOLDER) {
        return normalized;
      }

      const sourceId = Number(parts[1]);
      const targetId = mapping.get(sourceId);
      if (!targetId) {
        return null;
      }

      return replacePhotoRecordId(normalized, targetId);
    });
  }

  stagePhotoFromFile(
    sourcePath: string,
    sourceName?: string,
  ): PhotoAssetResult {
    const resolvedSourcePath = path.resolve(sourcePath);
    if (!fs.existsSync(resolvedSourcePath)) {
      throw new Error("Selected photo file does not exist.");
    }

    const token = createStagingToken();
    const targetName = createTimestampPhotoFileName(
      sourceName || path.basename(resolvedSourcePath),
      path.extname(resolvedSourcePath) || ".jpg",
    );
    const relativePath = `${buildStagedPhotoDirectory(token)}/${targetName}`;
    const absolutePath = this.ensureParentDirectory(relativePath);
    fs.copyFileSync(resolvedSourcePath, absolutePath);
    return this.createManagedPhotoResult(relativePath);
  }

  resolvePhotoUrl(photoRaw: string): string {
    const primaryPath = getPrimaryRecordPhotoPath(photoRaw);
    if (!primaryPath) {
      return "";
    }

    const absolutePath = this.resolveAbsolutePath(primaryPath);
    if (!fs.existsSync(absolutePath)) {
      return "";
    }
    return buildPhotoPreviewUrl(primaryPath);
  }

  copyManagedPhotoToDestination(
    relativePath: string,
    destinationPath: string,
  ): string {
    const normalizedPath = normalizePhotoRelativePath(relativePath);
    if (
      !normalizedPath ||
      !isManagedPhotoPath(normalizedPath) ||
      !isSafePhotoRelativePath(normalizedPath)
    ) {
      throw new Error("Invalid managed photo path.");
    }

    const sourcePath = this.resolveAbsolutePath(normalizedPath);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      throw new Error("The selected photo could not be found.");
    }

    const targetPath = path.resolve(destinationPath);
    fs.copyFileSync(sourcePath, targetPath);
    return targetPath;
  }

  finalizeRecordPhoto(
    recordId: number,
    photoRaw: string,
  ): PhotoAssetResult | null {
    const primaryPath = getPrimaryRecordPhotoPath(photoRaw);
    if (!primaryPath) {
      return null;
    }

    const normalizedPrimaryPath = normalizePhotoRelativePath(primaryPath);
    if (
      normalizedPrimaryPath.startsWith(
        `${buildRecordPhotoDirectory(recordId)}/`,
      ) &&
      fs.existsSync(this.resolveAbsolutePath(normalizedPrimaryPath))
    ) {
      return this.createManagedPhotoResult(normalizedPrimaryPath);
    }

    const sourceAbsolutePath = this.resolveAbsolutePath(normalizedPrimaryPath);
    if (!fs.existsSync(sourceAbsolutePath)) {
      throw new Error("The selected photo could not be prepared for saving.");
    }

    const targetName = createTimestampPhotoFileName(
      path.basename(normalizedPrimaryPath),
      path.extname(normalizedPrimaryPath) || ".jpg",
    );
    const targetRelativePath = `${buildRecordPhotoDirectory(recordId)}/${targetName}`;
    const targetAbsolutePath = this.ensureParentDirectory(targetRelativePath);
    fs.copyFileSync(sourceAbsolutePath, targetAbsolutePath);
    return this.createManagedPhotoResult(targetRelativePath);
  }

  commitSavedRecordPhoto(
    recordId: number,
    previousPhotoRaw: string,
    nextPhotoRaw: string,
  ): void {
    const previousPaths = new Set(
      this.getManagedRecordPaths(previousPhotoRaw, recordId),
    );
    const nextPaths = new Set(
      this.getManagedRecordPaths(nextPhotoRaw, recordId),
    );

    for (const stalePath of previousPaths) {
      if (nextPaths.has(stalePath)) {
        continue;
      }
      safeUnlink(this.resolveAbsolutePath(stalePath));
      this.cleanupEmptyParentDirectories(stalePath);
    }

    const stagedPaths = new Set<string>([
      ...this.getManagedRecordPaths(previousPhotoRaw),
      ...this.getManagedRecordPaths(nextPhotoRaw),
    ]);
    for (const stagedPath of stagedPaths) {
      if (!isStagedPhotoPath(stagedPath)) {
        continue;
      }
      safeUnlink(this.resolveAbsolutePath(stagedPath));
      this.cleanupEmptyParentDirectories(stagedPath);
    }

    if (!nextPhotoRaw.trim()) {
      this.deleteRecordPhotos(recordId);
    }
  }

  discardStagedPhotos(photoRaw: string): void {
    for (const relativePath of this.getManagedRecordPaths(photoRaw)) {
      if (!isStagedPhotoPath(relativePath)) {
        continue;
      }
      safeUnlink(this.resolveAbsolutePath(relativePath));
      this.cleanupEmptyParentDirectories(relativePath);
    }
  }

  deleteRecordPhotos(recordId: number): void {
    safeRemoveDirectory(
      this.resolveAbsolutePath(buildRecordPhotoDirectory(recordId)),
    );
  }

  clearAllPhotos(): void {
    safeRemoveDirectory(this.resolveAbsolutePath(PHOTO_ROOT_FOLDER));
  }

  rewriteImportedPhotoRaw(
    photoRaw: string,
    idMapEntries: readonly PhotoImportIdMapEntry[],
  ): string {
    return this.buildImportedPhotoRaw(photoRaw, idMapEntries);
  }

  getSiblingArchive(databasePath: string): PhotoArchiveResult {
    const archivePath = buildSiblingPhotoArchivePath(databasePath);
    return {
      path: archivePath,
      hasPhotos:
        fs.existsSync(archivePath) && fs.statSync(archivePath).size > 0,
      exists: fs.existsSync(archivePath),
    };
  }

  listSyncablePhotos(): SyncablePhotoFile[] {
    const photosRoot = this.getPhotosRoot();
    const files = collectFilesRecursively(photosRoot)
      .map((filePath) => {
        const relativeToRoot = path
          .relative(photosRoot, filePath)
          .split(path.sep)
          .join("/");
        return `${PHOTO_ROOT_FOLDER}/${relativeToRoot}`;
      })
      .filter(
        (relativePath) =>
          isSafePhotoRelativePath(relativePath) &&
          !relativePath.startsWith(
            `${PHOTO_ROOT_FOLDER}/${PHOTO_STAGING_FOLDER}/`,
          ),
      );

    return files.map((relativePath) => {
      const absolutePath = this.resolveAbsolutePath(relativePath);
      const fileBuffer = fs.readFileSync(absolutePath);
      const stats = fs.statSync(absolutePath);
      return {
        relativePath,
        contentHash: createContentHash(fileBuffer),
        byteSize: stats.size,
        sourcePath: absolutePath,
      };
    });
  }

  importSyncFile(
    sourcePath: string,
    relativePath: string,
  ): PhotoSyncImportResult {
    const normalizedPath = normalizePhotoRelativePath(relativePath);
    if (
      !normalizedPath ||
      !isManagedPhotoPath(normalizedPath) ||
      !isSafePhotoRelativePath(normalizedPath) ||
      isStagedPhotoPath(normalizedPath)
    ) {
      throw new Error("Invalid managed photo sync path.");
    }

    const resolvedSourcePath = path.resolve(sourcePath);
    if (!fs.existsSync(resolvedSourcePath)) {
      return {
        relativePath: normalizedPath,
        exists: false,
      };
    }

    const targetAbsolutePath = this.ensureParentDirectory(normalizedPath);
    fs.copyFileSync(resolvedSourcePath, targetAbsolutePath);
    return {
      relativePath: normalizedPath,
      exists: true,
    };
  }

  deleteManagedPath(relativePath: string): void {
    const normalizedPath = normalizePhotoRelativePath(relativePath);
    if (
      !normalizedPath ||
      !isManagedPhotoPath(normalizedPath) ||
      !isSafePhotoRelativePath(normalizedPath) ||
      isStagedPhotoPath(normalizedPath)
    ) {
      return;
    }

    safeUnlink(this.resolveAbsolutePath(normalizedPath));
    this.cleanupEmptyParentDirectories(normalizedPath);
  }

  async createArchive(archivePath: string): Promise<PhotoArchiveResult> {
    const zip = new JSZip();
    const photosRoot = this.getPhotosRoot();
    const files = collectFilesRecursively(photosRoot).filter((filePath) => {
      const relativeToRoot = path
        .relative(photosRoot, filePath)
        .split(path.sep)
        .join("/");
      return !relativeToRoot.startsWith(`${PHOTO_STAGING_FOLDER}/`);
    });

    for (const filePath of files) {
      const relativeToRoot = path
        .relative(photosRoot, filePath)
        .split(path.sep)
        .join("/");
      zip.file(
        `${PHOTO_ROOT_FOLDER}/${relativeToRoot}`,
        fs.readFileSync(filePath),
      );
    }

    const archiveData = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    ensureDirectory(path.dirname(archivePath));
    fs.writeFileSync(archivePath, archiveData);
    return {
      path: archivePath,
      hasPhotos: files.length > 0,
      exists: true,
    };
  }

  async createSiblingArchive(
    databasePath: string,
  ): Promise<PhotoArchiveResult> {
    return this.createArchive(buildSiblingPhotoArchivePath(databasePath));
  }

  async createTemporaryArchive(prefix: string): Promise<PhotoArchiveResult> {
    const tempPath = path.join(
      os.tmpdir(),
      `${prefix}-${Date.now()}${PHOTO_ARCHIVE_SUFFIX}`,
    );
    return this.createArchive(tempPath);
  }

  async restoreArchive(
    archivePath: string,
    mode: "append" | "replace" | "merge",
    idMapEntries: readonly PhotoImportIdMapEntry[] = [],
  ): Promise<PhotoArchiveResult> {
    if (!fs.existsSync(archivePath)) {
      return {
        path: archivePath,
        hasPhotos: false,
        exists: false,
      };
    }

    const zip = await JSZip.loadAsync(fs.readFileSync(archivePath));
    const photosRoot = this.getPhotosRoot();
    const fileEntries = Object.values(zip.files).filter((entry) => !entry.dir);

    if (mode === "replace") {
      safeRemoveDirectory(photosRoot);
      ensureDirectory(photosRoot);
    }

    for (const entry of fileEntries) {
      const normalizedName = normalizePhotoRelativePath(entry.name);
      if (!normalizedName.startsWith(`${PHOTO_ROOT_FOLDER}/`)) {
        continue;
      }
      if (!isSafePhotoRelativePath(normalizedName)) {
        continue;
      }
      if (
        normalizedName.startsWith(
          `${PHOTO_ROOT_FOLDER}/${PHOTO_STAGING_FOLDER}/`,
        )
      ) {
        continue;
      }

      let targetRelativePath = normalizedName;
      if (mode === "append") {
        targetRelativePath = this.buildImportedPhotoRaw(
          serializeRecordPhotos([{ path: normalizedName }]),
          idMapEntries,
        );
        targetRelativePath = getPrimaryRecordPhotoPath(targetRelativePath);
        if (!targetRelativePath) {
          continue;
        }
      }
      if (!isSafePhotoRelativePath(targetRelativePath)) {
        continue;
      }

      const targetAbsolutePath = this.ensureParentDirectory(targetRelativePath);
      const fileBuffer = await entry.async("nodebuffer");
      fs.writeFileSync(targetAbsolutePath, fileBuffer);
    }

    return {
      path: archivePath,
      hasPhotos: fileEntries.length > 0,
      exists: true,
    };
  }
}

export const photoStorage = new PhotoStorageNodeService();
