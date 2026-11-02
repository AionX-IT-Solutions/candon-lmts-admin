import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

// Set right before quitAndInstall() so the window-close interception below
// steps aside — quitAndInstall needs the app to exit promptly so the NSIS
// installer can replace the running app's files; delaying that close with
// our own async cleanup was silently starving the installer handoff, which
// is why "downloaded" updates weren't actually landing after restart.
let isInstallingUpdate = false

// Keep these legacy renderer keys stable; clear the login on close so each launch starts signed out.
const AUTH_STORAGE_KEYS = ['lis-auth', 'lis-supabase-auth']

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    resizable: true,
    center: true,
    show: false,
    // Frameless: the app draws its own title bar (components/layout/TitleBar.tsx)
    frame: false,
    backgroundColor: '#f0f0f8',
    autoHideMenuBar: true,
    title: 'LMTS - Candon City Legislative Management and Tracking System',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      // Chromium's built-in PDF viewer, which the in-app file viewer (FileViewerModal) uses to
      // show blob: PDF URLs in an <iframe> — as in GSPIS Admin.
      plugins: true
    }
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Dev only: DevTools in its own window (as in GSPIS Admin) so it doesn't squeeze the app
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'undocked' })
    }
  })

  mainWindow.on('close', (e) => {
    if (isInstallingUpdate) return
    e.preventDefault()
    const clear = AUTH_STORAGE_KEYS.map((key) => `localStorage.removeItem('${key}')`).join(';')
    mainWindow.webContents
      .executeJavaScript(clear)
      .catch(() => {})
      .finally(() => mainWindow.destroy())
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function registerWindowIpc(): void {
  const win = (e: Electron.IpcMainEvent) => BrowserWindow.fromWebContents(e.sender)

  ipcMain.handle('app-version', () => app.getVersion())

  // Title bar controls
  ipcMain.on('window-minimize', (e) => win(e)?.minimize())
  ipcMain.on('window-toggle-maximize', (e) => {
    const w = win(e)
    if (w?.isMaximized()) w.unmaximize()
    else w?.maximize()
  })
  ipcMain.on('window-close', (e) => win(e)?.close())

  // Login flow: maximize after sign-in, back to normal size on logout
  ipcMain.on('window-maximize', (e) => win(e)?.maximize())
  ipcMain.on('window-restore-login', (e) => win(e)?.unmaximize())
}

function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info.version)
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded')
  })

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater]', err.message)
    mainWindow.webContents.send('update-error', err.message)
  })

  // Check for updates 5 seconds after launch (only in packaged app)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 5000)
  }
}

ipcMain.on('install-update', () => {
  isInstallingUpdate = true
  autoUpdater.quitAndInstall()
})

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.candon.lis')
  }

  registerWindowIpc()

  const win = createWindow()
  setupAutoUpdater(win)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
