import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { WindowManager } from './WindowManager.js';
import { IPCHandler } from './IPCHandler.js';
import { logger } from './Logger.js';

class CalendarNotesApp {
  constructor() {
    this.windowManager = null;
    this.ipcHandler = null;
  }

  init() {

    // App lifecycle events
    app.on('ready', () => this.onReady());
    app.on('window-all-closed', () => this.onAllWindowsClosed());
    app.on('activate', () => this.onActivate());

    // Security: Disable navigation to external URLs
    app.on('web-contents-created', (event, contents) => {
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol !== 'file:') {
          event.preventDefault();
          shell.openExternal(navigationUrl);
        }
      });

      // Handle new window requests (open in external browser)
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });
    });

    // Capture uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
    });
  }

  onReady() {
    // Initialize the logger (userData path is available after app ready)
    logger.init();
    logger.info('Application ready');

    // Initialize IPC handlers
    this.ipcHandler = new IPCHandler();
    this.ipcHandler.registerHandlers();
    logger.info('IPC handlers registered');

    // Load saved window state from settings
    const savedSettings = this.ipcHandler.loadSettings();
    const windowState = savedSettings?.success ? savedSettings.settings?.windowState : null;
    logger.info('Settings loaded, creating main window');

    // Create and show the main window
    this.windowManager = new WindowManager(this.ipcHandler);
    this.windowManager.createMainWindow(windowState);
    logger.info('Main window created');
  }

  onAllWindowsClosed() {
    // On macOS, apps typically stay open until explicitly quit
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  onActivate() {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      this.windowManager.createMainWindow();
    }
  }
}

// Create and initialize the application
const calendarNotesApp = new CalendarNotesApp();
calendarNotesApp.init();
