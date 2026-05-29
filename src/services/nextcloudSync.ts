import { platformBridge } from "./platformBridge";
import { APP_NAME } from "../appSettings";
import { parseRecordPhotos } from "../models/record";
import type { SyncablePhotoFile } from "./photoTypes";
import {
  buildSiblingPhotoArchivePath,
  isManagedPhotoPath,
  isSafePhotoRelativePath,
  isStagedPhotoPath,
  normalizePhotoRelativePath,
  PHOTO_ROOT_FOLDER,
} from "./photoStorageShared";
import {
  beginSyncProgress,
  clearSyncProgress,
  finishSyncProgress,
  updateSyncProgress,
} from "./syncProgress";
import {
  clearSyncConfig,
  clearSyncDirty,
  clearSyncError,
  loadSyncConfig,
  saveSyncConfig,
  setSyncError,
  type SyncConfig,
} from "./syncConfig";
import type {
  SyncDownloadRequest,
  SyncFileTransferResponse,
  SyncHttpRequest,
  SyncHttpResponse,
  SyncManifest,
  SyncManifestPhotoEntry,
  SyncPhotoMode,
  SyncUploadRequest,
} from "./syncTypes";

const LOGIN_FLOW_POLL_INTERVAL_MS = 1500;
const LOGIN_FLOW_TIMEOUT_MS = 20 * 60 * 1000;
const SYNC_SCHEMA_VERSION = 1;
const REMOTE_DATABASE_FILE_NAME = "database.db";
const REMOTE_PHOTO_ARCHIVE_FILE_NAME = "database_photos.zip";
const REMOTE_PHOTO_DIRECTORY_NAME = PHOTO_ROOT_FOLDER;
const REMOTE_MANIFEST_FILE_NAME = "manifest.json";
const REMOTE_BACKUPS_DIRECTORY = "backups";
const NEXTCLOUD_CLIENT_NAME = APP_NAME.split(" - ")[0].trim() || APP_NAME;

export type RemoteUpdateCheck = {
  enabled: boolean;
  hasRemoteDatabase: boolean;
  newerThanLocal: boolean;
  hasConflict: boolean;
  manifest: SyncManifest | null;
};

export type SyncSourceChoice = "local" | "remote";

export type PendingSourceChoiceState = {
  requiresSourceChoice: boolean;
  localRecordCount: number;
  remoteDatabaseExists: boolean;
  remoteLastModified: string;
};

export type SyncConnectionResult = PendingSourceChoiceState & {
  config: SyncConfig;
};

type SyncCredentials = {
  serverUrl: string;
  loginName: string;
  userId: string;
  appPassword: string;
  remoteFolder: string;
  backupRetention: number;
  syncPictures: boolean;
};

type SyncRecord = {
  id?: number | string | null;
  photo?: string | null;
  [key: string]: unknown;
};

type RemoteFileInfo = {
  exists: boolean;
  etag: string;
  lastModified: string;
  isCollection: boolean;
  href: string;
};

type RemoteMirrorPhotoFile = RemoteFileInfo & {
  relativePath: string;
};

type MirrorPhotoSyncPlan = {
  uploadPaths: string[];
  downloadPaths: string[];
  deleteRemotePaths: string[];
  conflicts: string[];
};

class NextcloudSyncError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

const sanitizeServerUrl = (value: string): string => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new NextcloudSyncError(
      "invalid-server-url",
      "Enter a valid Nextcloud server URL.",
    );
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new NextcloudSyncError(
      "invalid-server-url",
      "Enter a valid Nextcloud server URL.",
    );
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
};

const encodeBasicAuth = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const toIsoOrEmpty = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const toTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const buildDeviceLabel = (): string => {
  if (platformBridge.isElectron) {
    return "desktop";
  }
  if (platformBridge.isAndroid) {
    return "android";
  }
  if (platformBridge.isCapacitor) {
    return "native";
  }
  return "unknown";
};

const formatTimestampForFileName = (value: Date): string =>
  value.toISOString().replace(/[-:.]/g, "");

const getHeaderValue = (
  headers: Record<string, string>,
  name: string,
): string => {
  const expected = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === expected) {
      return value;
    }
  }
  return "";
};

const normalizeHttpResponse = (response: any): SyncHttpResponse => ({
  status: Number(response?.status ?? 0),
  ok:
    response?.ok === true ||
    (Number(response?.status ?? 0) >= 200 &&
      Number(response?.status ?? 0) < 300),
  headers:
    typeof response?.headers === "object" && response.headers !== null
      ? response.headers
      : {},
  data: typeof response?.data === "string" ? response.data : "",
});

const parseJsonResponse = <T>(
  response: SyncHttpResponse,
  fallbackMessage: string,
): T => {
  try {
    return JSON.parse(response.data) as T;
  } catch {
    throw new NextcloudSyncError(
      "invalid-json",
      fallbackMessage,
      response.status,
    );
  }
};

const buildAuthHeaders = (
  credentials: SyncCredentials,
): Record<string, string> => ({
  Authorization: `Basic ${encodeBasicAuth(`${credentials.loginName}:${credentials.appPassword}`)}`,
});

const splitRemotePath = (remotePath: string): string[] =>
  remotePath
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

const buildDavUrl = (
  credentials: SyncCredentials,
  ...segments: string[]
): string => {
  const davBasePath = `/remote.php/dav/files/${encodeURIComponent(credentials.userId)}`;
  const pathSegments = splitRemotePath(credentials.remoteFolder);
  const extraSegments = segments.flatMap((segment) => splitRemotePath(segment));
  const encodedSegments = [...pathSegments, ...extraSegments].map(
    encodeURIComponent,
  );
  const fullPath = `${davBasePath}/${encodedSegments.join("/")}`;
  return new URL(fullPath, `${credentials.serverUrl}/`).toString();
};

const buildUserRootDavUrl = (
  credentials: SyncCredentials,
  ...segments: string[]
): string => {
  const davBasePath = `/remote.php/dav/files/${encodeURIComponent(credentials.userId)}`;
  const encodedSegments = segments
    .flatMap((segment) => splitRemotePath(segment))
    .map(encodeURIComponent);
  const fullPath = `${davBasePath}/${encodedSegments.join("/")}`;
  return new URL(fullPath, `${credentials.serverUrl}/`).toString();
};

const buildOcsUrl = (serverUrl: string, pathName: string): string =>
  new URL(pathName, `${serverUrl}/`).toString();

const normalizeDavPathname = (pathname: string): string => {
  const normalized = decodeURIComponent(pathname).replace(/\/+$/, "");
  return normalized || "/";
};

const getElementText = (parent: ParentNode, localName: string): string => {
  const candidates = Array.from(parent.childNodes).filter(
    (node): node is Element => node instanceof Element,
  );
  for (const candidate of candidates) {
    if (candidate.localName === localName) {
      return candidate.textContent?.trim() ?? "";
    }
  }
  return "";
};

const parseDavResponse = (responseBody: string): RemoteFileInfo[] => {
  if (!responseBody.trim()) {
    return [];
  }

  const xml = new DOMParser().parseFromString(responseBody, "application/xml");
  return Array.from(xml.getElementsByTagNameNS("*", "response")).map(
    (responseNode) => {
      const propNode = responseNode.getElementsByTagNameNS("*", "prop")[0];
      const resourceTypeNode = propNode?.getElementsByTagNameNS(
        "*",
        "resourcetype",
      )[0];
      const href = getElementText(responseNode, "href");
      return {
        exists: true,
        etag: propNode ? getElementText(propNode, "getetag") : "",
        lastModified: toIsoOrEmpty(
          propNode ? getElementText(propNode, "getlastmodified") : "",
        ),
        isCollection: !!resourceTypeNode?.getElementsByTagNameNS(
          "*",
          "collection",
        )[0],
        href,
      };
    },
  );
};

