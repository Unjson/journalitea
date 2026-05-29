import { platformBridge } from "./platformBridge";
import type {
  PhotoArchiveResult,
  PhotoAssetResult,
  PhotoImportIdMapEntry,
  PhotoSyncImportResult,
  PhotoSelectionResult,
  SyncablePhotoFile,
} from "./photoTypes";

export const photoService = {
  pickImage(): Promise<PhotoSelectionResult> {
    return platformBridge.invoke("photo:pickImage");
  },
  captureImage(): Promise<PhotoSelectionResult> {
    return platformBridge.invoke("photo:captureImage");
  },
  resolveUrl(photoRaw: string): Promise<string> {
    return platformBridge.invoke("photo:resolveUrl", photoRaw);
  },
  finalizeRecordPhoto(
    recordId: number,
    photoRaw: string,
  ): Promise<PhotoAssetResult | null> {
    return platformBridge.invoke(
      "photo:finalizeRecordPhoto",
      recordId,
      photoRaw,
    );
  },
  commitSavedRecordPhoto(
    recordId: number,
    previousPhotoRaw: string,
    nextPhotoRaw: string,
  ): Promise<void> {
    return platformBridge.invoke(
      "photo:commitSavedRecordPhoto",
      recordId,
      previousPhotoRaw,
      nextPhotoRaw,
    );
  },
  discardStagedPhotos(photoRaw: string): Promise<void> {
    return platformBridge.invoke("photo:discardStagedPhotos", photoRaw);
  },
  deleteRecordPhotos(recordId: number): Promise<void> {
    return platformBridge.invoke("photo:deleteRecordPhotos", recordId);
  },
  clearAllPhotos(): Promise<void> {
    return platformBridge.invoke("photo:clearAllPhotos");
  },
  rewriteImportedPhotoRaw(
    photoRaw: string,
    idMapEntries: readonly PhotoImportIdMapEntry[],
  ): Promise<string> {
    return platformBridge.invoke(
      "photo:rewriteImportedPhotoRaw",
      photoRaw,
      idMapEntries,
    );
  },
  createSiblingArchive(databasePath: string): Promise<PhotoArchiveResult> {
    return platformBridge.invoke("photo:createSiblingArchive", databasePath);
  },
  createTemporaryArchive(prefix: string): Promise<PhotoArchiveResult> {
    return platformBridge.invoke("photo:createTemporaryArchive", prefix);
  },
  getSiblingArchive(databasePath: string): Promise<PhotoArchiveResult> {
    return platformBridge.invoke("photo:getSiblingArchive", databasePath);
  },
  restoreArchive(
    archivePath: string,
    mode: "append" | "replace" | "merge",
    idMapEntries: readonly PhotoImportIdMapEntry[] = [],
  ): Promise<PhotoArchiveResult> {
    return platformBridge.invoke(
      "photo:restoreArchive",
      archivePath,
      mode,
      idMapEntries,
    );
  },
  listSyncablePhotos(): Promise<SyncablePhotoFile[]> {
    return platformBridge.invoke("photo:listSyncablePhotos");
  },
  importSyncFile(
    sourcePath: string,
    relativePath: string,
  ): Promise<PhotoSyncImportResult> {
    return platformBridge.invoke(
      "photo:importSyncFile",
      sourcePath,
      relativePath,
    );
  },
  deleteManagedPath(relativePath: string): Promise<void> {
    return platformBridge.invoke("photo:deleteManagedPath", relativePath);
  },
};
