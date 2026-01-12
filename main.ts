import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import db from './src/services/database';

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
          label: 'Home',
          click() {
            console.log('Navigate to Home');
            mainWindow?.webContents.send('goToHome');
          },
        },
        {
          label: 'About',
          click() {
            console.log('Navigate to About');
            mainWindow?.webContents.send('goToAbout');
          },
        },
        {
          label: 'Records List',
          click() {
            console.log('Navigate to Records List');
            mainWindow?.webContents.send('goToRecordsList');
          },
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

// Setup IPC handlers for database operations
const setupIpcHandlers = (): void => {
  ipcMain.handle('db:listRecords', async () => {
    try {
      return db.listRecords();
    } catch (error) {
      console.error('Error listing records:', error);
      throw error;
    }
  });

  ipcMain.handle('db:getRecordById', async (event, id: number) => {
    try {
      return db.getRecordById(id);
    } catch (error) {
      console.error('Error getting record:', error);
      throw error;
    }
  });

  ipcMain.handle('db:saveRecord', async (event, record) => {
    try {
      return db.saveRecord(record);
    } catch (error) {
      console.error('Error saving record:', error);
      throw error;
    }
  });

  ipcMain.handle('db:updateRecord', async (event, record) => {
    try {
      return db.updateRecord(record);
    } catch (error) {
      console.error('Error updating record:', error);
      throw error;
    }
  });
};
