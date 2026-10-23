const { app, BrowserWindow, ipcMain, Menu, BrowserView } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

let mainWindow;
let browserView;
let serverProcess;
const PORT = process.env.PORT || 3000;
const ALLOWED_BROWSER_HOSTS = new Set([
  'google.com', 'www.google.com', 'bing.com', 'www.bing.com',
  'duckduckgo.com', 'www.duckduckgo.com', 'youtube.com', 'www.youtube.com',
  'wikipedia.org', 'www.wikipedia.org',
]);

function isAllowedBrowserUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return ALLOWED_BROWSER_HOSTS.has(host) || [...ALLOWED_BROWSER_HOSTS].some((allowed) => host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/**
 * Create main application window
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, '../client/img/favicon.png'), // Optional: add app icon
  });

  const startUrl = isDev
    ? 'http://localhost:3000/admin/index.html'
    : `file://${path.join(__dirname, '../client/admin/index.html')}`;

  mainWindow.loadURL(startUrl);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (browserView) {
      browserView.webContents.destroy();
      browserView = null;
    }
  });

  // Set up application menu
  createMenu();
}

/**
 * Create application menu
 */
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Start Express backend server
 */
function startBackendServer() {
  return new Promise((resolve, reject) => {
    console.log('[Electron] Starting Express backend server...');

    const serverPath = path.join(__dirname, '../server/server.js');
    serverProcess = spawn('node', [serverPath], {
      cwd: path.join(__dirname, '..'),
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, PORT },
    });

    serverProcess.stdout.on('data', (data) => {
      console.log('[Server]', data.toString());
      // Check if server is ready
      if (data.toString().includes('listening') || data.toString().includes('3000')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (error) => {
      console.error('[Server Process Error]', error);
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(resolve, 10000);
  });
}

/**
 * Setup IPC Channels for Browser Module
 */
async function ensureBrowserView() {
  if (!mainWindow) {
    throw new Error('Main window is not available');
  }

  if (browserView && browserView.webContents) {
    return browserView;
  }

  if (browserView) {
    mainWindow.removeBrowserView(browserView);
    browserView.webContents.destroy();
    browserView = null;
  }

  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  browserView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  browserView.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedBrowserUrl(url)) event.preventDefault();
  });

  mainWindow.addBrowserView(browserView);
  browserView.setAutoResize({ width: true, height: true });

  const sidebarWidth = 265;
  const topOffset = 180;
  const { width, height } = mainWindow.getContentBounds();
  browserView.setBounds({
    x: sidebarWidth,
    y: topOffset,
    width: Math.max(0, width - sidebarWidth),
    height: Math.max(0, height - topOffset),
  });

  return browserView;
}

function setupBrowserIPC() {
  /**
   * Create BrowserView for embedded website
   */
  ipcMain.handle('browser:create-view', async () => {
    try {
      await ensureBrowserView();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error creating browser view:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Navigate to URL in BrowserView
   */
  ipcMain.handle('browser:navigate', async (event, url) => {
    try {
      await ensureBrowserView();

      if (!browserView || !browserView.webContents) {
        console.error('[IPC] BrowserView not initialized');
        return { success: false, error: 'BrowserView not initialized' };
      }

      let finalUrl = url;
      if (!/^https?:\/\//.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      }

      if (!isAllowedBrowserUrl(finalUrl)) {
        return { success: false, error: 'This destination is not allowed.' };
      }

      console.log('[IPC] Navigating to:', finalUrl);
      await browserView.webContents.loadURL(finalUrl);
      return { success: true, url: finalUrl };
    } catch (error) {
      console.error('[IPC] Navigation error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Go back in browser history
   */
  ipcMain.handle('browser:back', async (event) => {
    try {
      if (browserView && browserView.webContents && browserView.webContents.canGoBack()) {
        browserView.webContents.goBack();
        return { success: true };
      }
      return { success: false, error: 'Cannot go back' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Go forward in browser history
   */
  ipcMain.handle('browser:forward', async (event) => {
    try {
      if (browserView && browserView.webContents && browserView.webContents.canGoForward()) {
        browserView.webContents.goForward();
        return { success: true };
      }
      return { success: false, error: 'Cannot go forward' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Reload current page
   */
  ipcMain.handle('browser:reload', async (event) => {
    try {
      if (browserView && browserView.webContents) {
        browserView.webContents.reload();
        return { success: true };
      }
      return { success: false, error: 'BrowserView not initialized' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Stop loading
   */
  ipcMain.handle('browser:stop', async (event) => {
    try {
      if (browserView && browserView.webContents) {
        browserView.webContents.stop();
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Execute DevTools on BrowserView
   */
  ipcMain.handle('browser:toggle-devtools', async (event) => {
    try {
      if (browserView && browserView.webContents) {
        browserView.webContents.toggleDevTools();
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Resize BrowserView when main window resizes
   */
  if (mainWindow) {
    mainWindow.on('resize', () => {
      if (browserView && browserView.setBounds) {
        const sidebarWidth = 265;
        const topOffset = 180;
        const { width, height } = mainWindow.getContentBounds();
        browserView.setBounds({
          x: sidebarWidth,
          y: topOffset,
          width: Math.max(0, width - sidebarWidth),
          height: Math.max(0, height - topOffset),
        });
      }
    });
  }
}

/**
 * App event handlers
 */
app.on('ready', async () => {
  console.log('[Electron] App ready, starting backend server...');
  
  try {
    // Start Express backend first
    await startBackendServer();
    console.log('[Electron] Backend server started successfully');

    // Small delay to ensure server is ready
    setTimeout(() => {
      createWindow();
      setupBrowserIPC();
    }, 1000);
  } catch (error) {
    console.error('[Electron] Failed to start backend:', error);
    // Still try to create window anyway
    createWindow();
    setupBrowserIPC();
  }
});

app.on('window-all-closed', () => {
  // On macOS, apps stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * Handle app quit
 */
app.on('before-quit', () => {
  // Kill backend server
  if (serverProcess) {
    console.log('[Electron] Stopping backend server...');
    serverProcess.kill();
  }

  // Clean up BrowserView
  if (browserView) {
    if (mainWindow && mainWindow.removeBrowserView) {
      mainWindow.removeBrowserView(browserView);
    }
    browserView.webContents.destroy();
    browserView = null;
  }
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
});
