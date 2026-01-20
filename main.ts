import { app, BrowserWindow, Menu } from 'electron';
import db from './src/services/database.js';
import { setupIpcHandlers } from './src/ipcHandlers.js';

const isDev = process.env.NODE_ENV === 'development';
const VITE_DEV_SERVER_URL = 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  db.initialize();
  setupIpcHandlers();
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  db.close();
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
    // Load from Vite dev server with HMR support
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    // Open DevTools in development mode
    mainWindow.webContents.openDevTools();
  } else {
    // Load from built files in production
    mainWindow.loadFile('dist/index.html');
  }
};

// Create application menu
const createMenu = (): void => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Menu',
      submenu: [
        {
          label: 'Records List',
          click() {
            mainWindow?.webContents.send('goToRecordsList');
          }
        },
        {
          label: 'Stats for Nerds',
          click() {
            mainWindow?.webContents.send('goToStats');
          }
        },
        {
          label: 'Settings',
          click() {
            mainWindow?.webContents.send('goToSettings');
          }
        },
        {
          label: 'About',
          click() {
            mainWindow?.webContents.send('goToAbout');
          }
        },
        {
          label: 'Exit',
          click() {
            app.quit();
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
};
