import { app, BrowserWindow, ipcMain, Menu, protocol } from "electron";
import fs from "node:fs";
import path from "node:path";
import db from "./src/services/database.js";
import { APP_USER_FOLDER } from "./src/appSettings.js";
import {
  isManagedPhotoPath,
  normalizePhotoRelativePath,
  PHOTO_PREVIEW_PROTOCOL,
  toPlatformPath,
} from "./src/services/photoStorageShared.js";
import { setupIpcHandlers } from "./src/ipcHandlers.js";

const isDev = process.env.NODE_ENV === "development";
const VITE_DEV_SERVER_URL = "http://localhost:5173";

protocol.registerSchemesAsPrivileged([
  {
    scheme: PHOTO_PREVIEW_PROTOCOL,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let allowQuitAfterSync = false;
let syncQuitInFlight = false;
let syncQuitTimeout: NodeJS.Timeout | null = null;

const PHOTO_CONTENT_TYPES: Record<string, string> = {
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const decodeUriComponentSafe = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getManagedPhotoAbsolutePath = (requestUrl: string): string | null => {
  const url = new URL(requestUrl);
  const pathOnlyRelativePath = normalizePhotoRelativePath(
    url.pathname
      .split("/")
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeUriComponentSafe(segment))
      .join("/"),
  );

  const relativePath = isManagedPhotoPath(pathOnlyRelativePath)
    ? pathOnlyRelativePath
    : normalizePhotoRelativePath(
        `${url.host && url.host !== "local" ? `${url.host}/` : ""}${pathOnlyRelativePath}`,
      );

  if (!isManagedPhotoPath(relativePath)) {
    return null;
  }

  const userRoot = path.join(app.getPath("userData"), APP_USER_FOLDER);
  const absolutePath = path.join(userRoot, toPlatformPath(relativePath));
  const relativeToRoot = path.relative(userRoot, absolutePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return absolutePath;
};

const getPhotoContentType = (filePath: string): string =>
  PHOTO_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ??
  "application/octet-stream";

const registerPhotoPreviewProtocol = async (): Promise<void> => {
  await protocol.handle(PHOTO_PREVIEW_PROTOCOL, async (request) => {
    const absolutePath = getManagedPhotoAbsolutePath(request.url);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(fs.readFileSync(absolutePath), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": getPhotoContentType(absolutePath),
      },
    });
  });
};

const finishQuitAfterSync = () => {
  if (syncQuitTimeout) {
    clearTimeout(syncQuitTimeout);
    syncQuitTimeout = null;
  }
  syncQuitInFlight = false;
  allowQuitAfterSync = true;
  app.quit();
};

app.whenReady().then(async () => {
  db.initialize();
  setupIpcHandlers();
  await registerPhotoPreviewProtocol();
  ipcMain.handle("sync:completeBeforeQuit", async () => {
    if (!syncQuitInFlight) return false;
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

  mainWindow.on("close", (event) => {
    if (allowQuitAfterSync || syncQuitInFlight) return;
    event.preventDefault();
    syncQuitInFlight = true;
    syncQuitTimeout = setTimeout(() => {
      finishQuitAfterSync();
    }, 15000);
    mainWindow!.webContents.send("sync:requestBeforeQuit");
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
