const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose safe IPC channels to renderer process
 * This enables secure communication between the admin UI and main process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Browser module - Create embedded BrowserView
   */
  browserCreateView: () => {
    return ipcRenderer.invoke('browser:create-view');
  },

  /**
   * Browser module - Navigate to URL
   * @param {string} url - URL to navigate to
   */
  browserNavigate: (url) => {
    return ipcRenderer.invoke('browser:navigate', url);
  },

  /**
   * Browser module - Go back in history
   */
  browserBack: () => {
    return ipcRenderer.invoke('browser:back');
  },

  /**
   * Browser module - Go forward in history
   */
  browserForward: () => {
    return ipcRenderer.invoke('browser:forward');
  },

  /**
   * Browser module - Reload current page
   */
  browserReload: () => {
    return ipcRenderer.invoke('browser:reload');
  },

  /**
   * Browser module - Stop loading
   */
  browserStop: () => {
    return ipcRenderer.invoke('browser:stop');
  },

  /**
   * Browser module - Toggle DevTools for BrowserView
   */
  browserToggleDevTools: () => {
    return ipcRenderer.invoke('browser:toggle-devtools');
  },

  /**
   * Check if running in Electron
   */
  isElectron: () => true,

  /**
   * Get platform info
   */
  getPlatform: () => process.platform,

  /**
   * Get app version
   */
  getVersion: () => require('electron').app.getVersion(),
});
