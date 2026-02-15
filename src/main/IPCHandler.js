import { ipcMain, dialog, app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import Database from 'better-sqlite3';

export class IPCHandler {
  constructor() {
    this.mainWindow = null;
    this.windowManager = null;
    this.db = null;
    this.settingsPath = join(app.getPath('userData'), 'settings.json');
    this.themesDir = join(app.getPath('userData'), 'themes');
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  setWindowManager(windowManager) {
    this.windowManager = windowManager;
  }

  registerHandlers() {
    // Database operations
    ipcMain.handle('db:open', (event, dbPath) => this.openDatabase(dbPath));
    ipcMain.handle('db:close', () => this.closeDatabase());
    ipcMain.handle('db:query', (event, sql, params) => this.query(sql, params));
    ipcMain.handle('db:run', (event, sql, params) => this.run(sql, params));
    ipcMain.handle('db:get', (event, sql, params) => this.get(sql, params));
    ipcMain.handle('db:exec', (event, sql) => this.exec(sql));

    // File dialogs
    ipcMain.handle('dialog:openFile', (event, options) => this.openFileDialog(options));
    ipcMain.handle('dialog:saveFile', (event, options) => this.saveFileDialog(options));
    ipcMain.handle('dialog:showMessage', (event, options) => this.showMessageDialog(options));
    ipcMain.handle('dialog:showConfirm', (event, options) => this.showConfirmDialog(options));

    // Settings
    ipcMain.handle('settings:load', () => this.loadSettings());
    ipcMain.handle('settings:save', (event, settings) => this.saveSettings(settings));
    ipcMain.handle('settings:getPath', () => this.settingsPath);

    // Window management
    ipcMain.handle('window:getState', () => this.windowManager?.getWindowState());
    ipcMain.handle('window:setState', (event, state) => this.windowManager?.restoreWindowState(state));
    ipcMain.on('window:close', () => this.windowManager?.closeWindow());
    ipcMain.on('window:settingsSaved', () => this.windowManager?.markSettingsSaved());

    // Themes
    ipcMain.handle('themes:init', (event, builtInThemes) => this.initThemes(builtInThemes));
    ipcMain.handle('themes:list', () => this.listThemes());
    ipcMain.handle('themes:import', () => this.importTheme());
    ipcMain.handle('themes:export', (event, theme) => this.exportTheme(theme));

    // App info
    ipcMain.handle('app:getPath', (event, name) => app.getPath(name));
    ipcMain.handle('app:getVersion', () => app.getVersion());
  }

  // Database methods
  openDatabase(dbPath) {
    try {
      // Ensure directory exists
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      return { success: true };
    } catch (error) {
      console.error('Failed to open database:', error);
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
      if (!this.db) throw new Error('Database not open');
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);
      return { success: true, rows };
    } catch (error) {
      console.error('Query error:', error);
      return { success: false, error: error.message, rows: [] };
    }
  }

  run(sql, params = []) {
    try {
      if (!this.db) throw new Error('Database not open');
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        success: true,
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (error) {
      console.error('Run error:', error);
      return { success: false, error: error.message };
    }
  }

  get(sql, params = []) {
    try {
      if (!this.db) throw new Error('Database not open');
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...params);
      return { success: true, row };
    } catch (error) {
      console.error('Get error:', error);
      return { success: false, error: error.message, row: null };
    }
  }

  exec(sql) {
    try {
      if (!this.db) throw new Error('Database not open');
      this.db.exec(sql);
      return { success: true };
    } catch (error) {
      console.error('Exec error:', error);
      return { success: false, error: error.message };
    }
  }

  // Dialog methods
  async openFileDialog(options) {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openFile'],
      filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
      ...options
    });
    return result;
  }

  async saveFileDialog(options) {
    const result = await dialog.showSaveDialog(this.mainWindow, {
      filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
      ...options
    });
    return result;
  }

  async showMessageDialog(options) {
    const result = await dialog.showMessageBox(this.mainWindow, {
      type: options?.type || 'info',
      title: options?.title || 'Calendar Notes',
      message: options?.message || '',
      detail: options?.detail,
      buttons: options?.buttons || ['OK']
    });
    return result;
  }

  async showConfirmDialog(options) {
    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'question',
      title: options?.title || 'Confirm',
      message: options?.message || 'Are you sure?',
      buttons: ['Yes', 'No'],
      defaultId: 1,
      cancelId: 1
    });
    return { confirmed: result.response === 0 };
  }

  // Settings methods
  loadSettings() {
    try {
      if (existsSync(this.settingsPath)) {
        const data = readFileSync(this.settingsPath, 'utf-8');
        return { success: true, settings: JSON.parse(data) };
      }
      return { success: true, settings: null };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return { success: false, error: error.message, settings: null };
    }
  }

  saveSettings(settings) {
    try {
      writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Failed to save settings:', error);
      return { success: false, error: error.message };
    }
  }

  // Theme methods
  initThemes(builtInThemes) {
    try {
      if (!existsSync(this.themesDir)) {
        mkdirSync(this.themesDir, { recursive: true });
      }

      for (const theme of builtInThemes) {
        const filePath = join(this.themesDir, `${theme.name}.json`);
        if (!existsSync(filePath)) {
          writeFileSync(filePath, JSON.stringify(theme, null, 2));
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to init themes:', error);
      return { success: false, error: error.message };
    }
  }

  listThemes() {
    try {
      if (!existsSync(this.themesDir)) {
        return { success: true, themes: [] };
      }

      const files = readdirSync(this.themesDir).filter(f => f.endsWith('.json'));
      const themes = [];

      for (const file of files) {
        try {
          const data = readFileSync(join(this.themesDir, file), 'utf-8');
          themes.push(JSON.parse(data));
        } catch (e) {
          console.error(`Failed to parse theme file ${file}:`, e);
        }
      }

      themes.sort((a, b) => a.name.localeCompare(b.name));
      return { success: true, themes };
    } catch (error) {
      console.error('Failed to list themes:', error);
      return { success: false, error: error.message, themes: [] };
    }
  }

  async importTheme() {
    try {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        title: 'Import Theme',
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const data = readFileSync(result.filePaths[0], 'utf-8');
      const theme = JSON.parse(data);

      if (!theme.name || !theme.appBack) {
        return { success: false, error: 'Invalid theme file: missing required properties' };
      }

      // Check if filename differs from the name property inside the JSON
      const fileName = basename(result.filePaths[0], '.json');
      if (fileName !== theme.name) {
        const choice = await dialog.showMessageBox(this.mainWindow, {
          type: 'question',
          title: 'Theme Name Mismatch',
          message: `The filename "${fileName}" does not match the theme name "${theme.name}" inside the file.`,
          detail: `Would you like to rename the theme to "${fileName}"?`,
          buttons: ['Use Filename', 'Keep Original', 'Cancel'],
          defaultId: 0,
          cancelId: 2
        });

        if (choice.response === 2) {
          return { success: false, canceled: true };
        }

        if (choice.response === 0) {
          theme.name = fileName;
        }
      }

      const destPath = join(this.themesDir, `${theme.name}.json`);
      writeFileSync(destPath, JSON.stringify(theme, null, 2));

      return { success: true, theme };
    } catch (error) {
      console.error('Failed to import theme:', error);
      return { success: false, error: error.message };
    }
  }

  async exportTheme(theme) {
    try {
      const result = await dialog.showSaveDialog(this.mainWindow, {
        title: 'Export Theme',
        defaultPath: `${theme.name}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      writeFileSync(result.filePath, JSON.stringify(theme, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Failed to export theme:', error);
      return { success: false, error: error.message };
    }
  }
}
