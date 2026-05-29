import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Directory, Filesystem } from "@capacitor/filesystem";
import JSZip from "jszip";
import {
  getPrimaryRecordPhotoPath,
  mapRecordPhotoPaths,
  parseRecordPhotos,
  serializeRecordPhotos,
} from "../models/record";
import {
  buildRecordPhotoDirectory,
  buildSiblingPhotoArchivePath,
  buildStagedPhotoDirectory,
  createTimestampPhotoFileName,
  isManagedPhotoPath,
  isStagedPhotoPath,
  normalizePhotoRelativePath,
  replacePhotoRecordId,
  PHOTO_ARCHIVE_SUFFIX,
  PHOTO_ROOT_FOLDER,
  PHOTO_STAGING_FOLDER,
} from "./photoStorageShared";
import type {
  PhotoArchiveResult,
  PhotoAssetResult,
  PhotoImportIdMapEntry,
  PhotoSelectionResult,
} from "./photoTypes";

const PHOTO_DIRECTORY = Directory.Data;

const createStagingToken = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const ensureDirectory = async (relativePath: string): Promise<void> => {
  if (!relativePath.trim()) {
    return;
  }

  try {
    await Filesystem.mkdir({
      path: relativePath,
      directory: PHOTO_DIRECTORY,
      recursive: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "");
    if (!/exist/i.test(message)) {
      throw error;
    }
  }
};

const pathExists = async (
  pathValue: string,
  directory?: Directory,
): Promise<boolean> => {
  try {
    await Filesystem.stat(
      directory ? { path: pathValue, directory } : { path: pathValue },
    );
    return true;
  } catch {
    return false;
  }
};

const getPhotoUri = async (relativePath: string): Promise<string> => {
  const result = await Filesystem.getUri({
    path: relativePath,
    directory: PHOTO_DIRECTORY,
  });
  return result.uri;
};

const getPrimaryPreviewUrl = async (photoRaw: string): Promise<string> => {
  const primaryPath = getPrimaryRecordPhotoPath(photoRaw);
  if (!primaryPath) {
    return "";
  }

  const exists = await pathExists(primaryPath, PHOTO_DIRECTORY);
  if (!exists) {
    return "";
  }

  const uri = await getPhotoUri(primaryPath);
  return Capacitor.convertFileSrc(uri);
};

const createPhotoAssetResult = async (
  relativePath: string,
): Promise<PhotoAssetResult> => ({
  photo: serializeRecordPhotos([{ path: relativePath }]),
  previewUrl: await getPrimaryPreviewUrl(
    serializeRecordPhotos([{ path: relativePath }]),
  ),
  path: relativePath,
});

const safeDeleteFile = async (relativePath: string): Promise<void> => {
  try {
    await Filesystem.deleteFile({
      path: relativePath,
      directory: PHOTO_DIRECTORY,
    });
  } catch {
    // Ignore missing files during cleanup.
  }
};

const safeRemoveDirectory = async (relativePath: string): Promise<void> => {
  try {
    await Filesystem.rmdir({
      path: relativePath,
      directory: PHOTO_DIRECTORY,
      recursive: true,
    });
  } catch {
    // Ignore missing folders during cleanup.
  }
};

const cleanupEmptyParentDirectories = async (
  relativePath: string,
): Promise<void> => {
  const segments = normalizePhotoRelativePath(relativePath).split("/");
  while (segments.length > 2) {
    segments.pop();
    const parentPath = segments.join("/");
    if (parentPath === PHOTO_ROOT_FOLDER) {
      break;
    }

    try {
      const result = await Filesystem.readdir({
        path: parentPath,
        directory: PHOTO_DIRECTORY,
      });
      if (result.files.length > 0) {
        break;
      }

      await Filesystem.rmdir({
        path: parentPath,
        directory: PHOTO_DIRECTORY,
      });
    } catch {
      break;
    }
  }
};

const blobToDataUrl = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read photo data."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(blob);
  });

