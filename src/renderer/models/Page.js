/**
 * Page - Alias for Document with page-specific helpers
 * Pages are documents with indentLevel > 0
 */

import { Document, DOC_DELIMITER } from './Document.js';

export { DOC_DELIMITER };

export class Page extends Document {
  constructor(data = {}) {
    super(data);
    // Ensure pages have indent level >= 1
    if (this.indentLevel < 1) {
      this.indentLevel = 1;
    }
  }

  /**
   * Create a Page from a database row
   * @param {Object} row - Database row
   * @returns {Page}
   */
  static fromRow(row) {
    if (!row) return null;
    return new Page(row);
  }

  /**
   * Create a new page
   * @param {string} name - Page name
   * @param {string} documentPath - Parent document path
   * @param {number} order - Page order
   * @param {number} indentLevel - Indent level (default 1)
   * @returns {Page}
   */
  static create(name, documentPath, order = 0, indentLevel = 1) {
    return new Page({
      name,
      location: documentPath,
      pageOrder: order,
      indentLevel,
      lastModified: new Date().toISOString()
    });
  }

  /**
   * Increase indent level
   * @returns {Page}
   */
  indent() {
    this.indentLevel = Math.min(this.indentLevel + 1, 10);
    return this;
  }

  /**
   * Decrease indent level
   * @returns {Page}
   */
  outdent() {
    this.indentLevel = Math.max(this.indentLevel - 1, 1);
    return this;
  }
}
