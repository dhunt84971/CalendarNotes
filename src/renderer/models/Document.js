/**
 * Document - Data model for hierarchical documents
 * Documents contain pages and can be nested
 */

export const DOC_DELIMITER = '/';

export class Document {
  constructor(data = {}) {
    this.id = data.ID || data.id || null;
    this.name = data.DocName || data.name || '';
    this.location = data.DocLocation || data.location || '';
    this.color = data.DocColor || data.color || 0;
    this.text = data.DocText || data.text || '';
    this.lastModified = data.LastModified || data.lastModified || null;
    this.indentLevel = data.DocIndentLevel || data.indentLevel || 0;
    this.order = data.DocOrder || data.order || 0;
    this.pageOrder = data.PageOrder || data.pageOrder || 0;
  }

  /**
   * Create a Document from a database row
   * @param {Object} row - Database row
   * @returns {Document}
   */
  static fromRow(row) {
    if (!row) return null;
    return new Document(row);
  }

  /**
   * Convert to database row format
   * @returns {Object}
   */
  toRow() {
    return {
      DocName: this.name,
      DocLocation: this.location,
      DocColor: this.color,
      DocText: this.text,
      LastModified: this.lastModified || new Date().toISOString(),
      DocIndentLevel: this.indentLevel,
      DocOrder: this.order,
      PageOrder: this.pageOrder
    };
  }

  /**
   * Get the full path of this document
   * @returns {string}
   */
  getFullPath() {
    if (!this.location) {
      return this.name;
    }
    return `${this.location}${DOC_DELIMITER}${this.name}`;
  }

  /**
   * Get the parent path
   * @returns {string|null}
   */
  getParentPath() {
    return this.location || null;
  }

  /**
   * Check if this is a root-level document
   * @returns {boolean}
   */
  isRoot() {
    return !this.location || this.location === '/';
  }

  /**
   * Check if this is a page (has indent level > 0)
   * @returns {boolean}
   */
  isPage() {
    return this.indentLevel > 0;
  }

  /**
   * Create a new document
   * @param {string} name - Document name
   * @param {string} location - Parent location
   * @param {number} order - Document order
   * @returns {Document}
   */
  static create(name, location = '/', order = 0) {
    return new Document({
      name,
      location,
      order,
      indentLevel: 0,
      lastModified: new Date().toISOString()
    });
  }

  /**
   * Create a new page within a document
   * @param {string} name - Page name
   * @param {string} location - Document location
   * @param {number} indentLevel - Indent level
   * @param {number} pageOrder - Page order
   * @returns {Document}
   */
  static createPage(name, location, indentLevel = 1, pageOrder = 0) {
    return new Document({
      name,
      location,
      indentLevel,
      pageOrder,
      lastModified: new Date().toISOString()
    });
  }
}