const copyFileWithPicker = async (
  from: string,
  to: string,
  overwrite = true,
): Promise<void> => {
  const picker = FilePicker as unknown as {
    copyFile?: (options: {
      from: string;
      to: string;
      overwrite?: boolean;
    }) => Promise<void>;
  };
  if (typeof picker.copyFile !== "function") {
    throw new Error("File copy is not supported on this device.");
  }
  await picker.copyFile({ from, to, overwrite });
};

const copyExternalFileToManagedPath = async (
  sourcePath: string,
  targetRelativePath: string,
): Promise<void> => {
  const parentDirectory = targetRelativePath.split("/").slice(0, -1).join("/");
  await ensureDirectory(parentDirectory);
  const targetUri = await getPhotoUri(targetRelativePath);

  try {
    await copyFileWithPicker(sourcePath, targetUri, true);
    return;
  } catch {
    try {
      await Filesystem.copy({
        from: sourcePath,
        to: targetRelativePath,
        directory: PHOTO_DIRECTORY,
        toDirectory: PHOTO_DIRECTORY,
      });
      return;
    } catch {
      const file = await Filesystem.readFile({ path: sourcePath });
      await Filesystem.writeFile({
        path: targetRelativePath,
        directory: PHOTO_DIRECTORY,
        data: file.data,
        recursive: true,
      });
    }
  }
};

const copyManagedFile = async (
  sourceRelativePath: string,
  targetRelativePath: string,
): Promise<void> => {
  const parentDirectory = targetRelativePath.split("/").slice(0, -1).join("/");
  await ensureDirectory(parentDirectory);

  try {
    await Filesystem.copy({
      from: sourceRelativePath,
      to: targetRelativePath,
      directory: PHOTO_DIRECTORY,
      toDirectory: PHOTO_DIRECTORY,
    });
    return;
  } catch {
    const file = await Filesystem.readFile({
      path: sourceRelativePath,
      directory: PHOTO_DIRECTORY,
    });
    await Filesystem.writeFile({
      path: targetRelativePath,
      directory: PHOTO_DIRECTORY,
      data: file.data,
      recursive: true,
    });
  }
};

const getManagedPaths = (photoRaw: string, recordId?: number): string[] =>
  parseRecordPhotos(photoRaw)
    .map((entry) => normalizePhotoRelativePath(entry.path))
    .filter((relativePath) => {
      if (!isManagedPhotoPath(relativePath)) {
        return false;
      }
      if (typeof recordId !== "number") {
        return true;
      }
      return relativePath.startsWith(`${buildRecordPhotoDirectory(recordId)}/`);
    });

const buildImportedPhotoRaw = (
  photoRaw: string,
  idMapEntries: readonly PhotoImportIdMapEntry[],
): string => {
  const idMap = new Map<number, number>();
  for (const entry of idMapEntries) {
    idMap.set(entry.sourceId, entry.targetId);
  }

  return mapRecordPhotoPaths(photoRaw, (photoPath) => {
    const normalized = normalizePhotoRelativePath(photoPath);
    const parts = normalized.split("/");
    if (parts.length < 3 || parts[0] !== PHOTO_ROOT_FOLDER) {
      return normalized;
    }

    const sourceId = Number(parts[1]);
    const targetId = idMap.get(sourceId);
    if (!targetId) {
      return null;
    }

    return replacePhotoRecordId(normalized, targetId);
  });
};

const collectFilesRecursively = async (
  relativeDirectory: string,
): Promise<string[]> => {
  try {
    const result = await Filesystem.readdir({
      path: relativeDirectory,
      directory: PHOTO_DIRECTORY,
    });

    const files = await Promise.all(
      result.files.map(async (entry) => {
        const entryPath = relativeDirectory
          ? `${relativeDirectory}/${entry.name}`
          : entry.name;
        if (entry.type === "directory") {
          return collectFilesRecursively(entryPath);
        }
        return [entryPath];
      }),
    );

    return files.flat();
  } catch {
    return [];
  }
};

const writeArchiveFile = async (
  archivePath: string,
  data: string,
  directory?: Directory,
): Promise<string> => {
  const result = await Filesystem.writeFile(
    directory
      ? { path: archivePath, directory, data, recursive: true }
      : { path: archivePath, data },
  );
  return result.uri;
};

