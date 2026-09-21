import { app, dialog } from "electron";
import path from "node:path";
import { createTimestampPhotoFileName } from "./photoStorageShared.js";

const fileFilters = [
  {
    name: "SQLite Database",
    extensions: ["db", "db3", "sqlite", "sqlite3"],
  },
  {
    name: "All Files",
    extensions: ["*"],
  },
];

const imageFilters = [
  {
    name: "Images",
    extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"],
  },
  {
    name: "All Files",
    extensions: ["*"],
  },
];

const imageFilePattern = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;

export const pickSaveFilePath = async (): Promise<string | null> => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export database",
      buttonLabel: "Export",
      filters: fileFilters,
      defaultPath: `journalitea-export-${new Date().toISOString().replace(/[:.]/g, "-")}.db`,
    });
    if (canceled || !filePath) return null;
    if (filePath.match(/\.(db|db3|sqlite|sqlite3)$/i)) return filePath;
    return `${filePath}.db`;
  } catch (error) {
    return null;
  }
};

export const pickSavePhotoFilePath = async (
  sourceName: string,
): Promise<string | null> => {
  try {
    const defaultFileName = createTimestampPhotoFileName(
      path.basename(sourceName || "photo"),
      ".jpg",
    );
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Save photo",
      buttonLabel: "Save",
      filters: imageFilters,
      defaultPath: path.join(app.getPath("downloads"), defaultFileName),
    });
    if (canceled || !filePath) return null;
    if (imageFilePattern.test(filePath)) return filePath;
    return `${filePath}${path.extname(defaultFileName) || ".jpg"}`;
  } catch (error) {
    return null;
  }
};

export const pickOpenFilePath = async (): Promise<string | null> => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Import database",
      buttonLabel: "Import",
      filters: fileFilters,
      properties: ["openFile"],
    });
    return canceled ? null : (filePaths?.[0] ?? null);
  } catch (error) {
    return null;
  }
};

export const pickImageFilePath = async (): Promise<string | null> => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Select photo",
      buttonLabel: "Use photo",
      filters: imageFilters,
      properties: ["openFile"],
    });
    return canceled ? null : (filePaths?.[0] ?? null);
  } catch (error) {
    return null;
  }
};