const isSyncPhotoMode = (value: unknown): value is SyncPhotoMode =>
  value === "archive" || value === "mirror";

const normalizeManifestPhotoEntries = (
  value: unknown,
): Record<string, SyncManifestPhotoEntry> => {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const entries: Record<string, SyncManifestPhotoEntry> = {};
  for (const [rawPath, rawEntry] of Object.entries(value)) {
    const relativePath = normalizePhotoRelativePath(rawPath);
    if (
      !relativePath ||
      !isManagedPhotoPath(relativePath) ||
      !isSafePhotoRelativePath(relativePath) ||
      isStagedPhotoPath(relativePath)
    ) {
      continue;
    }

    const entry =
      typeof rawEntry === "object" && rawEntry !== null ? rawEntry : {};
    entries[relativePath] = {
      contentHash: String(
        (entry as { contentHash?: unknown }).contentHash ?? "",
      ).trim(),
      remoteEtag: String(
        (entry as { remoteEtag?: unknown }).remoteEtag ?? "",
      ).trim(),
      byteSize: Math.max(
        0,
        Number.isFinite(Number((entry as { byteSize?: unknown }).byteSize))
          ? Number((entry as { byteSize?: unknown }).byteSize)
          : 0,
      ),
    };
  }

  return entries;
};

const normalizeSyncManifest = (
  value: Partial<SyncManifest> | null | undefined,
): SyncManifest | null => {
  if (!value) {
    return null;
  }

  return {
    uploadedAt: toIsoOrEmpty(String(value.uploadedAt ?? "")),
    etag: String(value.etag ?? "").trim(),
    appVersion: String(value.appVersion ?? "").trim(),
    schemaVersion: Number.isFinite(Number(value.schemaVersion))
      ? Number(value.schemaVersion)
      : SYNC_SCHEMA_VERSION,
    sourcePlatform: String(value.sourcePlatform ?? "").trim(),
    deviceLabel: String(value.deviceLabel ?? "").trim(),
    fileName:
      String(value.fileName ?? REMOTE_DATABASE_FILE_NAME).trim() ||
      REMOTE_DATABASE_FILE_NAME,
    photoMode: isSyncPhotoMode(value.photoMode) ? value.photoMode : "mirror",
    photoRoot:
      normalizePhotoRelativePath(
        value.photoRoot ?? REMOTE_PHOTO_DIRECTORY_NAME,
      ) || REMOTE_PHOTO_DIRECTORY_NAME,
    photoEntries: normalizeManifestPhotoEntries(value.photoEntries),
  };
};

const buildManifestFromRemoteFile = async (
  remoteFile: RemoteFileInfo,
  overrides: Partial<
    Pick<SyncManifest, "photoMode" | "photoRoot" | "photoEntries">
  > = {},
): Promise<SyncManifest> => ({
  uploadedAt: remoteFile.lastModified || new Date().toISOString(),
  etag: remoteFile.etag,
  appVersion: String(await platformBridge.invoke("app:getVersion")),
  schemaVersion: SYNC_SCHEMA_VERSION,
  sourcePlatform: platformBridge.isElectron ? "electron" : buildDeviceLabel(),
  deviceLabel: buildDeviceLabel(),
  fileName: REMOTE_DATABASE_FILE_NAME,
  photoMode: overrides.photoMode ?? "mirror",
  photoRoot: overrides.photoRoot ?? REMOTE_PHOTO_DIRECTORY_NAME,
  photoEntries: overrides.photoEntries ?? {},
});

class NextcloudSyncService {
  async hasStoredSecret(): Promise<boolean> {
    const value = await platformBridge.invoke("sync:getSecret");
    return String(value ?? "").trim().length > 0;
  }

  private async request(options: SyncHttpRequest): Promise<SyncHttpResponse> {
    try {
      const response = await platformBridge.invoke("sync:httpRequest", {
        ...options,
        headers: {
          "User-Agent": NEXTCLOUD_CLIENT_NAME,
          ...(options.headers ?? {}),
        },
      });
      return normalizeHttpResponse(response);
    } catch (error) {
      throw new NextcloudSyncError(
        "network-error",
        error instanceof Error
          ? error.message
          : "Could not reach the Nextcloud server.",
      );
    }
  }

  private async uploadFile(
    options: SyncUploadRequest,
  ): Promise<SyncFileTransferResponse> {
    try {
      const response = await platformBridge.invoke("sync:uploadFile", options);
      return {
        ...normalizeHttpResponse(response),
        path: typeof response?.path === "string" ? response.path : null,
      };
    } catch (error) {
      throw new NextcloudSyncError(
        "upload-failed",
        error instanceof Error ? error.message : "Database upload failed.",
      );
    }
  }

  private async downloadFile(
    options: SyncDownloadRequest,
  ): Promise<SyncFileTransferResponse> {
    try {
      const response = await platformBridge.invoke(
        "sync:downloadFile",
        options,
      );
      return {
        ...normalizeHttpResponse(response),
        path: typeof response?.path === "string" ? response.path : null,
      };
    } catch (error) {
      throw new NextcloudSyncError(
        "download-failed",
        error instanceof Error ? error.message : "Database download failed.",
      );
    }
  }

  private assertStatus(
    response: SyncHttpResponse,
    validStatuses: number[],
    code: string,
    message: string,
  ): void {
    if (!validStatuses.includes(response.status)) {
      throw new NextcloudSyncError(code, message, response.status);
    }
  }

  private async getStoredSecret(): Promise<string> {
    const value = await platformBridge.invoke("sync:getSecret");
    const secret = String(value ?? "").trim();
    if (!secret) {
      throw new NextcloudSyncError(
        "missing-credentials",
        "No stored Nextcloud app password is available.",
      );
    }
    return secret;
  }

  private async getLocalRecordCount(): Promise<number> {
    const result = await platformBridge.invoke("db:getRecordCount");
    const count = Number(result ?? 0);
    return Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  }

  private async listAllRecords(): Promise<SyncRecord[]> {
    const records = await platformBridge.invoke("db:listRecords", null);
    return Array.isArray(records) ? (records as SyncRecord[]) : [];
  }

  private async captureLocalPhotoSnapshot(): Promise<Map<number, string>> {
    const snapshot = new Map<number, string>();
    const records = await this.listAllRecords();

    for (const record of records) {
      const recordId = Number(record.id ?? -1);
      const photoRaw = String(record.photo ?? "").trim();
      if (!Number.isFinite(recordId) || recordId <= 0 || !photoRaw) {
        continue;
      }
      snapshot.set(recordId, photoRaw);
    }

    return snapshot;
  }

  private async hasLocalPhotoAsset(photoRaw: string): Promise<boolean> {
    const normalizedPhoto = String(photoRaw ?? "").trim();
    if (!normalizedPhoto) {
      return false;
    }

    const previewUrl = await platformBridge.invoke(
      "photo:resolveUrl",
      normalizedPhoto,
    );
    return String(previewUrl ?? "").trim().length > 0;
  }

