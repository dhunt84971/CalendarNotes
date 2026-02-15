import { BrowserWindow, screen } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class WindowManager {
  constructor(ipcHandler) {
    this.mainWindow = null;
    this.ipcHandler = ipcHandler;
    this.settingsSaved = false;
  }

  createMainWindow(savedWindowState) {
    // Get primary display dimensions for reasonable defaults
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    // Determine window bounds from saved state or defaults
    const defaults = {
      width: Math.min(1200, screenWidth),
      height: Math.min(800, screenHeight),
    };

    const windowOptions = { ...defaults };

    if (savedWindowState && !savedWindowState.isMaximized) {
      if (savedWindowState.width) windowOptions.width = savedWindowState.width;
      if (savedWindowState.height) windowOptions.height = savedWindowState.height;

      // Only restore position if it's visible on a connected display
      if (savedWindowState.x != null && savedWindowState.y != null) {
        const visible = screen.getAllDisplays().some(display => {
          const { x, y, width, height } = display.bounds;
          return savedWindowState.x >= x && savedWindowState.x < x + width &&
                 savedWindowState.y >= y && savedWindowState.y < y + height;
        });
        if (visible) {
          windowOptions.x = savedWindowState.x;
          windowOptions.y = savedWindowState.y;
        }
      }
    }

    // Create the browser window with secure settings
    this.mainWindow = new BrowserWindow({
      ...windowOptions,
      minWidth: 800,
      minHeight: 600,
      show: false,
      backgroundColor: '#1a1a2e',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: join(__dirname, '../preload/preload.js'),
        devTools: process.env.NODE_ENV === 'development'
      }
    });

    // Remove the default menu
    this.mainWindow.setMenu(null);

    // Load the renderer
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    // Show window when ready, restoring maximized state if needed
    this.mainWindow.once('ready-to-show', () => {
      if (savedWindowState?.isMaximized) {
        this.mainWindow.maximize();
      }
      this.mainWindow.show();
    });

    // Handle close event - prompt to save if needed
    this.mainWindow.on('close', (event) => {
      if (!this.settingsSaved) {
        event.preventDefault();
        this.mainWindow.webContents.send('app:beforeClose');
      }
    });

    // Clean up on close
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Register the window with IPC handler
    this.ipcHandler.setMainWindow(this.mainWindow);
    this.ipcHandler.setWindowManager(this);

    return this.mainWindow;
  }

  getMainWindow() {
    return this.mainWindow;
  }

  markSettingsSaved() {
    this.settingsSaved = true;
  }

  closeWindow() {
    this.settingsSaved = true;
    if (this.mainWindow) {
      this.mainWindow.close();
    }
  }

  getWindowState() {
    if (!this.mainWindow) return null;

    const bounds = this.mainWindow.getBounds();
    const isMaximized = this.mainWindow.isMaximized();

    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    };
  }

  restoreWindowState(state) {
    if (!this.mainWindow || !state) return;

    if (state.isMaximized) {
      this.mainWindow.maximize();
    } else {
      this.mainWindow.setBounds({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height
      });
    }
  }
}
