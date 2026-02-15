/**
 * Settings - Data model for application settings
 */

// Maps old themeIndex values to built-in theme names for backward compatibility
const builtInThemeNames = ['Default','Warm','Cool','Green','Pink','Tron','Clu','Metal','OrangeWave'];

export class Settings {
  constructor(data = {}) {
    // Database settings (SQLite only)
    this.dbFile = data.dbFile || null;

    // UI settings
    this.themeIndex = data.themeIndex ?? 0;
    this.documents = data.documents ?? false;
    this.spellChecking = data.spellChecking ?? true;

    // Migrate themeIndex to themeName if needed
    if (data.themeName) {
      this.themeName = data.themeName;
    } else if (data.themeIndex != null && data.themeIndex >= 0 && data.themeIndex < builtInThemeNames.length) {
      this.themeName = builtInThemeNames[data.themeIndex];
    } else {
      this.themeName = 'Default';
    }

    // Window state
    this.windowState = data.windowState || null;
    this.leftSideBarWidth = data.leftSideBarWidth ?? 300;
    this.docsSideBarWidth = data.docsSideBarWidth ?? 250;

    // View preferences
    this.lastViewMode = data.lastViewMode || 'edit';
    this.lastActivePanel = data.lastActivePanel || 'tasks';
  }

  /**
   * Create Settings from stored data
   * @param {Object} data - Stored settings data
   * @returns {Settings}
   */
  static fromStored(data) {
    if (!data) return new Settings();
    return new Settings(data);
  }

  /**
   * Convert to storable format
   * @returns {Object}
   */
  toStored() {
    return {
      dbFile: this.dbFile,
      themeIndex: this.themeIndex,
      themeName: this.themeName,
      documents: this.documents,
      spellChecking: this.spellChecking,
      windowState: this.windowState,
      leftSideBarWidth: this.leftSideBarWidth,
      docsSideBarWidth: this.docsSideBarWidth,
      lastViewMode: this.lastViewMode,
      lastActivePanel: this.lastActivePanel
    };
  }

  /**
   * Create default settings
   * @param {string} defaultDbPath - Default database path
   * @returns {Settings}
   */
  static createDefault(defaultDbPath = null) {
    return new Settings({
      dbFile: defaultDbPath,
      themeIndex: 0,
      themeName: 'Default',
      documents: false,
      spellChecking: true,
      leftSideBarWidth: 300,
      docsSideBarWidth: 250,
      lastViewMode: 'edit',
      lastActivePanel: 'tasks'
    });
  }

  /**
   * Merge with new settings
   * @param {Object} updates - Settings to merge
   * @returns {Settings}
   */
  merge(updates) {
    return new Settings({
      ...this.toStored(),
      ...updates
    });
  }

  /**
   * Get database file path or default
   * @param {string} defaultPath - Default path if not set
   * @returns {string}
   */
  getDbPath(defaultPath) {
    return this.dbFile || defaultPath;
  }
}
