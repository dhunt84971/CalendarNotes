/**
 * MarkdownRenderer - Markdown to HTML rendering with custom features
 */

import { marked } from 'marked';
import { sanitizeHTML, escapeHtml } from '../ui/DOMHelper.js';

// Configure marked options
marked.setOptions({
  breaks: true,        // Convert \n to <br>
  gfm: true,          // GitHub Flavored Markdown
  headerIds: false,    // Don't add IDs to headers
  mangle: false        // Don't mangle email addresses
});

export class MarkdownRenderer {
  constructor() {
    this.searchTerms = [];
    this.useWhiteIcons = false;
  }

  /**
   * Render markdown to HTML
   * @param {string} markdown - Markdown text
   * @param {Object} options - Rendering options
   * @returns {string} HTML string
   */
  render(markdown, options = {}) {
    if (!markdown) return '';

    let html = markdown;

    // Process custom checkbox syntax before markdown
    html = this.processCheckboxes(html);

    // Convert markdown to HTML
    html = marked.parse(html);

    // Sanitize the output
    html = sanitizeHTML(html);

    // Highlight search terms if provided
    if (options.searchTerms && options.searchTerms.length > 0) {
      html = this.highlightTerms(html, options.searchTerms);
    }

    return html;
  }

  /**
   * Process custom checkbox syntax |X| and |_|
   * @param {string} text - Text with checkbox syntax
   * @returns {string} Text with HTML checkboxes
   */
  processCheckboxes(text) {
    if (!text) return '';

    // Replace |X| with checked checkbox
    text = text.replace(/\|X\|/g, () => {
      const iconSrc = this.useWhiteIcons
        ? './images/chk_x_w.png'
        : './images/chk_x.png';
      return `<img src="${iconSrc}" alt="[x]" class="checkbox checked" width="14">`;
    });

    // Replace |_| with unchecked checkbox
    text = text.replace(/\|_\|/g, () => {
      const iconSrc = this.useWhiteIcons
        ? './images/chkmt_w.png'
        : './images/chkmt.png';
      return `<img src="${iconSrc}" alt="[ ]" class="checkbox" width="14">`;
    });

    return text;
  }

  /**
   * Set whether to use white (inverted) checkbox icons
   * @param {boolean} useWhite - True to use white icons
   */
  setWhiteIcons(useWhite) {
    this.useWhiteIcons = useWhite;
  }

  /**
   * Highlight search terms in HTML
   * @param {string} html - HTML string
   * @param {string[]} terms - Terms to highlight
   * @returns {string} HTML with highlighted terms
   */
  highlightTerms(html, terms) {
    if (!terms || terms.length === 0) return html;

    // Create a temporary element to safely manipulate HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Highlight terms in text nodes only (not in tags)
    this.highlightInElement(temp, terms);

    return temp.innerHTML;
  }

  /**
   * Recursively highlight terms in element text nodes
   * @param {HTMLElement} element - Element to process
   * @param {string[]} terms - Terms to highlight
   */
  highlightInElement(element, terms) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      let text = textNode.textContent;
      let hasMatch = false;

      terms.forEach(term => {
        const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
        if (regex.test(text)) {
          hasMatch = true;
          text = text.replace(regex, '<mark>$1</mark>');
        }
      });

      if (hasMatch) {
        const span = document.createElement('span');
        span.innerHTML = text;
        textNode.parentNode.replaceChild(span, textNode);
      }
    });
  }

  /**
   * Escape special regex characters
   * @param {string} str - String to escape
   * @returns {string}
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Create a plain text preview (strip markdown)
   * @param {string} markdown - Markdown text
   * @param {number} maxLength - Maximum length
   * @returns {string}
   */
  createPreview(markdown, maxLength = 200) {
    if (!markdown) return '';

    // Remove markdown syntax
    let text = markdown
      .replace(/#{1,6}\s+/g, '')           // Headers
      .replace(/\*\*(.+?)\*\*/g, '$1')      // Bold
      .replace(/\*(.+?)\*/g, '$1')          // Italic
      .replace(/__(.+?)__/g, '$1')          // Bold
      .replace(/_(.+?)_/g, '$1')            // Italic
      .replace(/`(.+?)`/g, '$1')            // Inline code
      .replace(/```[\s\S]*?```/g, '')       // Code blocks
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')   // Links
      .replace(/!\[.*?\]\(.+?\)/g, '')      // Images
      .replace(/^\s*[-*+]\s+/gm, '')        // List items
      .replace(/^\s*\d+\.\s+/gm, '')        // Numbered lists
      .replace(/^\s*>\s+/gm, '')            // Blockquotes
      .replace(/\|X\|/g, '[x]')             // Checkboxes
      .replace(/\|_\|/g, '[ ]')
      .replace(/\n{2,}/g, '\n')             // Multiple newlines
      .trim();

    // Truncate
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }

    return text;
  }

  /**
   * Convert plain text to simple HTML (just escape and add line breaks)
   * @param {string} text - Plain text
   * @returns {string} HTML string
   */
  textToHtml(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
  }
}

// Export singleton instance
export const markdownRenderer = new MarkdownRenderer();
