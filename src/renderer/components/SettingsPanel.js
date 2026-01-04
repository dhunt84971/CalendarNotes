/**
 * SettingsPanel - Settings dialog component
 */

import { $, addEvent, hide, show } from '../ui/DOMHelper.js';
import { eventBus, Events } from '../core/EventBus.js';
import { settingsService } from '../services/SettingsService.js';
import { themeManager } from '../ui/ThemeManager.js';
import { database } from '../database/Database.js';

export class SettingsPanel {
  /**
   * Create a SettingsPanel component
   * @param {HTMLElement} overlay - Settings overlay element
   */
  constructor(overlay) {
    this.overlay = overlay;
    this.cleanups = [];

    this.init();
  }

  /**
   * Initialize the panel
   */
  init() {
    this.cacheElements();
    this.populateThemes();
    this.loadSettings();
    this.loadVersion();
    this.bindEvents();
  }

  /**
   * Load and display the application version
   */
  async loadVersion() {
    if (this.versionInfo) {
      try {
        const version = await window.api.app.getVersion();
        this.versionInfo.textContent = `Version ${version}`;
      } catch (error) {
        console.error('Failed to get version:', error);
        this.versionInfo.textContent = 'Version 2.0.0';
      }
    }
  }

  /**
   * Cache DOM element references
   */
  cacheElements() {
    this.dbPathInput = $('#db-path', this.overlay);
    this.browseBtn = $('#browse-db', this.overlay);
    this.themeSelect = $('#theme-select', this.overlay);
    this.spellCheckInput = $('#spell-check', this.overlay);
    this.docsEnabledInput = $('#docs-enabled', this.overlay);
    this.closeBtn = $('#settings-close', this.overlay);
    this.saveBtn = $('#settings-save', this.overlay);
    this.settingsBtn = $('#settings-btn');
    this.versionInfo = $('#version-info', this.overlay);
  }

  /**
   * Populate theme dropdown
   */
  populateThemes() {
    if (!this.themeSelect) return;

    const themes = themeManager.getThemes();
    this.themeSelect.innerHTML = themes.map((theme, index) =>
      `<option value="${index}">${theme.name}</option>`
    ).join('');
  }

  /**
   * Load current settings into the form
   */
  loadSettings() {
    const settings = settingsService.get();

    if (this.dbPathInput) {
      this.dbPathInput.value = settings.dbFile || settingsService.getDefaultDbPath();
    }

    if (this.themeSelect) {
      this.themeSelect.value = String(settings.themeIndex);
    }

    if (this.spellCheckInput) {
      this.spellCheckInput.checked = settings.spellChecking;
    }

    if (this.docsEnabledInput) {
      this.docsEnabledInput.checked = settings.documents;
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Settings button (open)
    const settingsBtn = document.querySelector('#settings-btn');
    if (settingsBtn) {
      this.cleanups.push(
        addEvent(settingsBtn, 'click', () => this.open())
      );
    }

    // Close button
    if (this.closeBtn) {
      this.cleanups.push(
        addEvent(this.closeBtn, 'click', () => this.close())
      );
    }

    // Click outside to close
    this.cleanups.push(
      addEvent(this.overlay, 'click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      })
    );

    // Escape key to close
    this.cleanups.push(
      addEvent(document, 'keydown', (e) => {
        if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
          this.close();
        }
      })
    );

    // Browse button
    if (this.browseBtn) {
      this.cleanups.push(
        addEvent(this.browseBtn, 'click', () => this.browseDatabase())
      );
    }

    // Theme change - apply immediately
    if (this.themeSelect) {
      this.cleanups.push(
        addEvent(this.themeSelect, 'change', () => {
          const index = parseInt(this.themeSelect.value, 10);
          themeManager.setTheme(index);
        })
      );
    }

    // Save button
    if (this.saveBtn) {
      this.cleanups.push(
        addEvent(this.saveBtn, 'click', () => this.save())
      );
    }
  }

  /**
   * Open the settings panel
   */
  open() {
    this.loadSettings();
    this.overlay.classList.remove('hidden');
    eventBus.emit(Events.SETTINGS_OPENED);
  }

  /**
   * Close the settings panel
   */
  close() {
    this.overlay.classList.add('hidden');
    eventBus.emit(Events.SETTINGS_CLOSED);
  }

  /**
   * Browse for database file
   */
  async browseDatabase() {
    const path = await settingsService.browseDbFile();
    if (path && this.dbPathInput) {
      this.dbPathInput.value = path;
    }
  }

  /**
   * Save settings
   */
  async save() {
    const newSettings = {
      dbFile: this.dbPathInput?.value || null,
      themeIndex: parseInt(this.themeSelect?.value || '0', 10),
      spellChecking: this.spellCheckInput?.checked ?? true,
      documents: this.docsEnabledInput?.checked ?? false
    };

    // Check if database path changed
    const currentSettings = settingsService.get();
    const dbChanged = newSettings.dbFile !== currentSettings.dbFile;

    try {
      await settingsService.update(newSettings);

      // If database path changed, reconnect
      if (dbChanged && newSettings.dbFile) {
        await database.close();
        await database.open(newSettings.dbFile);
      }

      // Apply spell checking
      eventBus.emit(Events.SETTINGS_SAVED, newSettings);

      this.close();

      // Show success message
      await window.api.dialog.showMessage({
        type: 'info',
        title: 'Settings',
        message: 'Settings saved successfully'
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      await window.api.dialog.showMessage({
        type: 'error',
        title: 'Error',
        message: 'Failed to save settings: ' + error.message
      });
    }
  }

  /**
   * Check if settings panel is open
   * @returns {boolean}
   */
  isOpen() {
    return !this.overlay.classList.contains('hidden');
  }

  /**
   * Cleanup the component
   */
  destroy() {
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
  }
}