  private async restoreAvailableLocalPhotos(
    snapshot: ReadonlyMap<number, string>,
  ): Promise<void> {
    if (snapshot.size === 0) {
      return;
    }

    const records = await this.listAllRecords();
    for (const record of records) {
      const recordId = Number(record.id ?? -1);
      const localPhotoRaw = snapshot.get(recordId);
      if (!localPhotoRaw) {
        continue;
      }

      const currentPhotoRaw = String(record.photo ?? "").trim();
      if (currentPhotoRaw && (await this.hasLocalPhotoAsset(currentPhotoRaw))) {
        continue;
      }
      if (!(await this.hasLocalPhotoAsset(localPhotoRaw))) {
        continue;
      }

      await platformBridge.invoke("db:updateRecord", {
        ...record,
        photo: localPhotoRaw,
      });
    }
  }

  private getReferencedPhotoPaths(records: readonly SyncRecord[]): Set<string> {
    const referencedPaths = new Set<string>();

    for (const record of records) {
      for (const entry of parseRecordPhotos(record.photo)) {
        const relativePath = normalizePhotoRelativePath(entry.path);
        if (
          !relativePath ||
          !isManagedPhotoPath(relativePath) ||
          !isSafePhotoRelativePath(relativePath) ||
          isStagedPhotoPath(relativePath)
        ) {
          continue;
        }
        referencedPaths.add(relativePath);
      }
    }

    return referencedPaths;
  }

  private async getLocalReferencedPhotoPaths(): Promise<Set<string>> {
    return this.getReferencedPhotoPaths(await this.listAllRecords());
  }

  private async listLocalSyncablePhotos(): Promise<
    Map<string, SyncablePhotoFile>
  > {
    const rawFiles = await platformBridge.invoke("photo:listSyncablePhotos");
    const photos = new Map<string, SyncablePhotoFile>();
    if (!Array.isArray(rawFiles)) {
      return photos;
    }

    for (const rawFile of rawFiles) {
      const relativePath = normalizePhotoRelativePath(rawFile?.relativePath);
      const contentHash = String(rawFile?.contentHash ?? "").trim();
      const sourcePath = String(rawFile?.sourcePath ?? "").trim();
      const byteSize = Number(rawFile?.byteSize ?? 0);

      if (
        !relativePath ||
        !contentHash ||
        !sourcePath ||
        !isManagedPhotoPath(relativePath) ||
        !isSafePhotoRelativePath(relativePath) ||
        isStagedPhotoPath(relativePath)
      ) {
        continue;
      }

      photos.set(relativePath, {
        relativePath,
        contentHash,
        byteSize: Number.isFinite(byteSize) ? Math.max(0, byteSize) : 0,
        sourcePath,
      });
    }

    return photos;
  }

  private getRemoteRelativePathFromHref(
    credentials: SyncCredentials,
    href: string,
  ): string {
    if (!href.trim()) {
      return "";
    }

    const hrefPath = decodeURIComponent(
      new URL(href, credentials.serverUrl).pathname,
    );
    const davPrefix = `/remote.php/dav/files/${credentials.userId}/`;
    const relativePathFromRoot = hrefPath.startsWith(davPrefix)
      ? hrefPath.slice(davPrefix.length)
      : "";
    const syncRootPrefix = `${credentials.remoteFolder.replace(/^\/+/, "")}/`;
    return relativePathFromRoot.startsWith(syncRootPrefix)
      ? normalizePhotoRelativePath(
          relativePathFromRoot.slice(syncRootPrefix.length),
        )
      : "";
  }