export const pickAndStagePhoto = async (): Promise<PhotoSelectionResult> => {
  const result = await FilePicker.pickFiles({
    types: ["image/*"],
    limit: 1,
    readData: false,
  });
  const file = result.files?.[0];
  if (!file?.path) {
    return { cancelled: true };
  }

  const token = createStagingToken();
  const targetName = createTimestampPhotoFileName(
    file.name || file.path,
    ".jpg",
  );
  const targetRelativePath = `${buildStagedPhotoDirectory(token)}/${targetName}`;
  await copyExternalFileToManagedPath(file.path, targetRelativePath);
  return createPhotoAssetResult(targetRelativePath);
};

export const captureAndStagePhoto = async (): Promise<PhotoSelectionResult> => {
  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Uri,
    quality: 85,
    correctOrientation: true,
    saveToGallery: false,
  });

  if (!photo.webPath && !photo.path) {
    return { cancelled: true };
  }

  const token = createStagingToken();
  const extension = photo.format ? `.${photo.format.toLowerCase()}` : ".jpg";
  const targetName = createTimestampPhotoFileName(
    photo.path || `captured${extension}`,
    extension,
  );
  const targetRelativePath = `${buildStagedPhotoDirectory(token)}/${targetName}`;

  if (photo.webPath) {
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    await Filesystem.writeFile({
      path: targetRelativePath,
      directory: PHOTO_DIRECTORY,
      data: dataUrl,
      recursive: true,
    });
  } else if (photo.path) {
    const file = await Filesystem.readFile({ path: photo.path });
    await Filesystem.writeFile({
      path: targetRelativePath,
      directory: PHOTO_DIRECTORY,
      data: file.data,
      recursive: true,
    });
  }

  return createPhotoAssetResult(targetRelativePath);
};

export const resolvePhotoUrl = async (photoRaw: string): Promise<string> =>
  getPrimaryPreviewUrl(photoRaw);

export const finalizeRecordPhoto = async (
  recordId: number,
  photoRaw: string,
): Promise<PhotoAssetResult | null> => {
  const primaryPath = getPrimaryRecordPhotoPath(photoRaw);
  if (!primaryPath) {
    return null;
  }

  if (
    primaryPath.startsWith(`${buildRecordPhotoDirectory(recordId)}/`) &&
    (await pathExists(primaryPath, PHOTO_DIRECTORY))
  ) {
    return createPhotoAssetResult(primaryPath);
  }

  if (!(await pathExists(primaryPath, PHOTO_DIRECTORY))) {
    throw new Error("The selected photo could not be prepared for saving.");
  }

  const targetName = createTimestampPhotoFileName(primaryPath, ".jpg");
  const targetRelativePath = `${buildRecordPhotoDirectory(recordId)}/${targetName}`;
  await copyManagedFile(primaryPath, targetRelativePath);
  return createPhotoAssetResult(targetRelativePath);
};

export const commitSavedRecordPhoto = async (
  recordId: number,
  previousPhotoRaw: string,
  nextPhotoRaw: string,
): Promise<void> => {
  const previousPaths = new Set(getManagedPaths(previousPhotoRaw, recordId));
  const nextPaths = new Set(getManagedPaths(nextPhotoRaw, recordId));

  for (const stalePath of previousPaths) {
    if (nextPaths.has(stalePath)) {
      continue;
    }
    await safeDeleteFile(stalePath);
    await cleanupEmptyParentDirectories(stalePath);
  }

  for (const maybeStagedPath of new Set([
    ...getManagedPaths(previousPhotoRaw),
    ...getManagedPaths(nextPhotoRaw),
  ])) {
    if (!isStagedPhotoPath(maybeStagedPath)) {
      continue;
    }
    await safeDeleteFile(maybeStagedPath);
    await cleanupEmptyParentDirectories(maybeStagedPath);
  }

  if (!nextPhotoRaw.trim()) {
    await deleteRecordPhotos(recordId);
  }
};

export const discardStagedPhotos = async (photoRaw: string): Promise<void> => {
  for (const relativePath of getManagedPaths(photoRaw)) {
    if (!isStagedPhotoPath(relativePath)) {
      continue;
    }
    await safeDeleteFile(relativePath);
    await cleanupEmptyParentDirectories(relativePath);
  }
};

