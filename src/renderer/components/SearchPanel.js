/**
 * SearchPanel - Search functionality for notes and documents
 */

import { createElement, $, $$, addEvent, clearChildren, escapeHtml } from '../ui/DOMHelper.js';
import { eventBus, Events } from '../core/EventBus.js';
import { searchService } from '../services/SearchService.js';
import { markdownRenderer } from './MarkdownRenderer.js';
import { state } from '../core/State.js';

export class SearchPanel {
  /**
   * Create a SearchPanel component
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
    this.container = container;
    this.cleanups = [];
    this.lastQuery = '';
    this.previewEl = null;
    this.notesTextareaEl = null;
    this.notesPreviewEl = null;
    this.currentViewMode = 'edit';

    this.init();
  }

  /**
   * Initialize the panel
   */
  init() {
    this.render();
    this.bindEvents();
  }

  /**
   * Render the panel HTML
   */
  render() {
    this.container.innerHTML = `
      <div class="tab-footer"></div>
      <div class="search-panel">
        <div class="search-header">
          <input type="text" class="search-input" placeholder="Search notes...">
          <button class="btn btn-search">GO</button>
        </div>
        <div class="search-results"></div>
      </div>
    `;

    this.inputEl = $('.search-input', this.container);
    this.resultsEl = $('.search-results', this.container);

    // Get references to the notes area elements for preview
    this.notesTextareaEl = $('.notes-textarea');
    this.notesPreviewEl = $('.notes-preview');
    this.notesEditAreaEl = $('.notes-edit-area');
    this.notesPreviewAreaEl = $('.notes-preview-area');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Search button click
    this.cleanups.push(
      addEvent($('.btn-search', this.container), 'click', () => this.search())
    );

    // Enter key in input
    this.cleanups.push(
      addEvent(this.inputEl, 'keydown', (e) => {
        if (e.key === 'Enter') {
          this.search();
        }
      })
    );
  }

  /**
   * Perform search
   */
  async search() {
    const query = this.inputEl.value.trim();

    if (!query) {
      this.clearResults();
      return;
    }

    this.lastQuery = query;

    try {
      const results = await searchService.search(query);
      this.displayResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      this.showError('Search failed');
    }
  }

  /**
   * Display search results
   * @param {Array} results - Search results
   */
  displayResults(results) {
    clearChildren(this.resultsEl);

    if (results.length === 0) {
      this.resultsEl.appendChild(createElement('div', {
        classes: ['search-no-results'],
        text: 'No results found'
      }));
      return;
    }

    results.forEach(result => {
      // Single row item showing just the title (date or doc path)
      const item = createElement('div', {
        classes: ['search-result-item'],
        text: result.title,
        data: {
          type: result.type,
          date: result.date || '',
          path: result.path || '',
          name: result.name || ''
        }
      });

      // Click handler - navigate to the result
      item.addEventListener('click', () => this.handleResultClick(result));

      // Hover handlers - show preview in notes area
      item.addEventListener('mouseenter', () => this.showPreview(result));
      item.addEventListener('mouseleave', () => this.hidePreview());

      this.resultsEl.appendChild(item);
    });
  }

  /**
   * Show preview of result in the notes area
   * @param {Object} result - Search result
   */
  showPreview(result) {
    // Store current state if not already stored
    if (!this.savedTextareaValue) {
      this.savedTextareaValue = this.notesTextareaEl?.value || '';
      this.savedEditDisplay = this.notesEditAreaEl?.style.display || '';
      this.savedPreviewDisplay = this.notesPreviewAreaEl?.style.display || '';
    }

    // Show preview in the notes preview area
    if (this.notesPreviewEl && this.notesPreviewAreaEl) {
      const viewMode = state.get('viewMode');
      const isMarkdownMode = viewMode === 'preview' || viewMode === 'split';
      const text = result.text || '';
      let html;

      if (isMarkdownMode) {
        // Render as markdown
        html = markdownRenderer.render(text);
      } else {
        // Plain text mode - convert line breaks to divs
        html = this.formatPlainText(text);
      }

      // Highlight search terms in the content
      if (result.searchTerms && result.searchTerms.length > 0) {
        html = this.highlightSearchTerms(html, result.searchTerms, isMarkdownMode);
      }

      this.notesPreviewEl.innerHTML = html;

      // Hide edit area, show preview
      if (this.notesEditAreaEl) this.notesEditAreaEl.style.display = 'none';
      this.notesPreviewAreaEl.style.display = 'flex';
    }
  }

