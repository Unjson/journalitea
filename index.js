const { app, BrowserWindow, Menu } = require('electron/main')

const isDev = process.env.NODE_ENV === 'development'
const VITE_DEV_SERVER_URL = 'http://localhost:5173'

let mainWindow

app.whenReady().then(() => {
  createWindow()
  createMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Create the main application window
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (isDev) {
    // Load from Vite dev server with HMR support
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    // Open DevTools in development mode
    mainWindow.webContents.openDevTools()
  } else {
    // Load from built files in production
    mainWindow.loadFile('dist/index.html')
  }
}

// Create application menu
const createMenu = () => {
  var menu = Menu.buildFromTemplate([
      {
          label: 'Menu',
          submenu: [
            {
              label: 'Home',
                click(){
                  console.log("Navigate to Home");
                  mainWindow.webContents.send('goToHome');
                }
            
              },
            {
              label: 'About',                 
              
               click(){
                console.log("Navigate to About");
                mainWindow.webContents.send('goToAbout');
              }
            },
            {
              label: 'Exit',                 
               click() { 
                app.quit() 
              }
            }
          ]
      }
])
Menu.setApplicationMenu(menu)
}

