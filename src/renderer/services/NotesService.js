/**
 * NotesService - Service for managing calendar notes
 */

import { database } from '../database/Database.js';
import { QueryBuilder } from '../database/QueryBuilder.js';
import { Note } from '../models/Note.js';
import { eventBus, Events } from '../core/EventBus.js';

export class NotesService {
  /**
   * Get a note by date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Promise<Note|null>}
   */
  async getByDate(date) {
    const { sql, params } = QueryBuilder.select('Notes')
      .select(['*'])
      .where('NoteDate', '=', date)
      .build();

    const row = await database.get(sql, params);
    return Note.fromRow(row);
  }

  /**
   * Save a note (insert or update)
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {string} text - Note text
   * @returns {Promise<Note>}
   */
  async save(date, text) {
    const existingNote = await this.getByDate(date);
    const now = new Date().toISOString();

    if (existingNote) {
      // Update existing note
      const { sql, params } = QueryBuilder.update('Notes')
        .set({
          NoteText: text,
          LastModified: now
        })
        .where('NoteDate', '=', date)
        .build();

      await database.run(sql, params);
      existingNote.text = text;
      existingNote.lastModified = now;
      eventBus.emit(Events.NOTE_SAVED, existingNote);
      return existingNote;
    } else {
      // Insert new note
      const { sql, params } = QueryBuilder.insert('Notes')
        .values({
          NoteDate: date,
          NoteText: text,
          LastModified: now
        })
        .build();

      const result = await database.run(sql, params);
      const note = new Note({
        id: result.lastInsertRowid,
        date,
        text,
        lastModified: now
      });
      eventBus.emit(Events.NOTE_SAVED, note);
      return note;
    }
  }

  /**
   * Delete a note by date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Promise<boolean>}
   */
  async delete(date) {
    const { sql, params } = QueryBuilder.delete('Notes')
      .where('NoteDate', '=', date)
      .build();

    const result = await database.run(sql, params);
    return result.changes > 0;
  }

  /**
   * Get all dates in a month that have notes
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @returns {Promise<number[]>} Array of day numbers with notes
   */
  async getNotedDaysInMonth(year, month) {
    // Create date range for the month
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-31`;

    const sql = `
      SELECT NoteDate FROM Notes
      WHERE NoteDate >= ? AND NoteDate <= ?
      AND NoteText IS NOT NULL AND NoteText != '' AND TRIM(NoteText) != ''
    `;

    const rows = await database.query(sql, [startDate, endDate]);

    // Extract day numbers directly from YYYY-MM-DD string to avoid timezone issues
    return rows.map(row => {
      const parts = row.NoteDate.split('-');
      return parseInt(parts[2], 10);
    });
  }

  /**
   * Search notes by text
   * @param {string[]} searchTerms - Array of search terms
   * @returns {Promise<{date: string, text: string, preview: string}[]>}
   */
  async search(searchTerms) {
    if (!searchTerms || searchTerms.length === 0) {
      return [];
    }

    // Build WHERE clause with AND conditions for all terms
    const conditions = searchTerms.map(() => 'NoteText LIKE ?').join(' AND ');
    const params = searchTerms.map(term => `%${term}%`);

    const sql = `
      SELECT NoteDate, NoteText FROM Notes
      WHERE ${conditions}
      ORDER BY NoteDate DESC
    `;

    const rows = await database.query(sql, params);

    return rows.map(row => ({
      date: row.NoteDate,
      text: row.NoteText,
      preview: this.createPreview(row.NoteText, searchTerms)
    }));
  }

  /**
   * Create a preview of note text with search terms highlighted
   * @param {string} text - Full note text
   * @param {string[]} searchTerms - Terms to highlight
   * @returns {string}
   */
  createPreview(text, searchTerms) {
    if (!text) return '';

    // Get first 200 characters
    let preview = text.substring(0, 200);
    if (text.length > 200) {
      preview += '...';
    }

    return preview;
  }

  /**
   * Get all notes (for export)
   * @returns {Promise<Note[]>}
   */
  async getAll() {
    const { sql, params } = QueryBuilder.select('Notes')
      .select(['*'])
      .orderBy('NoteDate', 'DESC')
      .build();

    const rows = await database.query(sql, params);
    return rows.map(row => Note.fromRow(row));
  }

  /**
   * Count total notes
   * @returns {Promise<number>}
   */
  async count() {
    const sql = 'SELECT COUNT(*) as count FROM Notes WHERE NoteText IS NOT NULL AND NoteText != ""';
    const row = await database.get(sql, []);
    return row?.count || 0;
  }
}

// Export singleton instance
export const notesService = new NotesService();
