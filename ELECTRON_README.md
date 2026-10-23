# VAVH Studio - Electron Desktop App

A complete Electron desktop application for VAVH Studio management with an integrated browser that supports all websites (Google, YouTube, Facebook, Gmail, etc.) using native BrowserView.

## Prerequisites

- Node.js 16.x or higher
- npm 8.x or higher
- MySQL server running and configured
- Windows 7 or higher (for Windows builds)

## Installation

1. **Clone/Setup the project:**
   ```bash
   cd "n:\Code\Combaine System test 1"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   - Copy `.env.example` to `.env` in the root directory (if needed)
   - Update database credentials in `.env` if using custom values:
   ```
  DB_HOST=localhost
  DB_PORT=3306
  DB_USER=app_user
  DB_PASSWORD=replace-with-a-database-password
  DB_NAME=vavh_main
   ```

## Development

### Start Development Mode

**Option 1: Automatic (Recommended)**
```bash
npm run electron-dev
```
This will:
1. Start Express backend on port 3000
2. Wait for server to be ready
3. Launch Electron app with DevTools open

**Option 2: Manual (Two terminals)**

Terminal 1 - Start backend:
```bash
npm run dev
```

Terminal 2 - Start Electron (wait 2-3 seconds first):
```bash
npm run electron
```

### Available Scripts

```bash
# Development
npm run dev              # Start Express with auto-reload
npm run electron         # Start Electron app
npm run electron-dev     # Start both (recommended)

# Production Build
npm run build           # Build for current platform
npm run build-exe       # Build Windows executable

# Testing
npm test               # Run tests (if configured)
```

## Architecture

### Main Process (Electron)
- **File:** `electron/main.js`
- **Responsibilities:**
  - Window management
  - BrowserView creation and management
  - IPC channel handling
  - Backend server startup
  - App lifecycle management

### Preload Script
- **File:** `electron/preload.js`
- **Responsibilities:**
  - Secure IPC bridge between UI and main process
  - Context isolation for security
  - Expose browser APIs to renderer

### Backend (Express)
- **File:** `server/server.js`
- **Responsibilities:**
  - REST API for admin operations
  - Database connections
  - Session management
  - File uploads

### Frontend (Admin UI)
- **File:** `client/admin/index.html` & `client/admin/main.js`
- **Features:**
  - Management module (Products, Orders, Customers, etc.)
  - Finance module (Dashboard, Investments, Expenses, etc.)
  - Browser module with native site support

## Browser Module Features

### Desktop App Browser (Electron)
- **Uses:** Native Chromium BrowserView (no iframe)
- **Supports:** All websites including:
  - Google Search
  - YouTube
  - Facebook
  - Gmail
  - Reddit
  - Wikipedia
  - And many more...
- **No blocking:** X-Frame-Options and CSP headers don't affect loading
- **Performance:** Separate process for better stability

### Web Browser (Fallback)
- **Uses:** Iframe-based browser (when running on web)
- **Supports:** Sites that allow embedding
- **Fallback:** Opens in new tab for blocked sites

## Building for Distribution

### Build Windows Installer

```bash
npm run build-exe
```

This creates:
- **installer:** `dist/VAVH Studio Setup ${version}.exe`
- **portable:** `dist/VAVH Studio portable-${version}.exe`

### Build Configuration

Edit `electron-builder.yml` to customize:
- App icon
- Installer name
- Certificate signing
- Publishing options

## Security Features

✅ **Context Isolation Enabled**
- Prevents direct access to Node APIs from renderer

✅ **Node Integration Disabled**
- Renderer cannot require modules directly

✅ **Sandbox Enabled**
- BrowserView runs in isolated process

✅ **No Remote Module**
- Prevents remote require usage

✅ **Preload Script Validation**
- Only safe APIs exposed via contextBridge

## Troubleshooting

### Backend doesn't start
```bash
# Check if port 3000 is already in use
netstat -ano | findstr :3000

