import { app, ipcMain, shell } from "electron";
import path from "node:path";
import db from "./services/database.js";
import {
  pickImageFilePath,
  pickOpenFilePath,
  pickSaveFilePath,
} from "./services/fileDialog.js";
import { parseTranslationsFromCSVFile } from "./services/i18n/csvParser.node.js";
import { photoStorage } from "./services/photoStorage.node.js";
import { syncSecrets } from "./services/syncSecrets.node.js";
import { syncTransport } from "./services/syncTransport.node.js";
import type {
  SyncDownloadRequest,
  SyncHttpRequest,
  SyncUploadRequest,
} from "./services/syncTypes.js";

// Setup IPC handlers for database operations
export const setupIpcHandlers = (): void => {
  ipcMain.handle("db:listRecords", async (event, year: number | null) => {
    try {
      return db.listRecords(year ?? null);
    } catch (error) {
      console.error("Error listing records:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "db:listRecordsPage",
    async (
      event,
      query: {
        year?: number | null;
        search?: string | null;
        limit: number;
        offset: number;
      },
    ) => {
      try {
        return db.listRecordsPage(query);
      } catch (error) {
        console.error("Error listing paged records:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("db:listRecordYears", async () => {
    try {
      return db.listRecordYears();
    } catch (error) {
      console.error("Error listing record years:", error);
      throw error;
    }
  });

  ipcMain.handle("db:getRecordCount", async () => {
    try {
      return db.getRecordCount();
    } catch (error) {
      console.error("Error counting records:", error);
      throw error;
    }
  });

  ipcMain.handle("db:getRecordById", async (event, id: number) => {
    try {
      return db.getRecordById(id);
    } catch (error) {
      console.error("Error getting record:", error);
      throw error;
    }
  });

  ipcMain.handle("db:saveRecord", async (event, record) => {
    try {
      return db.saveRecord(record);
    } catch (error) {
      console.error("Error saving record:", error);
      throw error;
    }
  });

  ipcMain.handle("db:updateRecord", async (event, record) => {
    try {
      return db.updateRecord(record);
    } catch (error) {
      console.error("Error updating record:", error);
      throw error;
    }
  });

  ipcMain.handle("db:deleteRecord", async (event, id: number) => {
    try {
      db.deleteRecord(id);
      photoStorage.deleteRecordPhotos(id);
      return true;
    } catch (error) {
      console.error("Error deleting record:", error);
      throw error;
    }
  });

  ipcMain.handle("db:getSetting", async (event, key: string) => {
    try {
      return db.getSettingsValue(key);
    } catch (error) {
      console.error("Error getting setting:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "db:setSetting",
    async (
      event,
      key: string,
      intValue: number | null,
      strValue: string | null,
    ) => {
      try {
        return db.setSetingsValue(key, intValue, strValue);
      } catch (error) {
        console.error("Error setting setting:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("db:exportDatabase", async () => {
    try {
      const destinationPath = await pickSaveFilePath();
      if (!destinationPath) return { cancelled: true };
      db.exportDatabase(destinationPath);
      const photoArchive =
        await photoStorage.createSiblingArchive(destinationPath);
      return {
        success: true,
        path: destinationPath,
        photoArchivePath: photoArchive.path,
        hasPhotos: photoArchive.hasPhotos,
      };
    } catch (error) {
      console.error("Error exporting database:", error);
      throw error;
    }
  });

  ipcMain.handle("db:pickDatabaseFile", async () => {
    try {
      const sourcePath = await pickOpenFilePath();
      if (!sourcePath) return { cancelled: true };
      return { path: sourcePath };
    } catch (error) {
      console.error("Error picking database:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "db:importDatabase",
    async (
      event,
      payload: { mode: "append" | "replace"; sourcePath: string },
    ) => {
      try {
        if (!payload?.sourcePath) return { cancelled: true };
        const siblingArchive = photoStorage.getSiblingArchive(
          payload.sourcePath,
        );
        if (payload.mode === "append") {
          const idMapEntries = db.appendDatabaseRecords(payload.sourcePath);
          if (siblingArchive.exists) {
            await photoStorage.restoreArchive(
              siblingArchive.path,
              "append",
              idMapEntries,
            );
          }
        } else {
          db.importDatabase(payload.sourcePath);
          photoStorage.clearAllPhotos();
          if (siblingArchive.exists) {
            await photoStorage.restoreArchive(siblingArchive.path, "replace");
          }
        }
        return {
          success: true,
          mode: payload.mode,
          path: payload.sourcePath,
          photoArchivePath: siblingArchive.exists ? siblingArchive.path : null,
        };
      } catch (error) {
        console.error("Error importing database:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("photo:pickImage", async () => {
    try {
      const sourcePath = await pickImageFilePath();
      if (!sourcePath) {
        return { cancelled: true };
      }
      return photoStorage.stagePhotoFromFile(sourcePath);
    } catch (error) {
      console.error("Error picking photo:", error);
      throw error;
    }
  });

  ipcMain.handle("photo:captureImage", async () => ({ cancelled: true }));

  ipcMain.handle("photo:resolveUrl", async (event, photoRaw: string) => {
    try {
      return photoStorage.resolvePhotoUrl(photoRaw);
    } catch (error) {
      console.error("Error resolving photo URL:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "photo:finalizeRecordPhoto",
    async (event, recordId: number, photoRaw: string) => {
      try {
        return photoStorage.finalizeRecordPhoto(recordId, photoRaw);
      } catch (error) {
        console.error("Error finalizing photo:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "photo:commitSavedRecordPhoto",
    async (
      event,
      recordId: number,
      previousPhotoRaw: string,
      nextPhotoRaw: string,
    ) => {
      try {
        return photoStorage.commitSavedRecordPhoto(
          recordId,
          previousPhotoRaw,
          nextPhotoRaw,
        );
      } catch (error) {
        console.error("Error committing saved photo:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "photo:discardStagedPhotos",
    async (event, photoRaw: string) => {
      try {
        return photoStorage.discardStagedPhotos(photoRaw);
      } catch (error) {
        console.error("Error discarding staged photos:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "photo:deleteRecordPhotos",
    async (event, recordId: number) => {
      try {
        return photoStorage.deleteRecordPhotos(recordId);
      } catch (error) {
        console.error("Error deleting record photos:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("photo:clearAllPhotos", async () => {
    try {
      return photoStorage.clearAllPhotos();
    } catch (error) {
      console.error("Error clearing photos:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "photo:rewriteImportedPhotoRaw",
    async (event, photoRaw: string, idMapEntries) => {
      try {
        return photoStorage.rewriteImportedPhotoRaw(
          photoRaw,
          idMapEntries ?? [],
        );
      } catch (error) {
        console.error("Error remapping imported photo metadata:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "photo:createSiblingArchive",
    async (event, databasePath: string) => {
      try {
        return await photoStorage.createSiblingArchive(databasePath);
      } catch (error) {
        console.error("Error creating photo archive:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "photo:createTemporaryArchive",
    async (event, prefix: string) => {
      try {
        return await photoStorage.createTemporaryArchive(
          prefix || "journalitea-photos",
        );
      } catch (error) {
        console.error("Error creating temporary photo archive:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "photo:getSiblingArchive",
    async (event, databasePath: string) => {
      try {
        return photoStorage.getSiblingArchive(databasePath);
      } catch (error) {
        console.error("Error locating sibling photo archive:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "photo:restoreArchive",
    async (
      event,
      archivePath: string,
      mode: "append" | "replace" | "merge",
      idMapEntries,
    ) => {
      try {
        return await photoStorage.restoreArchive(
          archivePath,
          mode,
          idMapEntries ?? [],
        );
      } catch (error) {
        console.error("Error restoring photo archive:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("i18n:loadTranslations", async () => {
    try {
      const csvPath = path.join(
        app.getAppPath(),
        "src",
        "services",
        "i18n",
        "translations.csv",
      );
      const translations = parseTranslationsFromCSVFile(csvPath);
      return translations;
    } catch (error) {
      console.error("Error loading translations:", error);
      throw error;
    }
  });

  ipcMain.handle("app:getVersion", async () => {
    try {
      return app.getVersion();
    } catch (error) {
      console.error("Error getting app version:", error);
      throw error;
    }
  });

  ipcMain.handle("app:openExternal", async (event, url: string) => {
    try {
      if (!/^https?:\/\//i.test(url ?? "")) {
        throw new Error("Invalid URL");
      }
      await shell.openExternal(url);
      return true;
    } catch (error) {
      console.error("Error opening external URL:", error);
      throw error;
    }
  });

  ipcMain.handle("sync:getSecret", async () => {
    try {
      return syncSecrets.getAppPassword();
    } catch (error) {
      console.error("Error loading sync secret:", error);
      throw error;
    }
  });

  ipcMain.handle("sync:setSecret", async (event, value: string) => {
    try {
      syncSecrets.setAppPassword(value);
      return true;
    } catch (error) {
      console.error("Error storing sync secret:", error);
      throw error;
    }
  });

  ipcMain.handle("sync:clearSecret", async () => {
    try {
      syncSecrets.clearAppPassword();
      return true;
    } catch (error) {
      console.error("Error clearing sync secret:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "sync:httpRequest",
    async (event, options: SyncHttpRequest) => {
      try {
        return await syncTransport.request(options);
      } catch (error) {
        console.error("Error during sync HTTP request:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("sync:createDatabaseSnapshot", async () => {
    try {
      return syncTransport.createDatabaseSnapshot();
    } catch (error) {
      console.error("Error creating sync snapshot:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "sync:replaceDatabaseFromFile",
    async (event, sourcePath: string) => {
      try {
        return syncTransport.replaceDatabaseFromFile(sourcePath);
      } catch (error) {
        console.error("Error replacing database from sync file:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "sync:uploadFile",
    async (event, options: SyncUploadRequest) => {
      try {
        return await syncTransport.uploadFile(options);
      } catch (error) {
        console.error("Error uploading sync file:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "sync:downloadFile",
    async (event, options: SyncDownloadRequest) => {
      try {
        return await syncTransport.downloadFile(options);
      } catch (error) {
        console.error("Error downloading sync file:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("sync:deleteFile", async (event, filePath: string) => {
    try {
      return syncTransport.deleteFile(filePath);
    } catch (error) {
      console.error("Error deleting sync temp file:", error);
      throw error;
    }
  });
};
