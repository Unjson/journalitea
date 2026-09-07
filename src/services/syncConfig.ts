export const SYNC_CONFIG_STORAGE_KEY = "journalitea.nextcloud.sync.config.v1";
export const SYNC_SECRET_STORAGE_KEY = "journalitea.nextcloud.secret.v1";
export const DEFAULT_NEXTCLOUD_FOLDER = "/journalitea";
export const DEFAULT_NEXTCLOUD_BACKUP_RETENTION = 3;

export type SyncConfig = {
  enabled: boolean;
  syncPictures: boolean;
  requiresSourceChoice: boolean;
  serverUrl: string;
  loginName: string;
  userId: string;
  remoteFolder: string;
  backupRetention: number;
  dirty: boolean;
  dirtyPhotoPaths: string[];
  fullPhotoSyncPending: boolean;
  lastSyncAt: string;
  lastUploadAt: string;
  lastAppliedRemoteAt: string;
  lastRemoteUploadedAt: string;
  lastRemoteEtag: string;
  lastError: string;
  lastErrorAt: string;
};

const hasLocalStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const toStringOrEmpty = (value: unknown): string =>
  typeof value === "string" ? value : "";

export const normalizeRemoteFolder = (value: unknown): string => {
  const trimmed = toStringOrEmpty(value).trim().replace(/\\/g, "/");
  if (!trimmed) {
    return DEFAULT_NEXTCLOUD_FOLDER;
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : "/";
};

const normalizeBackupRetention = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_NEXTCLOUD_BACKUP_RETENTION;
  }

  return Math.min(20, Math.max(0, Math.round(parsed)));
};

const createDefaultSyncConfig = (): SyncConfig => ({
  enabled: false,
  syncPictures: false,
  requiresSourceChoice: false,
  serverUrl: "",
  loginName: "",
  userId: "",
  remoteFolder: DEFAULT_NEXTCLOUD_FOLDER,
  backupRetention: DEFAULT_NEXTCLOUD_BACKUP_RETENTION,
  dirty: false,
  dirtyPhotoPaths: [],
  fullPhotoSyncPending: false,
  lastSyncAt: "",
  lastUploadAt: "",
  lastAppliedRemoteAt: "",
  lastRemoteUploadedAt: "",
  lastRemoteEtag: "",
  lastError: "",
  lastErrorAt: "",
});

const normalizeDirtyPhotoPaths = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = new Set<string>();
  for (const entry of value) {
    const path = toStringOrEmpty(entry).trim();
    if (path) {
      normalized.add(path);
    }
  }
  return Array.from(normalized).sort();
};

const normalizeSyncConfig = (
  value: Partial<SyncConfig> | null | undefined,
): SyncConfig => {
  const defaults = createDefaultSyncConfig();
  const raw = value ?? {};

  return {
    ...defaults,
    enabled: raw.enabled === true,
    syncPictures: raw.syncPictures === true,
    requiresSourceChoice: raw.requiresSourceChoice === true,
    serverUrl: toStringOrEmpty(raw.serverUrl).trim(),
    loginName: toStringOrEmpty(raw.loginName).trim(),
    userId: toStringOrEmpty(raw.userId).trim(),
    remoteFolder: normalizeRemoteFolder(
      raw.remoteFolder ?? defaults.remoteFolder,
    ),
    backupRetention: normalizeBackupRetention(
      raw.backupRetention ?? defaults.backupRetention,
    ),
    dirty: raw.dirty === true,
    dirtyPhotoPaths: normalizeDirtyPhotoPaths(raw.dirtyPhotoPaths),
    fullPhotoSyncPending: raw.fullPhotoSyncPending === true,
    lastSyncAt: toStringOrEmpty(raw.lastSyncAt),
    lastUploadAt: toStringOrEmpty(raw.lastUploadAt),
    lastAppliedRemoteAt: toStringOrEmpty(raw.lastAppliedRemoteAt),
    lastRemoteUploadedAt: toStringOrEmpty(raw.lastRemoteUploadedAt),
    lastRemoteEtag: toStringOrEmpty(raw.lastRemoteEtag),
    lastError: toStringOrEmpty(raw.lastError),
    lastErrorAt: toStringOrEmpty(raw.lastErrorAt),
  };
};

export const loadSyncConfig = (): SyncConfig => {
  if (!hasLocalStorage()) {
    return createDefaultSyncConfig();
  }

  const raw = window.localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
  if (!raw) {
    return createDefaultSyncConfig();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    return normalizeSyncConfig(parsed);
  } catch (error) {
    console.warn("Failed to parse stored Nextcloud sync config", error);
    window.localStorage.removeItem(SYNC_CONFIG_STORAGE_KEY);
    return createDefaultSyncConfig();
  }
};

export const saveSyncConfig = (
  nextConfig: Partial<SyncConfig> | SyncConfig,
): SyncConfig => {
  const normalized = normalizeSyncConfig({
    ...loadSyncConfig(),
    ...nextConfig,
  });

  if (hasLocalStorage()) {
    window.localStorage.setItem(
      SYNC_CONFIG_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  }

  return normalized;
};

export const updateSyncConfig = (
  updater: (current: SyncConfig) => Partial<SyncConfig>,
): SyncConfig => {
  const current = loadSyncConfig();
  return saveSyncConfig({
    ...current,
    ...updater(current),
  });
};

export const clearSyncConfig = (): SyncConfig => {
  if (hasLocalStorage()) {
    window.localStorage.removeItem(SYNC_CONFIG_STORAGE_KEY);
  }
  return createDefaultSyncConfig();
};

export const markSyncDataDirty = (): SyncConfig =>
  updateSyncConfig(() => ({ dirty: true }));

export const clearSyncDirty = (): SyncConfig =>
  updateSyncConfig(() => ({ dirty: false }));

export const markSyncPhotosDirty = (paths: readonly string[]): SyncConfig =>
  updateSyncConfig((current) => ({
    dirtyPhotoPaths: normalizeDirtyPhotoPaths([
      ...current.dirtyPhotoPaths,
      ...paths,
    ]),
  }));

export const clearSyncPhotosDirty = (paths: readonly string[]): SyncConfig => {
  const toClear = new Set(normalizeDirtyPhotoPaths(paths));
  if (toClear.size === 0) {
    return loadSyncConfig();
  }

  return updateSyncConfig((current) => ({
    dirtyPhotoPaths: current.dirtyPhotoPaths.filter(
      (path) => !toClear.has(path),
    ),
  }));
};

export const markFullPhotoSyncPending = (): SyncConfig =>
  updateSyncConfig(() => ({ fullPhotoSyncPending: true }));

export const clearFullPhotoSyncPending = (): SyncConfig =>
  updateSyncConfig(() => ({ fullPhotoSyncPending: false }));

export const setSyncError = (message: string): SyncConfig =>
  updateSyncConfig(() => ({
    lastError: message.trim(),
    lastErrorAt: new Date().toISOString(),
  }));

export const clearSyncError = (): SyncConfig =>
  updateSyncConfig(() => ({ lastError: "", lastErrorAt: "" }));
