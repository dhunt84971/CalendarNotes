import { screen, BrowserWindow, app, ipcMain, dialog, shell } from "electron";
import { join, dirname } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import Database from "better-sqlite3";
import __cjs_url__ from "node:url";
import __cjs_path__ from "node:path";
import __cjs_mod__ from "node:module";
const __filename = __cjs_url__.fileURLToPath(import.meta.url);
const __dirname = __cjs_path__.dirname(__filename);
const require2 = __cjs_mod__.createRequire(import.meta.url);
class WindowManager {
  constructor(ipcHandler) {
    this.mainWindow = null;
    this.ipcHandler = ipcHandler;
    this.settingsSaved = false;
  }
  createMainWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    this.mainWindow = new BrowserWindow({
      width: Math.min(1200, screenWidth),
      height: Math.min(800, screenHeight),
      minWidth: 800,
      minHeight: 600,
      show: false,
      backgroundColor: "#1a1a2e",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: join(__dirname, "../preload/preload.js"),
        devTools: process.env.NODE_ENV === "development"
      }
    });
    this.mainWindow.setMenu(null);
    if (process.env.NODE_ENV === "development") {
      this.mainWindow.loadURL("http://localhost:5173");
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
    }
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow.show();
    });
    this.mainWindow.on("close", (event) => {
      if (!this.settingsSaved) {
        event.preventDefault();
        this.mainWindow.webContents.send("app:beforeClose");
      }
    });
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });
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
class IPCHandler {
  constructor() {
    this.mainWindow = null;
    this.windowManager = null;
    this.db = null;
    this.settingsPath = join(app.getPath("userData"), "settings.json");
  }
  setMainWindow(window) {
    this.mainWindow = window;
  }
  setWindowManager(windowManager) {
    this.windowManager = windowManager;
  }
  registerHandlers() {
    ipcMain.handle("db:open", (event, dbPath) => this.openDatabase(dbPath));
    ipcMain.handle("db:close", () => this.closeDatabase());
    ipcMain.handle("db:query", (event, sql, params) => this.query(sql, params));
    ipcMain.handle("db:run", (event, sql, params) => this.run(sql, params));
    ipcMain.handle("db:get", (event, sql, params) => this.get(sql, params));
    ipcMain.handle("db:exec", (event, sql) => this.exec(sql));
    ipcMain.handle("dialog:openFile", (event, options) => this.openFileDialog(options));
    ipcMain.handle("dialog:saveFile", (event, options) => this.saveFileDialog(options));
    ipcMain.handle("dialog:showMessage", (event, options) => this.showMessageDialog(options));
    ipcMain.handle("dialog:showConfirm", (event, options) => this.showConfirmDialog(options));
    ipcMain.handle("settings:load", () => this.loadSettings());
    ipcMain.handle("settings:save", (event, settings) => this.saveSettings(settings));
    ipcMain.handle("settings:getPath", () => this.settingsPath);
    ipcMain.handle("window:getState", () => this.windowManager?.getWindowState());
    ipcMain.handle("window:setState", (event, state) => this.windowManager?.restoreWindowState(state));
    ipcMain.on("window:close", () => this.windowManager?.closeWindow());
    ipcMain.on("window:settingsSaved", () => this.windowManager?.markSettingsSaved());
    ipcMain.handle("app:getPath", (event, name) => app.getPath(name));
    ipcMain.handle("app:getVersion", () => app.getVersion());
  }
  // Database methods
  openDatabase(dbPath) {
    try {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        const { mkdirSync } = require2("fs");
        mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(dbPath);
      this.db.pragma("journal_mode = WAL");
      return { success: true };
    } catch (error) {
      console.error("Failed to open database:", error);
      return { success: false, error: error.message };
    }
  }
  closeDatabase() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return { success: true };
  }
  query(sql, params = []) {
    try {
      if (!this.db) throw new Error("Database not open");
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);
      return { success: true, rows };
    } catch (error) {
      console.error("Query error:", error);
      return { success: false, error: error.message, rows: [] };
    }
  }
  run(sql, params = []) {
    try {
      if (!this.db) throw new Error("Database not open");
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        success: true,
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (error) {
      console.error("Run error:", error);
      return { success: false, error: error.message };
    }
  }
  get(sql, params = []) {
    try {
      if (!this.db) throw new Error("Database not open");
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...params);
      return { success: true, row };
    } catch (error) {
      console.error("Get error:", error);
      return { success: false, error: error.message, row: null };
    }
  }
  exec(sql) {
    try {
      if (!this.db) throw new Error("Database not open");
      this.db.exec(sql);
      return { success: true };
    } catch (error) {
      console.error("Exec error:", error);
      return { success: false, error: error.message };
    }
  }
  // Dialog methods
  async openFileDialog(options) {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ["openFile"],
      filters: options?.filters || [{ name: "All Files", extensions: ["*"] }],
      ...options
    });
    return result;
  }
  async saveFileDialog(options) {
    const result = await dialog.showSaveDialog(this.mainWindow, {
      filters: options?.filters || [{ name: "All Files", extensions: ["*"] }],
      ...options
    });
    return result;
  }
  async showMessageDialog(options) {
    const result = await dialog.showMessageBox(this.mainWindow, {
      type: options?.type || "info",
      title: options?.title || "Calendar Notes",
      message: options?.message || "",
      detail: options?.detail,
      buttons: options?.buttons || ["OK"]
    });
    return result;
  }
  async showConfirmDialog(options) {
    const result = await dialog.showMessageBox(this.mainWindow, {
      type: "question",
      title: options?.title || "Confirm",
      message: options?.message || "Are you sure?",
      buttons: ["Yes", "No"],
      defaultId: 1,
      cancelId: 1
    });
    return { confirmed: result.response === 0 };
  }
  // Settings methods
  loadSettings() {
    try {
      if (existsSync(this.settingsPath)) {
        const data = readFileSync(this.settingsPath, "utf-8");
        return { success: true, settings: JSON.parse(data) };
      }
      return { success: true, settings: null };
    } catch (error) {
      console.error("Failed to load settings:", error);
      return { success: false, error: error.message, settings: null };
    }
  }
  saveSettings(settings) {
    try {
      writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
      return { success: true };
    } catch (error) {
      console.error("Failed to save settings:", error);
      return { success: false, error: error.message };
    }
  }
}
class CalendarNotesApp {
  constructor() {
    this.windowManager = null;
    this.ipcHandler = null;
  }
  init() {
    if (require2("electron-squirrel-startup")) {
      app.quit();
      return;
    }
    app.on("ready", () => this.onReady());
    app.on("window-all-closed", () => this.onAllWindowsClosed());
    app.on("activate", () => this.onActivate());
    app.on("web-contents-created", (event, contents) => {
      contents.on("will-navigate", (event2, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol !== "file:") {
          event2.preventDefault();
          shell.openExternal(navigationUrl);
        }
      });
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
      });
    });
  }
  onReady() {
    this.ipcHandler = new IPCHandler();
    this.ipcHandler.registerHandlers();
    this.windowManager = new WindowManager(this.ipcHandler);
    this.windowManager.createMainWindow();
  }
  onAllWindowsClosed() {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }
  onActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.windowManager.createMainWindow();
    }
  }
}
const calendarNotesApp = new CalendarNotesApp();
calendarNotesApp.init();
