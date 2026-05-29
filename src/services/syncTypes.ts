export type SyncHttpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  responseType?: "text" | "json";
};

export type SyncHttpResponse = {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  data: string;
};

export type SyncUploadRequest = {
  url: string;
  sourcePath: string;
  headers?: Record<string, string>;
  method?: string;
};

export type SyncDownloadRequest = {
  url: string;
  fileName?: string;
  headers?: Record<string, string>;
  method?: string;
};

export type SyncFileTransferResponse = SyncHttpResponse & {
  path: string | null;
};

export type SyncPhotoMode = "archive" | "mirror";

export type SyncManifestPhotoEntry = {
  contentHash: string;
  remoteEtag: string;
  byteSize: number;
};

export type SyncManifest = {
  uploadedAt: string;
  etag: string;
  appVersion: string;
  schemaVersion: number;
  sourcePlatform: string;
  deviceLabel: string;
  fileName: string;
  photoMode: SyncPhotoMode;
  photoRoot: string;
  photoEntries: Record<string, SyncManifestPhotoEntry>;
};
