import { dialog } from "electron";

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

export const pickSaveFilePath = async (): Promise<string | null> => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export database",
      buttonLabel: "Export",
      filters: fileFilters,
      defaultPath: "journalitea.db",
    });
    if (canceled || !filePath) return null;
    if (filePath.match(/\.(db|db3|sqlite|sqlite3)$/i)) return filePath;
    return `${filePath}.db`;
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