# Kill process on port 3000 and retry
npm run electron-dev
```

### App crashes on launch
```bash
# Clear Electron cache
rmdir /s %APPDATA%\Electron

# Reinstall dependencies
rm -r node_modules
npm install
```

### Browser not loading websites
1. Check backend is running (should see "[Server]" logs)
2. Check internet connection
3. Try navigating to simpler sites first (google.com)
4. Check browser console (DevTools: Ctrl+Shift+I)

### Database connection errors
```bash
# Verify database is running
# Update .env with correct credentials
DB_HOST=your_host
DB_PORT=3306
DB_USER=your_application_user
DB_PASSWORD=replace-with-a-database-password
DB_NAME=vavh_main

# Restart app
npm run electron-dev
```

## File Structure

```
project-root/
├── electron/
│   ├── main.js           # Electron main process
│   ├── preload.js        # Secure IPC bridge
│   └── .env.example      # Environment template
├── server/
│   ├── server.js         # Express app
│   ├── config/
│   │   └── db.js         # Database config
│   ├── controllers/      # API logic
│   ├── routes/           # API routes
│   └── middleware/       # Auth, etc.
├── client/
│   ├── admin/
│   │   ├── index.html    # Admin UI
│   │   ├── main.js       # Admin logic
│   │   ├── styles.css    # Styling
│   │   └── api.js        # API client
│   └── [other modules]
├── database/
│   ├── schema_vavh_platform.sql
│   └── seed files
├── package.json          # Dependencies
└── electron-builder.yml  # Build config
```

## IPC Channels

Browser module communicates via these IPC channels:

### Available Channels
```javascript
// Create BrowserView
window.electronAPI.browserCreateView()

// Navigate
window.electronAPI.browserNavigate(url)

// Navigation
window.electronAPI.browserBack()
window.electronAPI.browserForward()
window.electronAPI.browserReload()

// Utilities
window.electronAPI.browserStop()
window.electronAPI.browserToggleDevTools()

// Info
window.electronAPI.isElectron()      // Returns true
window.electronAPI.getPlatform()     // e.g., "win32"
window.electronAPI.getVersion()      // App version
```

## Performance Tips

1. **Disable DevTools in Production**
   - Edit `electron/main.js`, remove: `mainWindow.webContents.openDevTools()`

2. **Optimize Assets**
   - Compress images before packaging
   - Minify CSS/JS in production builds

3. **Monitor Memory**
   - BrowserView uses separate process memory
   - Close unused tabs/windows
   - Monitor with Task Manager

## Deployment

### Windows Installation
1. Users download `VAVH Studio Setup ${version}.exe`
2. Run installer
3. Launcher creates shortcuts
4. App auto-starts and loads admin panel

### Updates
To distribute updates:
1. Update version in `package.json`
2. Build new release
3. Create release notes
4. Distribute new installer

## Development Tips

### Working with BrowserView
- BrowserView is separate from main window webContents
- Cannot share CSS/scripts with main window
- Good for displaying external websites
- Bad for shared state (use IPC)

### Adding New IPC Channels

**In `electron/main.js`:**
```javascript
ipcMain.handle('my:channel', async (event, arg) => {
  // Do something
  return { success: true, data: result };
});
```

**In `electron/preload.js`:**
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  myFunction: (arg) => ipcRenderer.invoke('my:channel', arg),
});
```

**In `client/admin/main.js`:**
```javascript
if (window.electronAPI) {
  window.electronAPI.myFunction(arg).then(result => {
    console.log(result);
  });
}
```

## Support & Issues

- Check browser console (DevTools: F12)
- Check main app console for server logs
- Verify database connectivity
- Check firewall/antivirus isn't blocking app

## License

ISC - See LICENSE file

## Version History

### v1.0.0 (Initial Release)
- ✅ Electron desktop app
- ✅ Native BrowserView for blocked websites
- ✅ Admin management panel
- ✅ Finance tracking
- ✅ User authentication
- ✅ Product management
- ✅ Order tracking
