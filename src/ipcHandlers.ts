import { app, ipcMain, shell } from "electron";
import path from "node:path";
import db from "./services/database.js";
import { pickOpenFilePath, pickSaveFilePath } from "./services/fileDialog.js";
import { parseTranslationsFromCSVFile } from "./services/i18n/csvParser.node.js";

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
      return db.deleteRecord(id);
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
      return { success: true, path: destinationPath };
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
        if (payload.mode === "append") {
          db.appendDatabaseRecords(payload.sourcePath);
        } else {
          db.importDatabase(payload.sourcePath);
        }
        return { success: true, mode: payload.mode, path: payload.sourcePath };
      } catch (error) {
        console.error("Error importing database:", error);
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
};