  private async listRemoteDirectoryEntries(
    credentials: SyncCredentials,
    relativePath: string,
  ): Promise<RemoteFileInfo[]> {
    const response = await this.request({
      url: buildDavUrl(credentials, relativePath),
      method: "PROPFIND",
      headers: {
        ...buildAuthHeaders(credentials),
        Depth: "1",
        Accept: "application/xml, text/xml",
        "Content-Type": "application/xml; charset=utf-8",
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getetag />
    <d:getlastmodified />
    <d:resourcetype />
  </d:prop>
</d:propfind>`,
    });

    if (response.status === 404) {
      return [];
    }

    this.assertStatus(
      response,
      [207],
      "dav-list-directory-failed",
      "Could not read the remote Nextcloud folder.",
    );

    const directoryUrl = buildDavUrl(credentials, relativePath);
    const directoryPathname = normalizeDavPathname(
      new URL(directoryUrl).pathname,
    );
    return parseDavResponse(response.data).filter((entry) => {
      if (!entry.href) {
        return false;
      }

      const entryPathname = normalizeDavPathname(
        new URL(entry.href, credentials.serverUrl).pathname,
      );
      return entryPathname !== directoryPathname;
    });
  }

  private async listRemoteMirrorPhotos(
    credentials: SyncCredentials,
    relativeDirectory = REMOTE_PHOTO_DIRECTORY_NAME,
  ): Promise<Map<string, RemoteMirrorPhotoFile>> {
    const normalizedDirectory = normalizePhotoRelativePath(relativeDirectory);
    const entries = await this.listRemoteDirectoryEntries(
      credentials,
      relativeDirectory,
    );
    const photos = new Map<string, RemoteMirrorPhotoFile>();

    for (const entry of entries) {
      const relativePath = this.getRemoteRelativePathFromHref(
        credentials,
        entry.href,
      );
      if (!relativePath) {
        continue;
      }

      if (entry.isCollection) {
        if (relativePath === normalizedDirectory) {
          continue;
        }
        const nestedPhotos = await this.listRemoteMirrorPhotos(
          credentials,
          relativePath,
        );
        for (const [nestedPath, nestedEntry] of nestedPhotos) {
          photos.set(nestedPath, nestedEntry);
        }
        continue;
      }

      if (
        !isManagedPhotoPath(relativePath) ||
        !isSafePhotoRelativePath(relativePath) ||
        isStagedPhotoPath(relativePath)
      ) {
        continue;
      }

      photos.set(relativePath, {
        ...entry,
        relativePath,
      });
    }

    return photos;
  }

  private async ensureRemotePhotoParentExists(
    credentials: SyncCredentials,
    relativePath: string,
  ): Promise<void> {
    const segments = splitRemotePath(relativePath);
    if (segments.length === 0) {
      return;
    }

    const parentPath = segments.slice(0, -1).join("/");
    const targetPath = parentPath || segments[0];
    await this.ensureRemoteFolderExists(
      credentials,
      `${credentials.remoteFolder}/${targetPath}`,
    );
  }

  private async uploadRemotePhoto(
    credentials: SyncCredentials,
    photoFile: SyncablePhotoFile,
  ): Promise<void> {
    await this.ensureRemotePhotoParentExists(
      credentials,
      photoFile.relativePath,
    );
    const uploadResponse = await this.uploadFile({
      url: buildDavUrl(credentials, photoFile.relativePath),
      sourcePath: photoFile.sourcePath,
      method: "PUT",
      headers: {
        ...buildAuthHeaders(credentials),
        "Content-Type": "application/octet-stream",
      },
    });

    this.assertStatus(
      uploadResponse,
      [200, 201, 204],
      "upload-failed",
      "Could not upload a changed photo to Nextcloud.",
    );
  }

  private async downloadRemotePhoto(
    credentials: SyncCredentials,
    relativePath: string,
  ): Promise<string> {
    const fileName = `nextcloud-photo-${Date.now()}-${relativePath.split("/").pop() || "photo"}`;
    const download = await this.downloadFile({
      url: buildDavUrl(credentials, relativePath),
      fileName,
      headers: buildAuthHeaders(credentials),
    });

    this.assertStatus(
      download,
      [200],
      "remote-download-failed",
      "Could not download a changed photo from Nextcloud.",
    );

    if (!download.path) {
      throw new NextcloudSyncError(
        "remote-download-failed",
        "The remote photo download did not return a local file.",
      );
    }

    return download.path;
  }

  private async importLocalSyncPhoto(
    sourcePath: string,
    relativePath: string,
  ): Promise<void> {
    await platformBridge.invoke(
      "photo:importSyncFile",
      sourcePath,
      relativePath,
    );
  }

  private async deleteLocalSyncPhoto(relativePath: string): Promise<void> {
    await platformBridge.invoke("photo:deleteManagedPath", relativePath);
  }

  private resolveRemotePhotoMode(
    manifest: SyncManifest | null,
    remotePhotoArchive: RemoteFileInfo | null,
  ): SyncPhotoMode {
    if (remotePhotoArchive?.exists) {
      return "archive";
    }
    if (manifest && isSyncPhotoMode(manifest.photoMode)) {
      return manifest.photoMode;
    }
    return "mirror";
  }

  private createMirrorPhotoSyncPlan(
    localPhotos: ReadonlyMap<string, SyncablePhotoFile>,
    remotePhotos: ReadonlyMap<string, RemoteMirrorPhotoFile>,
    manifest: SyncManifest | null,
    referencedPaths: ReadonlySet<string>,
  ): MirrorPhotoSyncPlan {
    const uploadPaths = new Set<string>();
    const downloadPaths = new Set<string>();
    const deleteRemotePaths = new Set<string>();
    const conflicts = new Set<string>();
    const manifestEntries = manifest?.photoEntries ?? {};
    const candidatePaths = new Set<string>([
      ...Object.keys(manifestEntries),
      ...localPhotos.keys(),
      ...remotePhotos.keys(),
    ]);

    for (const relativePath of Array.from(candidatePaths).sort()) {
      const localPhoto = localPhotos.get(relativePath);
      const remotePhoto = remotePhotos.get(relativePath);
      const manifestEntry = manifestEntries[relativePath];
      const isReferenced = referencedPaths.has(relativePath);

      if (!isReferenced) {
        if (remotePhoto) {
          deleteRemotePaths.add(relativePath);
        }
        continue;
      }

      if (!manifestEntry) {
        if (localPhoto) {
          uploadPaths.add(relativePath);
        } else if (remotePhoto) {
          downloadPaths.add(relativePath);
        }
        continue;
      }

      const localChanged =
        !localPhoto || localPhoto.contentHash !== manifestEntry.contentHash;
      const remoteChanged =
        !remotePhoto || remotePhoto.etag !== manifestEntry.remoteEtag;

      if (!localPhoto && remotePhoto) {
        downloadPaths.add(relativePath);
        continue;
      }

      if (localPhoto && !remotePhoto) {
        uploadPaths.add(relativePath);
        continue;
      }

      if (!localPhoto && !remotePhoto) {
        continue;
      }

      if (localChanged && remoteChanged) {
        conflicts.add(relativePath);
        continue;
      }

      if (localChanged) {
        uploadPaths.add(relativePath);
        continue;
      }

      if (remoteChanged) {
        downloadPaths.add(relativePath);
      }
    }

    return {
      uploadPaths: Array.from(uploadPaths),
      downloadPaths: Array.from(downloadPaths),
      deleteRemotePaths: Array.from(deleteRemotePaths),
      conflicts: Array.from(conflicts),
    };
  }

  private buildMirrorPhotoManifestEntries(
    localPhotos: ReadonlyMap<string, SyncablePhotoFile>,
    remotePhotos: ReadonlyMap<string, RemoteMirrorPhotoFile>,
  ): Record<string, SyncManifestPhotoEntry> {
    const photoEntries: Record<string, SyncManifestPhotoEntry> = {};
    const candidatePaths = new Set<string>([
      ...localPhotos.keys(),
      ...remotePhotos.keys(),
    ]);

    for (const relativePath of Array.from(candidatePaths).sort()) {
      const localPhoto = localPhotos.get(relativePath);
      const remotePhoto = remotePhotos.get(relativePath);
      if (!localPhoto || !remotePhoto) {
        continue;
      }

      photoEntries[relativePath] = {
        contentHash: localPhoto.contentHash,
        remoteEtag: remotePhoto.etag,
        byteSize: localPhoto.byteSize,
      };
    }

    return photoEntries;
  }

  private async syncMirrorPhotos(
    credentials: SyncCredentials,
    manifest: SyncManifest | null,
    referencedPaths: ReadonlySet<string>,
    progressToken: number,
  ): Promise<Record<string, SyncManifestPhotoEntry>> {
    await this.ensureRemoteFolderExists(
      credentials,
      `${credentials.remoteFolder}/${REMOTE_PHOTO_DIRECTORY_NAME}`,
    );
    const localPhotos = await this.listLocalSyncablePhotos();
    const remotePhotos = await this.listRemoteMirrorPhotos(credentials);
    const plan = this.createMirrorPhotoSyncPlan(
      localPhotos,
      remotePhotos,
      manifest,
      referencedPaths,
    );

    if (plan.conflicts.length > 0) {
      throw new NextcloudSyncError(
        "remote-photos-changed",
        "Some synced photos changed both locally and on Nextcloud. Download first to avoid overwriting newer photo changes.",
      );
    }

    if (plan.uploadPaths.length > 0) {
      updateSyncProgress(progressToken, {
        direction: "upload",
        messageKey: "sync.progress_upload_photos",
        percent: 58,
      });
      for (const relativePath of plan.uploadPaths) {
        const photoFile = localPhotos.get(relativePath);
        if (!photoFile) {
          continue;
        }
        await this.uploadRemotePhoto(credentials, photoFile);
      }
    }

    if (plan.downloadPaths.length > 0) {
      updateSyncProgress(progressToken, {
        direction: "download",
        messageKey: "sync.progress_download_photos",
        percent: 66,
      });
      for (const relativePath of plan.downloadPaths) {
        const downloadPath = await this.downloadRemotePhoto(
          credentials,
          relativePath,
        );
        try {
          await this.importLocalSyncPhoto(downloadPath, relativePath);
        } finally {
          await platformBridge.invoke("sync:deleteFile", downloadPath);
        }
      }
    }

    if (plan.deleteRemotePaths.length > 0) {
      updateSyncProgress(progressToken, {
        direction: "sync",
        messageKey: "sync.progress_upload_photos",
        percent: 72,
      });
      for (const relativePath of plan.deleteRemotePaths) {
        await this.deleteRemoteFile(credentials, relativePath);
      }
    }

    const nextLocalPhotos = await this.listLocalSyncablePhotos();
    const nextRemotePhotos = await this.listRemoteMirrorPhotos(credentials);
    return this.buildMirrorPhotoManifestEntries(
      nextLocalPhotos,
      nextRemotePhotos,
    );
  }

  private async restoreMirrorPhotos(
    credentials: SyncCredentials,
    manifest: SyncManifest | null,
    progressToken: number,
  ): Promise<void> {
    const referencedPaths = await this.getLocalReferencedPhotoPaths();
    const localPhotos = await this.listLocalSyncablePhotos();
    const remotePhotos = await this.listRemoteMirrorPhotos(credentials);
    const manifestEntries = manifest?.photoEntries ?? {};

    const downloadPaths = Array.from(referencedPaths)
      .filter((relativePath) => {
        const remotePhoto = remotePhotos.get(relativePath);
        if (!remotePhoto) {
          return false;
        }

        const localPhoto = localPhotos.get(relativePath);
        const manifestEntry = manifestEntries[relativePath];
        return (
          !localPhoto ||
          !manifestEntry ||
          localPhoto.contentHash !== manifestEntry.contentHash ||
          remotePhoto.etag !== manifestEntry.remoteEtag
        );
      })
      .sort();

    const deleteLocalPaths = Array.from(localPhotos.keys())
      .filter((relativePath) => !referencedPaths.has(relativePath))
      .sort();

    if (downloadPaths.length > 0) {
      updateSyncProgress(progressToken, {
        direction: "download",
        messageKey: "sync.progress_download_photos",
        percent: 58,
      });
      for (const relativePath of downloadPaths) {
        const downloadPath = await this.downloadRemotePhoto(
          credentials,
          relativePath,
        );
        try {
          await this.importLocalSyncPhoto(downloadPath, relativePath);
        } finally {
          await platformBridge.invoke("sync:deleteFile", downloadPath);
        }
      }
    }

    if (deleteLocalPaths.length > 0) {
      updateSyncProgress(progressToken, {
        direction: "sync",
        messageKey: "sync.progress_restore_photos",
        percent: 76,
      });
      for (const relativePath of deleteLocalPaths) {
        await this.deleteLocalSyncPhoto(relativePath);
      }
    }
  }

  private async getCredentials(): Promise<SyncCredentials> {
    const config = loadSyncConfig();
    if (!config.serverUrl || !config.loginName || !config.userId) {
      throw new NextcloudSyncError(
        "sync-not-configured",
        "Nextcloud sync is not connected yet.",
      );
    }

    return {
      serverUrl: config.serverUrl,
      loginName: config.loginName,
      userId: config.userId,
      remoteFolder: config.remoteFolder,
      backupRetention: config.backupRetention,
      syncPictures: config.syncPictures,
      appPassword: await this.getStoredSecret(),
    };
  }

  private async resolveCurrentUserId(
    serverUrl: string,
    loginName: string,
    appPassword: string,
  ): Promise<string> {
    const response = await this.request({
      url: buildOcsUrl(serverUrl, "/ocs/v1.php/cloud/user?format=json"),
      method: "GET",
      headers: {
        Accept: "application/json",
        "OCS-APIRequest": "true",
        Authorization: `Basic ${encodeBasicAuth(`${loginName}:${appPassword}`)}`,
      },
    });

    this.assertStatus(
      response,
      [200],
      "ocs-user-failed",
      "Could not resolve the Nextcloud account details.",
    );

    const parsed = parseJsonResponse<any>(
      response,
      "Nextcloud returned invalid account data.",
    );
    const userId = String(parsed?.ocs?.data?.id ?? "").trim();
    if (!userId) {
      throw new NextcloudSyncError(
        "missing-user-id",
        "Nextcloud did not return a valid user ID.",
      );
    }

    return userId;
  }

  private async getRemoteFileInfo(
    credentials: SyncCredentials,
    relativePath: string,
  ): Promise<RemoteFileInfo> {
    const response = await this.request({
      url: buildDavUrl(credentials, relativePath),
      method: "PROPFIND",
      headers: {
        ...buildAuthHeaders(credentials),
        Depth: "0",
        Accept: "application/xml, text/xml",
        "Content-Type": "application/xml; charset=utf-8",
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getetag />
    <d:getlastmodified />
    <d:resourcetype />
  </d:prop>
</d:propfind>`,
    });

    if (response.status === 404) {
      return {
        exists: false,
        etag: "",
        lastModified: "",
        isCollection: false,
        href: "",
      };
    }

    this.assertStatus(
      response,
      [207],
      "dav-propfind-failed",
      "Could not read the remote Nextcloud folder.",
    );

    const fileInfo = parseDavResponse(response.data)[0];
    return (
      fileInfo ?? {
        exists: false,
        etag: "",
        lastModified: "",
        isCollection: false,
        href: "",
      }
    );
  }

  private async listRemoteBackups(
    credentials: SyncCredentials,
  ): Promise<RemoteFileInfo[]> {
    const response = await this.request({
      url: buildDavUrl(credentials, REMOTE_BACKUPS_DIRECTORY),
      method: "PROPFIND",
      headers: {
        ...buildAuthHeaders(credentials),
        Depth: "1",
        Accept: "application/xml, text/xml",
        "Content-Type": "application/xml; charset=utf-8",
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getetag />
    <d:getlastmodified />
    <d:resourcetype />
  </d:prop>
</d:propfind>`,
    });

    if (response.status === 404) {
      return [];
    }

    this.assertStatus(
      response,
      [207],
      "dav-list-backups-failed",
      "Could not read the Nextcloud backup folder.",
    );

    const directoryUrl = buildDavUrl(credentials, REMOTE_BACKUPS_DIRECTORY);
    return parseDavResponse(response.data)
      .filter(
        (entry) =>
          entry.href &&
          decodeURIComponent(entry.href) !==
            decodeURIComponent(new URL(directoryUrl).pathname),
      )
      .filter((entry) => !entry.isCollection);
  }

  private async ensureRemoteFolderExists(
    credentials: SyncCredentials,
    relativePath: string,
  ): Promise<void> {
    let currentPath = "";
    for (const segment of relativePath.split("/").filter(Boolean)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const response = await this.request({
        url: buildUserRootDavUrl(credentials, currentPath),
        method: "MKCOL",
        headers: buildAuthHeaders(credentials),
      });

      if (![201, 405].includes(response.status)) {
        throw new NextcloudSyncError(
          "dav-create-folder-failed",
          "Could not create the Nextcloud sync folder.",
          response.status,
        );
      }
    }
  }

  private async ensureRemoteStructure(
    credentials: SyncCredentials,
  ): Promise<void> {
    await this.ensureRemoteFolderExists(credentials, credentials.remoteFolder);
    await this.ensureRemoteFolderExists(
      credentials,
      `${credentials.remoteFolder}/${REMOTE_BACKUPS_DIRECTORY}`,
    );
  }

  private async getRemoteManifest(
    credentials: SyncCredentials,
  ): Promise<SyncManifest | null> {
    const manifestResponse = await this.request({
      url: buildDavUrl(credentials, REMOTE_MANIFEST_FILE_NAME),
      method: "GET",
      headers: {
        ...buildAuthHeaders(credentials),
        Accept: "application/json",
      },
    });

    if (manifestResponse.status === 404) {
      return null;
    }

    this.assertStatus(
      manifestResponse,
      [200],
      "manifest-read-failed",
      "Could not read the remote sync manifest.",
    );

    const manifest = normalizeSyncManifest(
      parseJsonResponse<Partial<SyncManifest>>(
        manifestResponse,
        "The remote sync manifest is invalid.",
      ),
    );
    if (!manifest) {
      throw new NextcloudSyncError(
        "invalid-json",
        "The remote sync manifest is invalid.",
        manifestResponse.status,
      );
    }
    return manifest;
  }

  private async copyRemoteFile(
    credentials: SyncCredentials,
    sourceRelativePath: string,
    destinationRelativePath: string,
  ): Promise<void> {
    const response = await this.request({
      url: buildDavUrl(credentials, sourceRelativePath),
      method: "COPY",
      headers: {
        ...buildAuthHeaders(credentials),
        Destination: buildDavUrl(credentials, destinationRelativePath),
        Overwrite: "T",
      },
    });

    this.assertStatus(
      response,
      [201, 204],
      "dav-copy-failed",
      "Could not create the remote database backup.",
    );
  }

  private async moveRemoteFile(
    credentials: SyncCredentials,
    sourceRelativePath: string,
    destinationRelativePath: string,
  ): Promise<void> {
    const response = await this.request({
      url: buildDavUrl(credentials, sourceRelativePath),
      method: "MOVE",
      headers: {
        ...buildAuthHeaders(credentials),
        Destination: buildDavUrl(credentials, destinationRelativePath),
        Overwrite: "T",
      },
    });

    this.assertStatus(
      response,
      [201, 204],
      "dav-move-failed",
      "Could not promote the uploaded database on Nextcloud.",
    );
  }

  private async deleteRemoteFile(
    credentials: SyncCredentials,
    relativePath: string,
  ): Promise<void> {
    const response = await this.request({
      url: buildDavUrl(credentials, relativePath),
      method: "DELETE",
      headers: buildAuthHeaders(credentials),
    });

    if (![204, 404].includes(response.status)) {
      throw new NextcloudSyncError(
        "dav-delete-failed",
        "Could not delete an outdated Nextcloud backup.",
        response.status,
      );
    }
  }

  private async pruneRemoteBackups(
    credentials: SyncCredentials,
  ): Promise<void> {
    const retention = Math.max(0, credentials.backupRetention);
    const backups = await this.listRemoteBackups(credentials);
    const sorted = backups.sort(
      (left, right) =>
        toTimestamp(right.lastModified) - toTimestamp(left.lastModified),
    );

    for (const backup of sorted.slice(retention)) {
      const hrefPath = decodeURIComponent(
        new URL(backup.href, credentials.serverUrl).pathname,
      );
      const davPrefix = `/remote.php/dav/files/${credentials.userId}/`;
      const relativePathFromRoot = hrefPath.startsWith(davPrefix)
        ? hrefPath.slice(davPrefix.length)
        : "";
      const syncRootPrefix = `${credentials.remoteFolder.replace(/^\/+/, "")}/`;
      const relativePath = relativePathFromRoot.startsWith(syncRootPrefix)
        ? relativePathFromRoot.slice(syncRootPrefix.length)
        : "";
      if (relativePath) {
        await this.deleteRemoteFile(credentials, relativePath);
      }
    }
  }

  private async writeRemoteManifest(
    credentials: SyncCredentials,
    manifest: SyncManifest,
  ): Promise<void> {
    const response = await this.request({
      url: buildDavUrl(credentials, REMOTE_MANIFEST_FILE_NAME),
      method: "PUT",
      headers: {
        ...buildAuthHeaders(credentials),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(manifest),
    });

    this.assertStatus(
      response,
      [200, 201, 204],
      "manifest-write-failed",
      "Could not update the remote sync manifest.",
    );
  }

  private getKnownLocalTimestamp(config: SyncConfig): number {
    return Math.max(
      toTimestamp(config.lastAppliedRemoteAt),
      toTimestamp(config.lastUploadAt),
    );
  }

  async getPendingSourceChoiceState(): Promise<PendingSourceChoiceState> {
    const config = loadSyncConfig();
    const localRecordCount = await this.getLocalRecordCount();

    if (
      !config.requiresSourceChoice ||
      !config.serverUrl ||
      !config.loginName ||
      !config.userId
    ) {
      return {
        requiresSourceChoice: false,
        localRecordCount,
        remoteDatabaseExists: false,
        remoteLastModified: "",
      };
    }

    const credentials = await this.getCredentials();
    const remoteFile = await this.getRemoteFileInfo(
      credentials,
      REMOTE_DATABASE_FILE_NAME,
    );

    if (!remoteFile.exists) {
      saveSyncConfig({ requiresSourceChoice: false });
      return {
        requiresSourceChoice: false,
        localRecordCount,
        remoteDatabaseExists: false,
        remoteLastModified: "",
      };
    }

    return {
      requiresSourceChoice: true,
      localRecordCount,
      remoteDatabaseExists: true,
      remoteLastModified: remoteFile.lastModified,
    };
  }

  async startLogin(serverUrl: string): Promise<SyncConnectionResult> {
    const currentConfig = loadSyncConfig();
    const normalizedServerUrl = sanitizeServerUrl(
      serverUrl || currentConfig.serverUrl,
    );

    const loginResponse = await this.request({
      url: buildOcsUrl(normalizedServerUrl, "/index.php/login/v2"),
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });

    this.assertStatus(
      loginResponse,
      [200],
      "login-flow-start-failed",
      "Could not start the Nextcloud login flow.",
    );

    const loginPayload = parseJsonResponse<any>(
      loginResponse,
      "Nextcloud returned an invalid login flow response.",
    );

    const loginUrl = String(loginPayload?.login ?? "").trim();
    const pollEndpoint = String(loginPayload?.poll?.endpoint ?? "").trim();
    const pollToken = String(loginPayload?.poll?.token ?? "").trim();
    if (!loginUrl || !pollEndpoint || !pollToken) {
      throw new NextcloudSyncError(
        "login-flow-invalid",
        "Nextcloud returned incomplete login flow details.",
      );
    }

    await platformBridge.openExternal(loginUrl);

    const deadline = Date.now() + LOGIN_FLOW_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const pollResponse = await this.request({
        url: pollEndpoint,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `token=${encodeURIComponent(pollToken)}`,
      });

      if (pollResponse.status === 404) {
        await wait(LOGIN_FLOW_POLL_INTERVAL_MS);
        continue;
      }

      this.assertStatus(
        pollResponse,
        [200],
        "login-flow-poll-failed",
        "The Nextcloud login flow failed.",
      );

      const pollPayload = parseJsonResponse<any>(
        pollResponse,
        "Nextcloud returned invalid login credentials.",
      );

      const resolvedServerUrl = sanitizeServerUrl(
        String(pollPayload?.server ?? normalizedServerUrl),
      );
      const loginName = String(pollPayload?.loginName ?? "").trim();
      const appPassword = String(pollPayload?.appPassword ?? "").trim();
      if (!loginName || !appPassword) {
        throw new NextcloudSyncError(
          "login-flow-invalid",
          "Nextcloud returned incomplete login credentials.",
        );
      }

      const userId = await this.resolveCurrentUserId(
        resolvedServerUrl,
        loginName,
        appPassword,
      );

      const localRecordCount = await this.getLocalRecordCount();

      const provisionalCredentials: SyncCredentials = {
        serverUrl: resolvedServerUrl,
        loginName,
        userId,
        remoteFolder: currentConfig.remoteFolder,
        backupRetention: currentConfig.backupRetention,
        syncPictures: currentConfig.syncPictures,
        appPassword,
      };

      await this.ensureRemoteStructure(provisionalCredentials);
      const remoteFile = await this.getRemoteFileInfo(
        provisionalCredentials,
        REMOTE_DATABASE_FILE_NAME,
      );
      const requiresSourceChoice = remoteFile.exists;

      await platformBridge.invoke("sync:setSecret", appPassword);

      const config = saveSyncConfig({
        enabled: true,
        requiresSourceChoice,
        serverUrl: resolvedServerUrl,
        loginName,
        userId,
        lastSyncAt: "",
        lastUploadAt: "",
        lastAppliedRemoteAt: "",
        lastRemoteUploadedAt: "",
        lastRemoteEtag: "",
        lastError: "",
        lastErrorAt: "",
      });

      clearSyncError();
      return {
        config: loadSyncConfig(),
        requiresSourceChoice,
        localRecordCount,
        remoteDatabaseExists: remoteFile.exists,
        remoteLastModified: remoteFile.lastModified,
      };
    }

    throw new NextcloudSyncError(
      "login-timeout",
      "The Nextcloud login flow timed out. Try again.",
    );
  }

  async disconnect(): Promise<SyncConfig> {
    try {
      const credentials = await this.getCredentials();
      const response = await this.request({
        url: buildOcsUrl(
          credentials.serverUrl,
          "/ocs/v2.php/core/apppassword?format=json",
        ),
        method: "DELETE",
        headers: {
          ...buildAuthHeaders(credentials),
          "OCS-APIRequest": "true",
          Accept: "application/json",
        },
      });

      if (![200, 401, 403, 404].includes(response.status)) {
        console.warn(
          "Nextcloud app password revocation returned",
          response.status,
        );
      }
    } catch (error) {
      console.warn("Failed to revoke Nextcloud app password", error);
    }

    await platformBridge.invoke("sync:clearSecret");
    return clearSyncConfig();
  }

  async getRemoteUpdateCheck(): Promise<RemoteUpdateCheck> {
    const config = loadSyncConfig();
    if (
      !config.enabled ||
      config.requiresSourceChoice ||
      !config.serverUrl ||
      !config.loginName ||
      !config.userId
    ) {
      return {
        enabled: false,
        hasRemoteDatabase: false,
        newerThanLocal: false,
        hasConflict: false,
        manifest: null,
      };
    }

    const credentials = await this.getCredentials();
    const manifest = await this.getRemoteManifest(credentials);
    let effectiveManifest = manifest;
    if (!effectiveManifest) {
      const remoteFile = await this.getRemoteFileInfo(
        credentials,
        REMOTE_DATABASE_FILE_NAME,
      );
      if (!remoteFile.exists) {
        return {
          enabled: true,
          hasRemoteDatabase: false,
          newerThanLocal: false,
          hasConflict: false,
          manifest: null,
        };
      }

      effectiveManifest = await buildManifestFromRemoteFile(remoteFile);
    }

    const remoteTimestamp = toTimestamp(effectiveManifest.uploadedAt);
    const newerThanLocal =
      remoteTimestamp > this.getKnownLocalTimestamp(config);

    return {
      enabled: true,
      hasRemoteDatabase: true,
      newerThanLocal,
      hasConflict: newerThanLocal && config.dirty,
      manifest: effectiveManifest,
    };
  }

  async applyRemoteDatabase(): Promise<SyncConfig> {
    const progressToken = beginSyncProgress(
      "download",
      "sync.progress_download_database",
      8,
    );
    let progressFinished = false;

    try {
      const credentials = await this.getCredentials();
      const remoteManifest = await this.getRemoteManifest(credentials);
      const remotePhotoArchive = credentials.syncPictures
        ? await this.getRemoteFileInfo(
            credentials,
            REMOTE_PHOTO_ARCHIVE_FILE_NAME,
          )
        : null;
      const remotePhotoMode = this.resolveRemotePhotoMode(
        remoteManifest,
        remotePhotoArchive,
      );
      const localPhotoSnapshot =
        credentials.syncPictures && remotePhotoMode === "archive"
          ? await this.captureLocalPhotoSnapshot()
          : new Map<number, string>();
      const remoteFile = await this.getRemoteFileInfo(
        credentials,
        REMOTE_DATABASE_FILE_NAME,
      );
      if (!remoteFile.exists) {
        throw new NextcloudSyncError(
          "remote-database-missing",
          "There is no remote database to restore.",
        );
      }

      const download = await this.downloadFile({
        url: buildDavUrl(credentials, REMOTE_DATABASE_FILE_NAME),
        fileName: `nextcloud-restore-${Date.now()}.db`,
        headers: buildAuthHeaders(credentials),
      });

      this.assertStatus(
        download,
        [200],
        "remote-download-failed",
        "Could not download the remote database.",
      );

      if (!download.path) {
        throw new NextcloudSyncError(
          "remote-download-failed",
          "The remote database download did not return a local file.",
        );
      }

      let photoDownloadPath = "";
      try {
        updateSyncProgress(progressToken, {
          direction: "sync",
          messageKey: "sync.progress_restore_database",
          percent: 38,
        });
        await platformBridge.invoke(
          "sync:replaceDatabaseFromFile",
          download.path,
        );

        if (credentials.syncPictures) {
          if (remotePhotoMode === "archive") {
            if (remotePhotoArchive?.exists) {
              updateSyncProgress(progressToken, {
                direction: "download",
                messageKey: "sync.progress_download_photos",
                percent: 58,
              });
              const photoDownload = await this.downloadFile({
                url: buildDavUrl(credentials, REMOTE_PHOTO_ARCHIVE_FILE_NAME),
                fileName: `nextcloud-restore-${Date.now()}_photos.zip`,
                headers: buildAuthHeaders(credentials),
              });

              this.assertStatus(
                photoDownload,
                [200],
                "remote-download-failed",
                "Could not download the remote photo archive.",
              );

              if (!photoDownload.path) {
                throw new NextcloudSyncError(
                  "remote-download-failed",
                  "The remote photo archive download did not return a local file.",
                );
              }

              photoDownloadPath = photoDownload.path;
              updateSyncProgress(progressToken, {
                direction: "sync",
                messageKey: "sync.progress_restore_photos",
                percent: 76,
              });
              await platformBridge.invoke(
                "photo:restoreArchive",
                photoDownload.path,
                "merge",
              );
            } else {
              updateSyncProgress(progressToken, {
                direction: "sync",
                messageKey: "sync.progress_keep_local_photos",
                percent: 76,
              });
            }
          } else {
            updateSyncProgress(progressToken, {
              direction: "sync",
              messageKey: "sync.progress_restore_photos",
              percent: 76,
            });
            await this.restoreMirrorPhotos(
              credentials,
              remoteManifest,
              progressToken,
            );
          }
        }

        if (localPhotoSnapshot.size > 0) {
          updateSyncProgress(progressToken, {
            direction: "sync",
            messageKey: "sync.progress_restore_missing_photos",
            percent: 90,
          });
          await this.restoreAvailableLocalPhotos(localPhotoSnapshot);
        }
      } finally {
        await platformBridge.invoke("sync:deleteFile", download.path);
        if (photoDownloadPath) {
          await platformBridge.invoke("sync:deleteFile", photoDownloadPath);
        }
      }

      clearSyncError();
      clearSyncDirty();
      const nextConfig = saveSyncConfig({
        dirty: false,
        requiresSourceChoice: false,
        lastAppliedRemoteAt:
          remoteFile.lastModified || new Date().toISOString(),
        lastRemoteUploadedAt:
          remoteFile.lastModified || new Date().toISOString(),
        lastRemoteEtag: remoteFile.etag,
        lastSyncAt: new Date().toISOString(),
      });
      finishSyncProgress(progressToken);
      progressFinished = true;
      return nextConfig;
    } finally {
      if (!progressFinished) {
        clearSyncProgress(progressToken);
      }
    }
  }

  async syncNow(): Promise<SyncManifest> {
    const progressToken = beginSyncProgress(
      "sync",
      "sync.progress_prepare_sync",
      4,
    );
    let progressFinished = false;

    try {
      const credentials = await this.getCredentials();
      await this.ensureRemoteStructure(credentials);

      const existingManifest = await this.getRemoteManifest(credentials);
      const existingRemoteFile = await this.getRemoteFileInfo(
        credentials,
        REMOTE_DATABASE_FILE_NAME,
      );
      const existingRemotePhotoArchive = credentials.syncPictures
        ? await this.getRemoteFileInfo(
            credentials,
            REMOTE_PHOTO_ARCHIVE_FILE_NAME,
          )
        : null;
      const remotePhotoMode = this.resolveRemotePhotoMode(
        existingManifest,
        existingRemotePhotoArchive,
      );
      const referencedPhotoPaths = credentials.syncPictures
        ? await this.getLocalReferencedPhotoPaths()
        : new Set<string>();
      const currentConfig = loadSyncConfig();
      const hasKnownRemoteState =
        currentConfig.lastRemoteEtag.trim().length > 0 ||
        currentConfig.lastRemoteUploadedAt.trim().length > 0;
      if (hasKnownRemoteState) {
        if (!existingRemoteFile.exists) {
          throw new NextcloudSyncError(
            "remote-changed",
            "The remote database changed since your last sync. Download first to avoid overwriting newer changes.",
          );
        }

        const hasRemoteVersionChanged =
          (currentConfig.lastRemoteEtag.trim().length > 0 &&
            existingRemoteFile.etag.trim().length > 0 &&
            existingRemoteFile.etag !== currentConfig.lastRemoteEtag) ||
          (toTimestamp(currentConfig.lastRemoteUploadedAt) > 0 &&
            toTimestamp(existingRemoteFile.lastModified) >
              toTimestamp(currentConfig.lastRemoteUploadedAt));
        if (hasRemoteVersionChanged) {
          throw new NextcloudSyncError(
            "remote-changed",
            "The remote database changed since your last sync. Download first to avoid overwriting newer changes.",
          );
        }
      }

      updateSyncProgress(progressToken, {
        direction: "sync",
        messageKey: "sync.progress_snapshot_database",
        percent: 14,
      });
      const snapshot = await platformBridge.invoke(
        "sync:createDatabaseSnapshot",
      );
      const snapshotPath = String(snapshot?.path ?? "").trim();
      if (!snapshotPath) {
        throw new NextcloudSyncError(
          "snapshot-failed",
          "Could not create a local database snapshot.",
        );
      }

      const uploadToken = formatTimestampForFileName(new Date());
      const tempRemotePath = `.upload-${uploadToken}.db`;
      const tempRemotePhotoPath = buildSiblingPhotoArchivePath(tempRemotePath);
      let localPhotoArchivePath = "";
      let nextPhotoEntries: Record<string, SyncManifestPhotoEntry> =
        remotePhotoMode === "mirror"
          ? (existingManifest?.photoEntries ?? {})
          : {};
      try {
        if (credentials.syncPictures) {
          if (remotePhotoMode === "archive") {
            updateSyncProgress(progressToken, {
              direction: "sync",
              messageKey: "sync.progress_archive_photos",
              percent: 28,
            });
            const photoArchive = await platformBridge.invoke(
              "photo:createTemporaryArchive",
              "nextcloud-photos",
            );
            localPhotoArchivePath = String(photoArchive?.path ?? "").trim();
            if (!localPhotoArchivePath) {
              throw new NextcloudSyncError(
                "snapshot-failed",
                "Could not create a temporary photo archive.",
              );
            }
          } else {
            updateSyncProgress(progressToken, {
              direction: "sync",
              messageKey: "sync.progress_upload_photos",
              percent: 28,
            });
            nextPhotoEntries = await this.syncMirrorPhotos(
              credentials,
              existingManifest,
              referencedPhotoPaths,
              progressToken,
            );
          }
        }

        updateSyncProgress(progressToken, {
          direction: "upload",
          messageKey: "sync.progress_upload_database",
          percent: 44,
        });
        const uploadResponse = await this.uploadFile({
          url: buildDavUrl(credentials, tempRemotePath),
          sourcePath: snapshotPath,
          method: "PUT",
          headers: {
            ...buildAuthHeaders(credentials),
            "Content-Type": "application/octet-stream",
          },
        });

        this.assertStatus(
          uploadResponse,
          [200, 201, 204],
          "upload-failed",
          "Could not upload the database to Nextcloud.",
        );

        if (localPhotoArchivePath) {
          updateSyncProgress(progressToken, {
            direction: "upload",
            messageKey: "sync.progress_upload_photos",
            percent: 58,
          });
          const photoUploadResponse = await this.uploadFile({
            url: buildDavUrl(credentials, tempRemotePhotoPath),
            sourcePath: localPhotoArchivePath,
            method: "PUT",
            headers: {
              ...buildAuthHeaders(credentials),
              "Content-Type": "application/zip",
            },
          });

          this.assertStatus(
            photoUploadResponse,
            [200, 201, 204],
            "upload-failed",
            "Could not upload the photo archive to Nextcloud.",
          );
        }

        if (existingRemoteFile.exists) {
          updateSyncProgress(progressToken, {
            direction: "sync",
            messageKey: "sync.progress_backup_remote_database",
            percent: 72,
          });
          await this.copyRemoteFile(
            credentials,
            REMOTE_DATABASE_FILE_NAME,
            `${REMOTE_BACKUPS_DIRECTORY}/database-${uploadToken}.db`,
          );
        }

        if (localPhotoArchivePath && existingRemotePhotoArchive?.exists) {
          updateSyncProgress(progressToken, {
            direction: "sync",
            messageKey: "sync.progress_backup_remote_photos",
            percent: 78,
          });
          await this.copyRemoteFile(
            credentials,
            REMOTE_PHOTO_ARCHIVE_FILE_NAME,
            buildSiblingPhotoArchivePath(
              `${REMOTE_BACKUPS_DIRECTORY}/database-${uploadToken}.db`,
            ),
          );
        }

        updateSyncProgress(progressToken, {
          direction: "sync",
          messageKey: "sync.progress_publish_remote",
          percent: 86,
        });
        await this.moveRemoteFile(
          credentials,
          tempRemotePath,
          REMOTE_DATABASE_FILE_NAME,
        );

        if (localPhotoArchivePath) {
          await this.moveRemoteFile(
            credentials,
            tempRemotePhotoPath,
            REMOTE_PHOTO_ARCHIVE_FILE_NAME,
          );
        }

        const remoteFile = await this.getRemoteFileInfo(
          credentials,
          REMOTE_DATABASE_FILE_NAME,
        );
        const manifest = await buildManifestFromRemoteFile(remoteFile, {
          photoMode: remotePhotoMode,
          photoRoot: REMOTE_PHOTO_DIRECTORY_NAME,
          photoEntries: remotePhotoMode === "mirror" ? nextPhotoEntries : {},
        });

        updateSyncProgress(progressToken, {
          direction: "sync",
          messageKey: "sync.progress_write_manifest",
          percent: 94,
        });
        await this.writeRemoteManifest(credentials, manifest);

        updateSyncProgress(progressToken, {
          direction: "sync",
          messageKey: "sync.progress_prune_backups",
          percent: 98,
        });
        await this.pruneRemoteBackups(credentials);

        clearSyncError();
        clearSyncDirty();
        saveSyncConfig({
          dirty: false,
          requiresSourceChoice: false,
          lastUploadAt: manifest.uploadedAt,
          lastAppliedRemoteAt: manifest.uploadedAt,
          lastRemoteUploadedAt: manifest.uploadedAt,
          lastRemoteEtag: manifest.etag,
          lastSyncAt: new Date().toISOString(),
        });

        finishSyncProgress(progressToken);
        progressFinished = true;
        return manifest;
      } finally {
        await platformBridge.invoke("sync:deleteFile", snapshotPath);
        if (localPhotoArchivePath) {
          await platformBridge.invoke("sync:deleteFile", localPhotoArchivePath);
        }
        try {
          await this.deleteRemoteFile(credentials, tempRemotePath);
        } catch (error) {
          console.warn("Failed to remove temporary Nextcloud upload", error);
        }
        if (localPhotoArchivePath) {
          try {
            await this.deleteRemoteFile(credentials, tempRemotePhotoPath);
          } catch (error) {
            console.warn(
              "Failed to remove temporary Nextcloud photo upload",
              error,
            );
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nextcloud sync failed.";
      setSyncError(message);
      throw error;
    } finally {
      if (!progressFinished) {
        clearSyncProgress(progressToken);
      }
    }
  }
}

export const nextcloudSync = new NextcloudSyncService();
