import { platformBridge } from "./platformBridge";
import { APP_NAME } from "../appSettings";
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
  SyncUploadRequest,
} from "./syncTypes";

const LOGIN_FLOW_POLL_INTERVAL_MS = 1500;
const LOGIN_FLOW_TIMEOUT_MS = 20 * 60 * 1000;
const SYNC_SCHEMA_VERSION = 1;
const REMOTE_DATABASE_FILE_NAME = "database.db";
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
};

type RemoteFileInfo = {
  exists: boolean;
  etag: string;
  lastModified: string;
  isCollection: boolean;
  href: string;
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

const buildManifestFromRemoteFile = async (
  remoteFile: RemoteFileInfo,
): Promise<SyncManifest> => ({
  uploadedAt: remoteFile.lastModified || new Date().toISOString(),
  etag: remoteFile.etag,
  appVersion: String(await platformBridge.invoke("app:getVersion")),
  schemaVersion: SYNC_SCHEMA_VERSION,
  sourcePlatform: platformBridge.isElectron ? "electron" : buildDeviceLabel(),
  deviceLabel: buildDeviceLabel(),
  fileName: REMOTE_DATABASE_FILE_NAME,
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

    return parseJsonResponse<SyncManifest>(
      manifestResponse,
      "The remote sync manifest is invalid.",
    );
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
      const davPrefix = `/remote.php/dav/files/${encodeURIComponent(credentials.userId)}/`;
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
    const credentials = await this.getCredentials();
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

    try {
      await platformBridge.invoke(
        "sync:replaceDatabaseFromFile",
        download.path,
      );
    } finally {
      await platformBridge.invoke("sync:deleteFile", download.path);
    }

    clearSyncError();
    clearSyncDirty();
    return saveSyncConfig({
      dirty: false,
      requiresSourceChoice: false,
      lastAppliedRemoteAt: remoteFile.lastModified || new Date().toISOString(),
      lastRemoteUploadedAt: remoteFile.lastModified || new Date().toISOString(),
      lastRemoteEtag: remoteFile.etag,
      lastSyncAt: new Date().toISOString(),
    });
  }

  async syncNow(): Promise<SyncManifest> {
    const credentials = await this.getCredentials();
    await this.ensureRemoteStructure(credentials);

    const existingRemoteFile = await this.getRemoteFileInfo(
      credentials,
      REMOTE_DATABASE_FILE_NAME,
    );
    const snapshot = await platformBridge.invoke("sync:createDatabaseSnapshot");
    const snapshotPath = String(snapshot?.path ?? "").trim();
    if (!snapshotPath) {
      throw new NextcloudSyncError(
        "snapshot-failed",
        "Could not create a local database snapshot.",
      );
    }

    const uploadToken = formatTimestampForFileName(new Date());
    const tempRemotePath = `.upload-${uploadToken}.db`;
    try {
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

      if (existingRemoteFile.exists) {
        await this.copyRemoteFile(
          credentials,
          REMOTE_DATABASE_FILE_NAME,
          `${REMOTE_BACKUPS_DIRECTORY}/database-${uploadToken}.db`,
        );
      }

      await this.moveRemoteFile(
        credentials,
        tempRemotePath,
        REMOTE_DATABASE_FILE_NAME,
      );

      const remoteFile = await this.getRemoteFileInfo(
        credentials,
        REMOTE_DATABASE_FILE_NAME,
      );
      const manifest = await buildManifestFromRemoteFile(remoteFile);
      await this.writeRemoteManifest(credentials, manifest);
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

      return manifest;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nextcloud sync failed.";
      setSyncError(message);
      throw error;
    } finally {
      await platformBridge.invoke("sync:deleteFile", snapshotPath);
      try {
        await this.deleteRemoteFile(credentials, tempRemotePath);
      } catch (error) {
        console.warn("Failed to remove temporary Nextcloud upload", error);
      }
    }
  }
}

export const nextcloudSync = new NextcloudSyncService();
