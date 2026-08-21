/**
 * TasksPanel - Persistent task list panel
 */

import { createElement, $, addEvent } from '../ui/DOMHelper.js';
import { eventBus, Events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { tasksService } from '../services/TasksService.js';

export class TasksPanel {
  /**
   * Create a TasksPanel component
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
    this.container = container;
    this.isDirty = false;
    this.lastSavedText = '';
    this.cleanups = [];

    this.init();
  }

  /**
   * Initialize the panel
   */
  init() {
    this.render();
    this.bindEvents();
    this.loadTasks();
  }

  /**
   * Render the panel HTML
   */
  render() {
    // Tasks panel has no header/save button - just the textarea like original
    this.container.innerHTML = `
      <div class="tab-footer"></div>
      <div class="tasks-panel">
        <textarea class="tasks-textarea" placeholder="Enter your tasks..." spellcheck="false"></textarea>
      </div>
    `;

    this.textareaEl = $('.tasks-textarea', this.container);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Text changes - mark dirty for auto-save
    this.cleanups.push(
      addEvent(this.textareaEl, 'input', () => this.markDirty())
    );

    // Keyboard shortcuts
    this.cleanups.push(
      addEvent(this.textareaEl, 'keydown', (e) => {
        // Ctrl+S to save
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault();
          this.save();
        }
      })
    );

    // Flush pending edits when focus leaves the task list. Without this the
    // task list is the only editor whose changes sit in memory indefinitely -
    // it has no SAVE button of its own, so a running app never wrote them out.
    this.cleanups.push(
      addEvent(this.textareaEl, 'blur', () => this.saveIfDirty())
    );

    // Listen for panel switching - the task list stays loaded while another
    // panel is shown, so flush it the same way notes and document pages are.
    this.cleanups.push(
      eventBus.on(Events.PANEL_SWITCHED, () => this.saveIfDirty())
    );

    // Listen for date selection - selecting a date saved notes and tasks
    // together before the refactor; keep tasks in step with that.
    this.cleanups.push(
      eventBus.on(Events.DATE_SELECTED, () => this.saveIfDirty())
    );

    // Listen for an explicit save request (SAVE button / Ctrl+S in the notes
    // editor), which saved the task list too before the refactor.
    this.cleanups.push(
      eventBus.on(Events.TASKS_SAVE_REQUESTED, () => this.saveIfDirty())
    );

    // Listen for app close - auto-save tasks
    this.cleanups.push(
      eventBus.on(Events.APP_BEFORE_CLOSE, () => this.saveIfDirty())
    );

    // Reload tasks when settings change (e.g. database switched)
    this.cleanups.push(
      eventBus.on(Events.SETTINGS_SAVED, () => {
        this.loadTasks();
      })
    );
  }

  /**
   * Load tasks from database
   */
  async loadTasks() {
    try {
      const task = await tasksService.get();
      const text = task?.text || '';

      this.textareaEl.value = text;
      this.lastSavedText = text;
      this.clearDirty();

      eventBus.emit(Events.TASKS_LOADED, { text });
    } catch (error) {
      console.error('Failed to load tasks:', error);
      this.textareaEl.value = '';
      this.lastSavedText = '';
    }
  }

  /**
   * Save tasks to database
   */
  async save() {
    const text = this.textareaEl.value;

    try {
      await tasksService.save(text);
      this.lastSavedText = text;
      this.clearDirty();
    } catch (error) {
      console.error('Failed to save tasks:', error);
      eventBus.emit(Events.APP_ERROR, { message: 'Failed to save tasks' });
    }
  }

  /**
   * Save the task list only if it has unsaved changes
   * @returns {Promise<void>}
   */
  async saveIfDirty() {
    if (this.isDirty) {
      await this.save();
    }
  }

  /**
   * Mark the panel as having unsaved changes
   */
  markDirty() {
    if (!this.isDirty) {
      this.isDirty = true;
      state.set('tasksDirty', true);
    }
  }

  /**
   * Clear the dirty state
   */
  clearDirty() {
    this.isDirty = false;
    state.set('tasksDirty', false);
  }

  /**
   * Get current text
   * @returns {string}
   */
  getText() {
    return this.textareaEl?.value || '';
  }

  /**
   * Set text
   * @param {string} text - Text to set
   */
  setText(text) {
    if (this.textareaEl) {
      this.textareaEl.value = text;
      this.markDirty();
    }
  }

  /**
   * Set spell checking enabled state
   * @param {boolean} enabled - Whether spell checking is enabled
   */
  setSpellCheck(enabled) {
    if (this.textareaEl) {
      this.textareaEl.spellcheck = enabled;
    }
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    return this.isDirty;
  }

  /**
   * Focus the editor
   */
  focus() {
    this.textareaEl?.focus();
  }

  /**
   * Cleanup the component
   */
  destroy() {
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
  }
}
