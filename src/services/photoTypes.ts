export type PhotoAssetResult = {
  photo: string;
  previewUrl: string;
  path: string;
};

export type PhotoSelectionResult =
  | PhotoAssetResult
  | {
      cancelled: true;
    };

export type PhotoArchiveResult = {
  path: string;
  hasPhotos: boolean;
  exists: boolean;
};

export type PhotoImportIdMapEntry = {
  sourceId: number;
  targetId: number;
};

export type SyncablePhotoFile = {
  relativePath: string;
  contentHash: string;
  byteSize: number;
  sourcePath: string;
};

export type PhotoSyncImportResult = {
  relativePath: string;
  exists: boolean;
};
