import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import db from "./src/services/database.js";
import { setupIpcHandlers } from "./src/ipcHandlers.js";

const isDev = process.env.NODE_ENV === "development";
const VITE_DEV_SERVER_URL = "http://localhost:5173";

let mainWindow: BrowserWindow | null = null;
let allowQuitAfterSync = false;
let syncQuitInFlight = false;
let syncQuitTimeout: NodeJS.Timeout | null = null;

const finishQuitAfterSync = () => {
  if (syncQuitTimeout) {
    clearTimeout(syncQuitTimeout);
    syncQuitTimeout = null;
  }
  syncQuitInFlight = false;
  allowQuitAfterSync = true;
  app.quit();
};

app.whenReady().then(() => {
  db.initialize();
  setupIpcHandlers();
  ipcMain.handle("sync:completeBeforeQuit", async () => {
    finishQuitAfterSync();
    return true;
  });
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  db.close();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (allowQuitAfterSync) {
    db.close();
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    db.close();
    return;
  }

  event.preventDefault();
  if (syncQuitInFlight) {
    return;
  }

  syncQuitInFlight = true;
  syncQuitTimeout = setTimeout(() => {
    finishQuitAfterSync();
  }, 15000);
  mainWindow.webContents.send("sync:requestBeforeQuit");
});

// Create the main application window
const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {
    // Load from the Vite dev server with HMR support
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    // Open DevTools in development mode
    mainWindow.webContents.openDevTools();
  } else {
    // Load from built files in production
    mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
};
