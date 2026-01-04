/**
 * SearchService - Service for full-text search across notes and documents
 */

import { notesService } from './NotesService.js';
import { documentsService } from './DocumentsService.js';
import { eventBus, Events } from '../core/EventBus.js';

export class SearchService {
  /**
   * Parse search query into terms
   * @param {string} query - Search query
   * @returns {string[]} Array of search terms
   */
  parseQuery(query) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    // Split by whitespace, filter empty strings
    return query
      .trim()
      .split(/\s+/)
      .filter(term => term.length > 0);
  }

  /**
   * Search notes and documents
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {boolean} options.searchNotes - Search in notes (default true)
   * @param {boolean} options.searchDocs - Search in documents (default true)
   * @returns {Promise<SearchResult[]>}
   */
  async search(query, options = {}) {
    const {
      searchNotes = true,
      searchDocs = true
    } = options;

    const terms = this.parseQuery(query);

    if (terms.length === 0) {
      eventBus.emit(Events.SEARCH_COMPLETED, { results: [], query });
      return [];
    }

    eventBus.emit(Events.SEARCH_STARTED, { query, terms });

    const results = [];

    // Search documents first (like original)
    if (searchDocs) {
      const docResults = await documentsService.search(terms);
      results.push(...docResults.map(r => ({
        type: 'document',
        path: r.path,
        name: r.name,
        title: `${r.path} > ${r.name}`,
        text: r.text,
        preview: r.preview,
        searchTerms: terms
      })));
    }

    // Search notes second
    if (searchNotes) {
      const noteResults = await notesService.search(terms);
      results.push(...noteResults.map(r => ({
        type: 'note',
        date: r.date,
        title: this.formatDate(r.date),
        text: r.text,
        preview: r.preview,
        searchTerms: terms
      })));
    }

    eventBus.emit(Events.SEARCH_COMPLETED, { results, query, terms });
    return results;
  }

  /**
   * Format date for display
   * @param {string} dateStr - Date string (YYYY-MM-DD)
   * @returns {string} Formatted date (MM/DD/YYYY)
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  /**
   * Highlight search terms in text
   * @param {string} text - Text to highlight
   * @param {string[]} terms - Terms to highlight
   * @param {string} highlightTag - HTML tag to use for highlighting
   * @returns {string} Text with highlighted terms
   */
  highlightTerms(text, terms, highlightTag = 'mark') {
    if (!text || !terms || terms.length === 0) {
      return text || '';
    }

    let result = text;

    terms.forEach(term => {
      const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
      result = result.replace(regex, `<${highlightTag}>$1</${highlightTag}>`);
    });

    return result;
  }

  /**
   * Create a preview with search terms highlighted
   * @param {string} text - Full text
   * @param {string[]} terms - Search terms
   * @param {number} maxLength - Maximum preview length
   * @returns {string} Preview with highlighting
   */
  createHighlightedPreview(text, terms, maxLength = 200) {
    if (!text) return '';

    // Find the first occurrence of any search term
    let firstIndex = text.length;
    terms.forEach(term => {
      const index = text.toLowerCase().indexOf(term.toLowerCase());
      if (index !== -1 && index < firstIndex) {
        firstIndex = index;
      }
    });

    // Calculate preview start and end
    let start = Math.max(0, firstIndex - 50);
    let end = Math.min(text.length, start + maxLength);

    // Adjust start if we're not at the beginning
    if (start > 0) {
      // Find the next space to avoid cutting words
      const spaceIndex = text.indexOf(' ', start);
      if (spaceIndex !== -1 && spaceIndex < start + 20) {
        start = spaceIndex + 1;
      }
    }

    // Get the preview text
    let preview = text.substring(start, end);

    // Add ellipsis if needed
    if (start > 0) {
      preview = '...' + preview;
    }
    if (end < text.length) {
      preview = preview + '...';
    }

    // Highlight the terms
    return this.highlightTerms(preview, terms);
  }

  /**
   * Escape special regex characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Search result type
 * @typedef {Object} SearchResult
 * @property {'note'|'document'} type - Result type
 * @property {string} [date] - Note date (for notes)
 * @property {string} [path] - Document path (for documents)
 * @property {string} [name] - Page name (for documents)
 * @property {string} title - Display title
 * @property {string} text - Full text
 * @property {string} preview - Preview text
 * @property {string[]} searchTerms - Terms that were searched
 */

// Export singleton instance
export const searchService = new SearchService();
