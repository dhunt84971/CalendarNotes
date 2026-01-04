/**
 * NotesEditor - Text editor component with markdown preview
 */

import { createElement, $, addEvent, show, hide, debounce } from '../ui/DOMHelper.js';
import { eventBus, Events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { notesService } from '../services/NotesService.js';
import { markdownRenderer } from './MarkdownRenderer.js';

export class NotesEditor {
  /**
   * Create a NotesEditor component
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
    this.container = container;
    this.mode = 'edit'; // 'edit' | 'preview' | 'split'
    this.currentDate = null;
    this.isDirty = false;
    this.lastSavedText = '';
    this.cleanups = [];

    this.init();
  }

  /**
   * Initialize the editor
   */
  init() {
    this.render();
    this.bindEvents();
  }

  /**
   * Render the editor HTML
   */
  render() {
    this.container.innerHTML = `
      <div class="notes-editor">
        <div class="notes-header">
          <button class="header-btn maximize-btn" id="maximize-btn" title="Toggle Sidebar">
            <span class="maximize-arrows" id="maximize-arrows">«</span>
          </button>
          <span class="notes-date"></span>
          <button class="header-btn settings-btn" id="settings-btn" title="Settings">
            <img src="./images/settingsIconWht.png" alt="Settings" class="header-icon settings-icon" id="settings-icon">
          </button>
        </div>
        <div class="notes-content">
          <div class="notes-edit-area">
            <textarea class="notes-textarea" placeholder="Enter your notes..."></textarea>
          </div>
          <div class="notes-preview-area" style="display: none;">
            <div class="notes-preview"></div>
          </div>
        </div>
        <div class="notes-toolbar">
          <div class="notes-actions">
            <button class="btn btn-save">SAVE</button>
            <button class="btn btn-mode active" data-mode="edit">EDIT</button>
            <button class="btn btn-mode" data-mode="preview">MARKDOWN</button>
            <button class="btn btn-mode" data-mode="split">SIDE-BY-SIDE</button>
            <button class="btn btn-revert">REVERT</button>
          </div>
        </div>
      </div>
    `;

    // Store references
    this.dateEl = $('.notes-date', this.container);
    this.textareaEl = $('.notes-textarea', this.container);
    this.editAreaEl = $('.notes-edit-area', this.container);
    this.previewAreaEl = $('.notes-preview-area', this.container);
    this.previewEl = $('.notes-preview', this.container);
    this.saveBtn = $('.btn-save', this.container);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Save button
    this.cleanups.push(
      addEvent(this.saveBtn, 'click', () => this.save())
    );

    // Revert button
    this.cleanups.push(
      addEvent($('.btn-revert', this.container), 'click', () => this.revert())
    );

    // Mode buttons
    const modeButtons = this.container.querySelectorAll('.btn-mode');
    modeButtons.forEach(btn => {
      this.cleanups.push(
        addEvent(btn, 'click', () => {
          const mode = btn.dataset.mode;
          this.setMode(mode);
        })
      );
    });

    // Text changes
    this.cleanups.push(
      addEvent(this.textareaEl, 'input', () => {
        this.markDirty();
        if (this.mode === 'split') {
          this.updatePreview();
        }
      })
    );

    // Keyboard shortcuts
    this.cleanups.push(
      addEvent(this.textareaEl, 'keydown', (e) => {
        // Ctrl+S to save
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault();
          this.save();
        }
        // Tab to insert tab character
        if (e.key === 'Tab') {
          e.preventDefault();
          this.insertTab();
        }
      })
    );

    // Scroll sync in split mode
    const debouncedSync = debounce(() => this.syncScroll(), 16);
    this.cleanups.push(
      addEvent(this.textareaEl, 'scroll', debouncedSync)
    );

    // Listen for date selection
    this.cleanups.push(
      eventBus.on(Events.DATE_SELECTED, async ({ date }) => {
        await this.handleDateChange(date);
      })
    );

    // Listen for app close
    this.cleanups.push(
      eventBus.on(Events.APP_BEFORE_CLOSE, async () => {
        if (this.isDirty) {
          await this.save();
        }
      })
    );

    // Listen for theme changes to update markdown icons
    this.cleanups.push(
      eventBus.on(Events.THEME_CHANGED, ({ themeIndex }) => {
        // Themes 5 and 6 (Tron, Clu) use white icons
        markdownRenderer.setWhiteIcons(themeIndex >= 5);
        if (this.mode !== 'edit') {
          this.updatePreview();
        }
      })
    );
  }

  /**
   * Handle date change
   * @param {Date} date - New selected date
   */
  async handleDateChange(date) {
    // Save current note if dirty
    if (this.isDirty && this.currentDate) {
      await this.save();
    }

    // Update current date
    this.currentDate = new Date(date);
    this.updateDateDisplay();

    // Load the note for this date
    await this.loadNote();
  }

  /**
   * Load note for current date
   */
  async loadNote() {
    if (!this.currentDate) return;

    const dateStr = this.formatDate(this.currentDate);

    try {
      const note = await notesService.getByDate(dateStr);
      const text = note?.text || '';

      this.textareaEl.value = text;
      this.lastSavedText = text;
      this.clearDirty();

      if (this.mode !== 'edit') {
        this.updatePreview();
      }

      eventBus.emit(Events.NOTE_LOADED, { date: dateStr, text });
    } catch (error) {
      console.error('Failed to load note:', error);
      this.textareaEl.value = '';
      this.lastSavedText = '';
    }
  }

  /**
   * Save the current note
   */
  async save() {
    if (!this.currentDate) return;

    const dateStr = this.formatDate(this.currentDate);
    const text = this.textareaEl.value;

    try {
      await notesService.save(dateStr, text);
      this.lastSavedText = text;
      this.clearDirty();
    } catch (error) {
      console.error('Failed to save note:', error);
      eventBus.emit(Events.APP_ERROR, { message: 'Failed to save note' });
    }
  }

  /**
   * Revert to last saved version
   */
  revert() {
    this.textareaEl.value = this.lastSavedText;
    this.clearDirty();

    if (this.mode !== 'edit') {
      this.updatePreview();
    }
  }

  /**
   * Set the editor mode
   * @param {string} mode - 'edit' | 'preview' | 'split'
   */
  setMode(mode) {
    this.mode = mode;

    // Update button states
    const modeButtons = this.container.querySelectorAll('.btn-mode');
    modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update layout - use flex display since these are flex containers
    const contentEl = $('.notes-content', this.container);

    switch (mode) {
      case 'edit':
        this.editAreaEl.style.display = 'flex';
        this.previewAreaEl.style.display = 'none';
        contentEl.classList.remove('split-view');
        break;

      case 'preview':
        this.editAreaEl.style.display = 'none';
        this.previewAreaEl.style.display = 'flex';
        contentEl.classList.remove('split-view');
        this.updatePreview();
        break;

      case 'split':
        this.editAreaEl.style.display = 'flex';
        this.previewAreaEl.style.display = 'flex';
        contentEl.classList.add('split-view');
        this.updatePreview();
        break;
    }

    state.set('viewMode', mode);
    eventBus.emit(Events.VIEW_MODE_CHANGED, { mode });
  }

  /**
   * Update the markdown preview
   */
  updatePreview() {
    const text = this.textareaEl.value;
    const html = markdownRenderer.render(text);
    this.previewEl.innerHTML = html;
  }

  /**
   * Sync scroll position between editor and preview
   */
  syncScroll() {
    if (this.mode !== 'split') return;

    const scrollPercent = this.textareaEl.scrollTop /
      (this.textareaEl.scrollHeight - this.textareaEl.clientHeight);

    this.previewEl.scrollTop = scrollPercent *
      (this.previewEl.scrollHeight - this.previewEl.clientHeight);
  }

  /**
   * Insert a tab character at cursor
   */
  insertTab() {
    const start = this.textareaEl.selectionStart;
    const end = this.textareaEl.selectionEnd;
    const text = this.textareaEl.value;

    this.textareaEl.value = text.substring(0, start) + '\t' + text.substring(end);
    this.textareaEl.selectionStart = this.textareaEl.selectionEnd = start + 1;

    this.markDirty();
  }

  /**
   * Mark the editor as having unsaved changes
   */
  markDirty() {
    if (!this.isDirty) {
      this.isDirty = true;
      this.saveBtn.textContent = '*SAVE*';
      this.saveBtn.classList.add('dirty');
      state.set('noteDirty', true);
    }
  }

  /**
   * Clear the dirty state
   */
  clearDirty() {
    this.isDirty = false;
    this.saveBtn.textContent = 'SAVE';
    this.saveBtn.classList.remove('dirty');
    state.set('noteDirty', false);
  }

  /**
   * Update the date display
   */
  updateDateDisplay() {
    if (this.dateEl && this.currentDate) {
      const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(this.currentDate.getDate()).padStart(2, '0');
      const year = this.currentDate.getFullYear();
      this.dateEl.textContent = `${month}/${day}/${year}`;
    }
  }

  /**
   * Format date for database
   * @param {Date} date - Date object
   * @returns {string} YYYY-MM-DD format
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

      if (this.mode !== 'edit') {
        this.updatePreview();
      }
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
