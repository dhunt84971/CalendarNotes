/**
 * EventBus - Pub/Sub event system for component communication
 * Allows decoupled communication between components
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event once
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Data to pass to listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   * @param {string} event - Event name (optional, clears all if not provided)
   */
  clear(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).size : 0;
  }
}

// Event name constants for type safety
export const Events = {
  // Date/Calendar events
  DATE_SELECTED: 'date:selected',
  DATE_CHANGED: 'date:changed',
  MONTH_CHANGED: 'month:changed',

  // Notes events
  NOTE_LOADED: 'note:loaded',
  NOTE_CHANGED: 'note:changed',
  NOTE_SAVED: 'note:saved',
  NOTE_DIRTY: 'note:dirty',

  // Tasks events
  TASKS_LOADED: 'tasks:loaded',
  TASKS_CHANGED: 'tasks:changed',
  TASKS_SAVED: 'tasks:saved',

  // Documents events
  DOC_SELECTED: 'doc:selected',
  DOC_LOADED: 'doc:loaded',
  DOC_CHANGED: 'doc:changed',
  DOC_SAVED: 'doc:saved',
  DOC_CREATED: 'doc:created',
  DOC_DELETED: 'doc:deleted',
  DOC_RENAMED: 'doc:renamed',

  // Page events
  PAGE_SELECTED: 'page:selected',
  PAGE_LOADED: 'page:loaded',
  PAGE_CHANGED: 'page:changed',
  PAGE_SAVED: 'page:saved',

  // Search events
  SEARCH_STARTED: 'search:started',
  SEARCH_COMPLETED: 'search:completed',
  SEARCH_RESULT_SELECTED: 'search:resultSelected',

  // UI events
  VIEW_MODE_CHANGED: 'view:modeChanged',
  SIDEBAR_RESIZED: 'sidebar:resized',
  SIDEBAR_TOGGLED: 'sidebar:toggled',
  PANEL_SWITCHED: 'panel:switched',
  THEME_CHANGED: 'theme:changed',
  SETTINGS_OPENED: 'settings:opened',
  SETTINGS_CLOSED: 'settings:closed',
  SETTINGS_SAVED: 'settings:saved',

  // App events
  APP_READY: 'app:ready',
  APP_BEFORE_CLOSE: 'app:beforeClose',
  APP_ERROR: 'app:error',

  // Database events
  DB_CONNECTED: 'db:connected',
  DB_ERROR: 'db:error'
};

// Create a singleton instance for the app
export const eventBus = new EventBus();