  /**
   * Format plain text for display (convert line breaks to HTML)
   * @param {string} text - Plain text
   * @returns {string} HTML formatted text
   */
  formatPlainText(text) {
    if (!text) return '';

    // Wrap each line in a div, similar to original highlightWords function
    let html = '<div>' + escapeHtml(text).replace(/(\r\n|\n|\r)/g, '</div><div>');

    // Remove trailing empty div if present
    if (html.endsWith('<div>')) {
      html = html.slice(0, -5);
    }

    return html;
  }

  /**
   * Highlight search terms in HTML content
   * @param {string} html - HTML content
   * @param {string[]} terms - Search terms to highlight
   * @param {boolean} isMarkdownMode - Whether content is markdown rendered
   * @returns {string} HTML with highlighted terms
   */
  highlightSearchTerms(html, terms, isMarkdownMode = true) {
    // We need to be careful not to replace inside HTML tags
    // Split by tags and only replace in text nodes
    const parts = html.split(/(<[^>]+>)/);

    return parts.map(part => {
      // If it's an HTML tag, leave it alone
      if (part.startsWith('<')) {
        return part;
      }
      // Otherwise, highlight the search terms
      let result = part;
      terms.forEach(term => {
        const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
        result = result.replace(regex, '<span><mark>$1</mark></span>');
      });
      return result;
    }).join('');
  }

  /**
   * Escape special regex characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Hide preview and restore notes area
   */
  hidePreview() {
    // Restore previous state
    if (this.savedTextareaValue !== undefined) {
      if (this.notesEditAreaEl) {
        this.notesEditAreaEl.style.display = this.savedEditDisplay;
      }
      if (this.notesPreviewAreaEl) {
        this.notesPreviewAreaEl.style.display = this.savedPreviewDisplay;
      }
      // Restore the preview content if we were in preview or split mode
      if (this.notesPreviewEl && this.savedPreviewDisplay !== 'none') {
        const viewMode = state.get('viewMode');
        if (viewMode === 'preview' || viewMode === 'split') {
          const html = markdownRenderer.render(this.savedTextareaValue);
          this.notesPreviewEl.innerHTML = html;
        }
      }

      this.savedTextareaValue = undefined;
      this.savedEditDisplay = undefined;
      this.savedPreviewDisplay = undefined;
    }
  }

  /**
   * Handle result click
   * @param {Object} result - Search result
   */
  handleResultClick(result) {
    if (result.type === 'note') {
      // Navigate to the note date
      // Parse date string as local time to avoid timezone issues
      const [year, month, day] = result.date.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      eventBus.emit(Events.DATE_CHANGED, { date });
      eventBus.emit(Events.DATE_SELECTED, { date });
    } else if (result.type === 'document') {
      // Navigate to the document
      eventBus.emit(Events.DOC_SELECTED, {
        path: result.path,
        name: result.name
      });
    }

    eventBus.emit(Events.SEARCH_RESULT_SELECTED, result);
  }

  /**
   * Clear search results
   */
  clearResults() {
    clearChildren(this.resultsEl);
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    clearChildren(this.resultsEl);
    this.resultsEl.appendChild(createElement('div', {
      classes: ['search-error'],
      text: message
    }));
  }

  /**
   * Focus the search input
   */
  focus() {
    this.inputEl?.focus();
  }

  /**
   * Clear search
   */
  clear() {
    if (this.inputEl) {
      this.inputEl.value = '';
    }
    this.clearResults();
    this.lastQuery = '';
  }

  /**
   * Cleanup the component
   */
  destroy() {
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
  }
}
