const { app, BrowserWindow } = require('electron/main')

const isDev = process.env.NODE_ENV === 'development'
const VITE_DEV_SERVER_URL = 'http://localhost:5173'

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (isDev) {
    // Load from Vite dev server with HMR support
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open DevTools in development mode
    win.webContents.openDevTools()
  } else {
    // Load from built files in production
    win.loadFile('dist/index.html')
  }
}

app.whenReady().then(() => {
  createWindow()
})
