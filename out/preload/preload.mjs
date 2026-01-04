import __cjs_url__ from "node:url";
import __cjs_path__ from "node:path";
import __cjs_mod__ from "node:module";
const __filename = __cjs_url__.fileURLToPath(import.meta.url);
const __dirname = __cjs_path__.dirname(__filename);
const require2 = __cjs_mod__.createRequire(import.meta.url);
const { contextBridge, ipcRenderer } = require2("electron");
contextBridge.exposeInMainWorld("api", {
  // Database operations (all use parameterized queries via main process)
  database: {
    open: (dbPath) => ipcRenderer.invoke("db:open", dbPath),
    close: () => ipcRenderer.invoke("db:close"),
    query: (sql, params) => ipcRenderer.invoke("db:query", sql, params),
    run: (sql, params) => ipcRenderer.invoke("db:run", sql, params),
    get: (sql, params) => ipcRenderer.invoke("db:get", sql, params),
    exec: (sql) => ipcRenderer.invoke("db:exec", sql)
  },
  // Dialog operations
  dialog: {
    openFile: (options) => ipcRenderer.invoke("dialog:openFile", options),
    saveFile: (options) => ipcRenderer.invoke("dialog:saveFile", options),
    showMessage: (options) => ipcRenderer.invoke("dialog:showMessage", options),
    showConfirm: (options) => ipcRenderer.invoke("dialog:showConfirm", options)
  },
  // Settings operations
  settings: {
    load: () => ipcRenderer.invoke("settings:load"),
    save: (settings) => ipcRenderer.invoke("settings:save", settings),
    getPath: () => ipcRenderer.invoke("settings:getPath")
  },
  // Window operations
  window: {
    getState: () => ipcRenderer.invoke("window:getState"),
    setState: (state) => ipcRenderer.invoke("window:setState", state),
    close: () => ipcRenderer.send("window:close"),
    markSettingsSaved: () => ipcRenderer.send("window:settingsSaved"),
    onBeforeClose: (callback) => {
      ipcRenderer.on("app:beforeClose", () => callback());
      return () => ipcRenderer.removeAllListeners("app:beforeClose");
    }
  },
  // App information
  app: {
    getPath: (name) => ipcRenderer.invoke("app:getPath", name),
    getVersion: () => ipcRenderer.invoke("app:getVersion")
  }
});
