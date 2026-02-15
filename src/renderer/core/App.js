/**
 * App - Main application class
 * Bootstraps the application and manages component lifecycle
 */

import { eventBus, Events } from './EventBus.js';
import { state } from './State.js';
import { database } from '../database/Database.js';
import { settingsService } from '../services/SettingsService.js';
import { Calendar } from '../components/Calendar.js';
import { NotesEditor } from '../components/NotesEditor.js';
import { TasksPanel } from '../components/TasksPanel.js';
import { SearchPanel } from '../components/SearchPanel.js';
import { DocumentsPanel } from '../components/DocumentsPanel.js';
import { SettingsPanel } from '../components/SettingsPanel.js';
import { themeManager } from '../ui/ThemeManager.js';
import { $ } from '../ui/DOMHelper.js';

export class App {
  constructor() {
    this.calendar = null;
    this.notesEditor = null;
    this.tasksPanel = null;
    this.searchPanel = null;
    this.documentsPanel = null;
    this.settingsPanel = null;
    this.initialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      console.log('Initializing Calendar Notes...');

      // Initialize settings first
      await settingsService.init();
      const settings = settingsService.get();

      // Initialize and apply theme
      await themeManager.init();
      themeManager.setThemeByName(settings.themeName || 'Default');

      // Connect to database
      const dbPath = settingsService.getDbPath();
      const connected = await database.open(dbPath);

      if (!connected) {
        throw new Error('Failed to connect to database');
      }

      // Initialize UI components
      this.initComponents();

      // Apply spell checking setting
      this.setSpellChecking(settings.spellChecking);

      // Register window close handler
      this.registerCloseHandler();

      // Select today's date
      const today = new Date();
      state.setSelectedDate(today);
      eventBus.emit(Events.DATE_SELECTED, { date: today });

      // Mark as initialized
      this.initialized = true;
      state.set('isInitialized', true);
      eventBus.emit(Events.APP_READY);

      console.log('Calendar Notes initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      eventBus.emit(Events.APP_ERROR, { error });
      await this.showError('Failed to initialize application: ' + error.message);
    }
  }

  /**
   * Initialize UI components
   */
  initComponents() {
    // Calendar
    const calendarContainer = $('#calendar');
    if (calendarContainer) {
      this.calendar = new Calendar(calendarContainer);
    }

    // Notes Editor
    const notesContainer = $('#notes-editor');
    if (notesContainer) {
      this.notesEditor = new NotesEditor(notesContainer);
    }

    // Tasks Panel
    const tasksContainer = $('#tasks-panel');
    if (tasksContainer) {
      this.tasksPanel = new TasksPanel(tasksContainer);
    }

    // Search Panel
    const searchContainer = $('#search-panel');
    if (searchContainer) {
      this.searchPanel = new SearchPanel(searchContainer);
    }

    // Documents Panel
    const docsContainer = $('#docs-panel');
    if (docsContainer && settingsService.isDocumentsEnabled()) {
      this.documentsPanel = new DocumentsPanel(docsContainer);
    }

    // Settings Panel
    const settingsOverlay = $('#settings-panel');
    if (settingsOverlay) {
      this.settingsPanel = new SettingsPanel(settingsOverlay);
    }

    // Set up settings button (in notes header)
    this.initSettingsButton();

    // Set up maximize button (in notes header)
    this.initMaximizeButton();

    // Set up panel tabs
    this.initPanelTabs();

    // Set up sidebar resizing
    this.initSidebarResize();
  }

