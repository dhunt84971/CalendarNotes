/**
 * SettingsService - Service for managing application settings
 */

import { Settings } from '../models/Settings.js';
import { eventBus, Events } from '../core/EventBus.js';
import { state } from '../core/State.js';

export class SettingsService {
  constructor() {
    this.settings = null;
    this.defaultDbPath = null;
  }

  /**
   * Initialize the settings service
   * @returns {Promise<Settings>}
   */
  async init() {
    // Get the user data path for default database location
    const userDataPath = await window.api.app.getPath('userData');
    this.defaultDbPath = `${userDataPath}/calendar-notes.db`;

    // Load settings
    await this.load();

    return this.settings;
  }

  /**
   * Load settings from storage
   * @returns {Promise<Settings>}
   */
  async load() {
    const result = await window.api.settings.load();

    if (result.success && result.settings) {
      this.settings = Settings.fromStored(result.settings);
    } else {
      // Create default settings
      this.settings = Settings.createDefault(this.defaultDbPath);
      await this.save();
    }

    // Update app state
    state.updateSettings(this.settings.toStored());

    return this.settings;
  }

  /**
   * Save settings to storage
   * @returns {Promise<boolean>}
   */
  async save() {
    if (!this.settings) {
      this.settings = Settings.createDefault(this.defaultDbPath);
    }

    const result = await window.api.settings.save(this.settings.toStored());

    if (result.success) {
      eventBus.emit(Events.SETTINGS_SAVED, this.settings);
    }

    return result.success;
  }

  /**
   * Get current settings
   * @returns {Settings}
   */
  get() {
    return this.settings || Settings.createDefault(this.defaultDbPath);
  }

  /**
   * Update settings
   * @param {Object} updates - Settings to update
   * @returns {Promise<Settings>}
   */
  async update(updates) {
    this.settings = this.settings.merge(updates);
    await this.save();
    state.updateSettings(this.settings.toStored());
    return this.settings;
  }

  /**
   * Get the database path
   * @returns {string}
   */
  getDbPath() {
    return this.settings?.getDbPath(this.defaultDbPath) || this.defaultDbPath;
  }

  /**
   * Set the database path
   * @param {string} path - Database file path
   * @returns {Promise<boolean>}
   */
  async setDbPath(path) {
    await this.update({ dbFile: path });
    return true;
  }

  /**
   * Get theme index
   * @returns {number}
   */
  getThemeIndex() {
    return this.settings?.themeIndex ?? 0;
  }

  /**
   * Set theme index
   * @param {number} index - Theme index
   * @returns {Promise<boolean>}
   */
  async setThemeIndex(index) {
    await this.update({ themeIndex: index });
    eventBus.emit(Events.THEME_CHANGED, { themeIndex: index });
    return true;
  }

  /**
   * Get documents feature enabled state
   * @returns {boolean}
   */
  isDocumentsEnabled() {
    return this.settings?.documents ?? false;
  }

  /**
   * Set documents feature enabled state
   * @param {boolean} enabled - Whether documents are enabled
   * @returns {Promise<boolean>}
   */
  async setDocumentsEnabled(enabled) {
    await this.update({ documents: enabled });
    return true;
  }

  /**
   * Get spell checking enabled state
   * @returns {boolean}
   */
  isSpellCheckingEnabled() {
    return this.settings?.spellChecking ?? true;
  }

  /**
   * Set spell checking enabled state
   * @param {boolean} enabled - Whether spell checking is enabled
   * @returns {Promise<boolean>}
   */
  async setSpellCheckingEnabled(enabled) {
    await this.update({ spellChecking: enabled });
    return true;
  }

  /**
   * Get window state
   * @returns {Object|null}
   */
  getWindowState() {
    return this.settings?.windowState || null;
  }

  /**
   * Save window state
   * @param {Object} windowState - Window state to save
   * @returns {Promise<boolean>}
   */
  async saveWindowState(windowState) {
    await this.update({ windowState });
    return true;
  }

  /**
   * Get sidebar widths
   * @returns {{left: number, docs: number}}
   */
  getSidebarWidths() {
    return {
      left: this.settings?.leftSideBarWidth ?? 300,
      docs: this.settings?.docsSideBarWidth ?? 250
    };
  }

  /**
   * Save sidebar widths
   * @param {number} leftWidth - Left sidebar width
   * @param {number} docsWidth - Docs sidebar width
   * @returns {Promise<boolean>}
   */
  async saveSidebarWidths(leftWidth, docsWidth) {
    await this.update({
      leftSideBarWidth: leftWidth,
      docsSideBarWidth: docsWidth
    });
    return true;
  }

  /**
   * Browse for database file
   * @returns {Promise<string|null>} Selected file path or null
   */
  async browseDbFile() {
    const result = await window.api.dialog.openFile({
      title: 'Select Database File',
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }

    return null;
  }

  /**
   * Get default database path
   * @returns {string}
   */
  getDefaultDbPath() {
    return this.defaultDbPath;
  }
}

// Export singleton instance
export const settingsService = new SettingsService();
