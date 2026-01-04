/**
 * Database - SQLite database wrapper for renderer process
 * Uses the preload API to communicate with the main process
 * All queries use parameterized statements to prevent SQL injection
 */

import { eventBus, Events } from '../core/EventBus.js';

export class Database {
  constructor() {
    this.isOpen = false;
    this.dbPath = null;
  }

  /**
   * Open or create a database
   * @param {string} dbPath - Path to the database file
   * @returns {Promise<boolean>} True if successful
   */
  async open(dbPath) {
    try {
      const result = await window.api.database.open(dbPath);
      if (result.success) {
        this.isOpen = true;
        this.dbPath = dbPath;
        await this.ensureTables();
        eventBus.emit(Events.DB_CONNECTED, { dbPath });
        return true;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to open database:', error);
      eventBus.emit(Events.DB_ERROR, { error });
      return false;
    }
  }

  /**
   * Close the database
   * @returns {Promise<boolean>} True if successful
   */
  async close() {
    try {
      await window.api.database.close();
      this.isOpen = false;
      this.dbPath = null;
      return true;
    } catch (error) {
      console.error('Failed to close database:', error);
      return false;
    }
  }

  /**
   * Execute a query and return all rows
   * @param {string} sql - SQL query with ? placeholders
   * @param {Array} params - Parameters to bind
   * @returns {Promise<Array>} Array of row objects
   */
  async query(sql, params = []) {
    if (!this.isOpen) {
      throw new Error('Database not open');
    }

    const result = await window.api.database.query(sql, params);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.rows;
  }

  /**
   * Execute a query and return a single row
   * @param {string} sql - SQL query with ? placeholders
   * @param {Array} params - Parameters to bind
   * @returns {Promise<Object|null>} Row object or null
   */
  async get(sql, params = []) {
    if (!this.isOpen) {
      throw new Error('Database not open');
    }

    const result = await window.api.database.get(sql, params);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.row;
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE statement
   * @param {string} sql - SQL statement with ? placeholders
   * @param {Array} params - Parameters to bind
   * @returns {Promise<Object>} Result with changes and lastInsertRowid
   */
  async run(sql, params = []) {
    if (!this.isOpen) {
      throw new Error('Database not open');
    }

    const result = await window.api.database.run(sql, params);
    if (!result.success) {
      throw new Error(result.error);
    }
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }

  /**
   * Execute raw SQL (for schema changes)
   * @param {string} sql - SQL to execute
   * @returns {Promise<boolean>} True if successful
   */
  async exec(sql) {
    if (!this.isOpen) {
      throw new Error('Database not open');
    }

    const result = await window.api.database.exec(sql);
    if (!result.success) {
      throw new Error(result.error);
    }
    return true;
  }

  /**
   * Ensure all required tables exist
   */
  async ensureTables() {
    const schema = `
      CREATE TABLE IF NOT EXISTS Notes (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        NoteDate TEXT NOT NULL UNIQUE,
        NoteText TEXT,
        LastModified TEXT
      );

      CREATE TABLE IF NOT EXISTS TasksList (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        TasksList TEXT
      );

      CREATE TABLE IF NOT EXISTS Docs (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        DocName TEXT NOT NULL,
        DocLocation TEXT,
        DocColor INTEGER DEFAULT 0,
        DocText TEXT,
        LastModified TEXT,
        DocIndentLevel INTEGER DEFAULT 0,
        DocOrder INTEGER DEFAULT 0,
        PageOrder INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_notes_date ON Notes(NoteDate);
      CREATE INDEX IF NOT EXISTS idx_docs_location ON Docs(DocLocation);
    `;

    await this.exec(schema);
  }

  /**
   * Check if database is connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.isOpen;
  }

  /**
   * Get the current database path
   * @returns {string|null} Database path or null
   */
  getPath() {
    return this.dbPath;
  }
}

// Export singleton instance
export const database = new Database();
