import { eventBus, Events } from './EventBus.js';

/**
 * State - Centralized application state management
 * Observable state with automatic event emission on changes
 */
export class State {
  constructor() {
    this._state = {
      // Date state
      selectedDate: new Date(),
      displayedMonth: new Date().getMonth(),
      displayedYear: new Date().getFullYear(),

      // Content state
      currentNote: '',
      currentTasks: '',
      noteDirty: false,
      tasksDirty: false,

      // Document state
      selectedDocument: null,
      selectedPage: null,
      documentDirty: false,

      // UI state
      viewMode: 'edit', // 'edit' | 'preview' | 'split'
      activePanel: 'tasks', // 'tasks' | 'docs' | 'search'
      settingsVisible: false,
      sidebarWidth: 300,
      docsSidebarWidth: 250,

      // Search state
      searchQuery: '',
      searchResults: [],
      isSearching: false,

      // Settings
      settings: {
        dbFile: null,
        themeIndex: 0,
        themeName: 'Default',
        documents: false,
        spellChecking: true,
        windowState: null,
        leftSideBarWidth: 300,
        docsSideBarWidth: 250
      },

      // App state
      isInitialized: false,
      isLoading: false,
      error: null
    };

    // Track which properties trigger which events
    this._eventMap = {
      selectedDate: Events.DATE_SELECTED,
      displayedMonth: Events.MONTH_CHANGED,
      displayedYear: Events.MONTH_CHANGED,
      currentNote: Events.NOTE_CHANGED,
      noteDirty: Events.NOTE_DIRTY,
      currentTasks: Events.TASKS_CHANGED,
      viewMode: Events.VIEW_MODE_CHANGED,
      activePanel: Events.PANEL_SWITCHED,
      selectedDocument: Events.DOC_SELECTED,
      selectedPage: Events.PAGE_SELECTED,
      settings: Events.SETTINGS_SAVED
    };
  }

  /**
   * Get a state value
   * @param {string} key - State key
   * @returns {*} State value
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Set a state value and emit corresponding event
   * @param {string} key - State key
   * @param {*} value - New value
   */
  set(key, value) {
    const oldValue = this._state[key];

    // Only update if value actually changed
    if (oldValue === value) return;

    this._state[key] = value;

    // Emit event if mapped
    if (this._eventMap[key]) {
      eventBus.emit(this._eventMap[key], { key, value, oldValue });
    }
  }

  /**
   * Update multiple state values at once
   * @param {Object} updates - Object with key-value pairs to update
   */
  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  /**
   * Get the entire state object (read-only copy)
   * @returns {Object} Copy of state
   */
  getAll() {
    return { ...this._state };
  }

  /**
   * Get settings
   * @returns {Object} Settings object
   */
  getSettings() {
    return { ...this._state.settings };
  }

  /**
   * Update settings
   * @param {Object} settings - Settings to merge
   */
  updateSettings(settings) {
    this._state.settings = { ...this._state.settings, ...settings };
    eventBus.emit(Events.SETTINGS_SAVED, this._state.settings);
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean} True if there are unsaved changes
   */
  hasUnsavedChanges() {
    return this._state.noteDirty || this._state.tasksDirty || this._state.documentDirty;
  }

  /**
   * Mark all content as saved
   */
  markAllSaved() {
    this._state.noteDirty = false;
    this._state.tasksDirty = false;
    this._state.documentDirty = false;
  }

  /**
   * Get formatted selected date
   * @param {string} format - 'display' | 'sqlite' | 'iso'
   * @returns {string} Formatted date
   */
  getFormattedDate(format = 'display') {
    const date = this._state.selectedDate;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (format) {
      case 'sqlite':
        return `${year}-${month}-${day}`;
      case 'iso':
        return date.toISOString();
      case 'display':
      default:
        return `${month}/${day}/${year}`;
    }
  }

  /**
   * Set the selected date from various formats
   * @param {Date|string|Object} date - Date to set
   */
  setSelectedDate(date) {
    let newDate;

    if (date instanceof Date) {
      newDate = new Date(date);
    } else if (typeof date === 'string') {
      newDate = new Date(date);
    } else if (date && typeof date === 'object') {
      // Handle {year, month, day} format
      newDate = new Date(date.year, date.month, date.day);
    } else {
      newDate = new Date();
    }

    this.set('selectedDate', newDate);
    this.set('displayedMonth', newDate.getMonth());
    this.set('displayedYear', newDate.getFullYear());
  }

  /**
   * Reset state to defaults
   */
  reset() {
    const today = new Date();
    this._state = {
      selectedDate: today,
      displayedMonth: today.getMonth(),
      displayedYear: today.getFullYear(),
      currentNote: '',
      currentTasks: '',
      noteDirty: false,
      tasksDirty: false,
      selectedDocument: null,
      selectedPage: null,
      documentDirty: false,
      viewMode: 'edit',
      activePanel: 'tasks',
      settingsVisible: false,
      sidebarWidth: 300,
      docsSidebarWidth: 250,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      settings: this._state.settings, // Preserve settings
      isInitialized: false,
      isLoading: false,
      error: null
    };
  }
}

// Create a singleton instance
export const state = new State();
