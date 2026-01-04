/**
 * Note - Data model for calendar notes
 */

export class Note {
  constructor(data = {}) {
    this.id = data.ID || data.id || null;
    this.date = data.NoteDate || data.date || null;
    this.text = data.NoteText || data.text || '';
    this.lastModified = data.LastModified || data.lastModified || null;
  }

  /**
   * Create a Note from a database row
   * @param {Object} row - Database row
   * @returns {Note}
   */
  static fromRow(row) {
    if (!row) return null;
    return new Note(row);
  }

  /**
   * Convert to database row format
   * @returns {Object}
   */
  toRow() {
    return {
      NoteDate: this.date,
      NoteText: this.text,
      LastModified: this.lastModified || new Date().toISOString()
    };
  }

  /**
   * Check if note is empty
   * @returns {boolean}
   */
  isEmpty() {
    return !this.text || this.text.trim() === '';
  }

  /**
   * Create a new note for a date
   * @param {string} date - Date string (YYYY-MM-DD format)
   * @returns {Note}
   */
  static create(date) {
    return new Note({
      date,
      text: '',
      lastModified: new Date().toISOString()
    });
  }
}