export const deleteRecordPhotos = async (recordId: number): Promise<void> => {
  await safeRemoveDirectory(buildRecordPhotoDirectory(recordId));
};

export const clearAllPhotos = async (): Promise<void> => {
  await safeRemoveDirectory(PHOTO_ROOT_FOLDER);
};

export const rewriteImportedPhotoRaw = (
  photoRaw: string,
  idMapEntries: readonly PhotoImportIdMapEntry[],
): string => buildImportedPhotoRaw(photoRaw, idMapEntries);

export const getSiblingArchive = async (
  databasePath: string,
): Promise<PhotoArchiveResult> => {
  const archivePath = buildSiblingPhotoArchivePath(databasePath);
  const exists = await pathExists(archivePath);
  return {
    path: archivePath,
    hasPhotos: exists,
    exists,
  };
};

export const createArchive = async (
  archivePath: string,
  directory?: Directory,
): Promise<PhotoArchiveResult> => {
  const zip = new JSZip();
  const files = (await collectFilesRecursively(PHOTO_ROOT_FOLDER)).filter(
    (relativePath) =>
      !relativePath.startsWith(`${PHOTO_ROOT_FOLDER}/${PHOTO_STAGING_FOLDER}/`),
  );

  for (const relativePath of files) {
    const file = await Filesystem.readFile({
      path: relativePath,
      directory: PHOTO_DIRECTORY,
    });
    zip.file(relativePath, String(file.data).split(",").pop() ?? "", {
      base64: true,
    });
  }

  const archiveData = await zip.generateAsync({
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const storedPath = await writeArchiveFile(
    archivePath,
    archiveData,
    directory,
  );
  return {
    path: storedPath,
    hasPhotos: files.length > 0,
    exists: true,
  };
};

export const createSiblingArchive = async (
  databasePath: string,
): Promise<PhotoArchiveResult> =>
  createArchive(buildSiblingPhotoArchivePath(databasePath));

export const createTemporaryArchive = async (
  prefix: string,
): Promise<PhotoArchiveResult> =>
  createArchive(
    `${prefix}-${Date.now()}${PHOTO_ARCHIVE_SUFFIX}`,
    Directory.Cache,
  );

export const restoreArchive = async (
  archivePath: string,
  mode: "append" | "replace" | "merge",
  idMapEntries: readonly PhotoImportIdMapEntry[] = [],
): Promise<PhotoArchiveResult> => {
  const exists = await pathExists(archivePath);
  if (!exists) {
    return {
      path: archivePath,
      hasPhotos: false,
      exists: false,
    };
  }

  const archive = await Filesystem.readFile({ path: archivePath });
  const zip = await JSZip.loadAsync(
    String(archive.data).split(",").pop() ?? "",
    {
      base64: true,
    },
  );
  const files = Object.values(zip.files).filter((entry) => !entry.dir);

  if (mode === "replace") {
    await safeRemoveDirectory(PHOTO_ROOT_FOLDER);
    await ensureDirectory(PHOTO_ROOT_FOLDER);
  }

  for (const entry of files) {
    const normalizedName = normalizePhotoRelativePath(entry.name);
    if (!normalizedName.startsWith(`${PHOTO_ROOT_FOLDER}/`)) {
      continue;
    }
    if (
      normalizedName.startsWith(`${PHOTO_ROOT_FOLDER}/${PHOTO_STAGING_FOLDER}/`)
    ) {
      continue;
    }

    let targetRelativePath = normalizedName;
    if (mode === "append") {
      targetRelativePath = getPrimaryRecordPhotoPath(
        buildImportedPhotoRaw(
          serializeRecordPhotos([{ path: normalizedName }]),
          idMapEntries,
        ),
      );
      if (!targetRelativePath) {
        continue;
      }
    }

    const fileData = await entry.async("base64");
    await Filesystem.writeFile({
      path: targetRelativePath,
      directory: PHOTO_DIRECTORY,
      data: fileData,
      recursive: true,
    });
  }

  return {
    path: archivePath,
    hasPhotos: files.length > 0,
    exists: true,
  };
};