  /**
   * Initialize panel tab switching
   */
  initPanelTabs() {
    const tabs = document.querySelectorAll('.panel-tab');
    const panels = document.querySelectorAll('.side-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetPanel = tab.dataset.panel;

        // Update tab states
        tabs.forEach(t => t.classList.toggle('active', t === tab));

        // Update panel visibility
        panels.forEach(p => {
          p.classList.toggle('active', p.id === `${targetPanel}-panel`);
        });

        state.set('activePanel', targetPanel);
        eventBus.emit(Events.PANEL_SWITCHED, { panel: targetPanel });
      });
    });
  }

  /**
   * Initialize sidebar resizing
   */
  initSidebarResize() {
    const splitter = $('#sidebar-splitter');
    const sidebar = $('#sidebar');

    if (!splitter || !sidebar) return;

    let startX, startWidth;

    const onMouseMove = (e) => {
      const newWidth = startWidth + (e.clientX - startX);
      if (newWidth >= 200 && newWidth <= 500) {
        sidebar.style.width = `${newWidth}px`;
      }
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Save new width
      const width = parseInt(sidebar.style.width);
      await settingsService.saveSidebarWidths(width, settingsService.getSidebarWidths().docs);
    };

    splitter.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startWidth = parseInt(getComputedStyle(sidebar).width);

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    // Restore saved width
    const { left } = settingsService.getSidebarWidths();
    if (left) {
      sidebar.style.width = `${left}px`;
    }
  }

  /**
   * Initialize settings button in notes header
   */
  initSettingsButton() {
    const settingsBtn = $('#settings-btn');
    const settingsIcon = $('#settings-icon');

    if (settingsBtn && this.settingsPanel) {
      settingsBtn.addEventListener('click', () => {
        this.settingsPanel.show();
      });
    }

    // Update icon based on theme
    this.updateSettingsIcon();

    // Listen for theme changes
    eventBus.on(Events.THEME_CHANGED, () => {
      this.updateSettingsIcon();
    });
  }

  /**
   * Update settings icon based on current theme
   */
  updateSettingsIcon() {
    const settingsIcon = $('#settings-icon');
    if (settingsIcon) {
      // invertedIcons = true means light header, so use black icon
      // invertedIcons = false means dark header, so use white icon
      const useBlack = themeManager.usesInvertedIcons();
      settingsIcon.src = useBlack ? './images/settingsIconBlk.png' : './images/settingsIconWht.png';
    }
  }

  /**
   * Initialize maximize button in notes header
   */
  initMaximizeButton() {
    const maximizeBtn = $('#maximize-btn');
    const maximizeArrows = $('#maximize-arrows');
    const sidebar = $('#sidebar');
    const splitter = $('#sidebar-splitter');
    const notesLabel = $('#notes-label');
    const notesDate = $('#notes-date');

    if (!maximizeBtn || !sidebar) return;

    this.sidebarHidden = false;

    maximizeBtn.addEventListener('click', () => {
      this.sidebarHidden = !this.sidebarHidden;

      if (this.sidebarHidden) {
        sidebar.classList.add('hidden');
        splitter?.classList.add('hidden');
        if (maximizeArrows) maximizeArrows.textContent = '▶';
        // Show date, hide NOTES label
        notesLabel?.classList.add('hidden');
        notesDate?.classList.remove('hidden');
      } else {
        sidebar.classList.remove('hidden');
        splitter?.classList.remove('hidden');
        if (maximizeArrows) maximizeArrows.textContent = '◀';
        // Show NOTES label, hide date
        notesLabel?.classList.remove('hidden');
        notesDate?.classList.add('hidden');
      }

      state.set('sidebarHidden', this.sidebarHidden);
      eventBus.emit(Events.SIDEBAR_TOGGLED, { hidden: this.sidebarHidden });
    });
  }

  /**
   * Register window close handler
   */
  registerCloseHandler() {
    // Listen for close request from main process
    const cleanup = window.api.window.onBeforeClose(async () => {
      // Check for unsaved changes
      if (state.hasUnsavedChanges()) {
        const result = await window.api.dialog.showConfirm({
          title: 'Unsaved Changes',
          message: 'You have unsaved changes. Save before closing?'
        });

        if (result.confirmed) {
          // Save all changes
          eventBus.emit(Events.APP_BEFORE_CLOSE);

          // Wait a moment for saves to complete
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Save settings and window state
      const windowState = await window.api.window.getState();
      if (windowState) {
        await settingsService.saveWindowState(windowState);
      }

      // Close the window
      window.api.window.markSettingsSaved();
      window.api.window.close();
    });

    // Store cleanup function
    this._closeHandlerCleanup = cleanup;
  }

  /**
   * Set spell checking for all text areas
   * @param {boolean} enabled - Whether spell checking is enabled
   */
  setSpellChecking(enabled) {
    this.notesEditor?.setSpellCheck(enabled);
    this.tasksPanel?.setSpellCheck(enabled);
    this.documentsPanel?.setSpellCheck(enabled);
  }

  /**
   * Show an error dialog
   * @param {string} message - Error message
   */
  async showError(message) {
    await window.api.dialog.showMessage({
      type: 'error',
      title: 'Error',
      message
    });
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    return this.notesEditor?.hasUnsavedChanges() ||
           this.tasksPanel?.hasUnsavedChanges() ||
           state.hasUnsavedChanges();
  }

  /**
   * Cleanup the application
   */
  destroy() {
    this.calendar?.destroy();
    this.notesEditor?.destroy();
    this.tasksPanel?.destroy();
    this.searchPanel?.destroy();
    this.documentsPanel?.destroy();
    this.settingsPanel?.destroy();

    if (this._closeHandlerCleanup) {
      this._closeHandlerCleanup();
    }

    database.close();
    eventBus.clear();
  }
}

// Export singleton instance
export const app = new App();
