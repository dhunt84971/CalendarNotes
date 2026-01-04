/**
 * Task - Data model for the tasks list
 * Note: This is a single persistent task list, not date-specific
 */

export class Task {
  constructor(data = {}) {
    this.id = data.ID || data.id || null;
    this.text = data.TasksList || data.text || '';
  }

  /**
   * Create a Task from a database row
   * @param {Object} row - Database row
   * @returns {Task}
   */
  static fromRow(row) {
    if (!row) return null;
    return new Task(row);
  }

  /**
   * Convert to database row format
   * @returns {Object}
   */
  toRow() {
    return {
      TasksList: this.text
    };
  }

  /**
   * Check if task list is empty
   * @returns {boolean}
   */
  isEmpty() {
    return !this.text || this.text.trim() === '';
  }

  /**
   * Create an empty task list
   * @returns {Task}
   */
  static create() {
    return new Task({ text: '' });
  }
}
