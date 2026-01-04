/**
 * TasksService - Service for managing the persistent task list
 */

import { database } from '../database/Database.js';
import { Task } from '../models/Task.js';
import { eventBus, Events } from '../core/EventBus.js';

export class TasksService {
  /**
   * Get the task list
   * @returns {Promise<Task|null>}
   */
  async get() {
    const sql = 'SELECT * FROM TasksList LIMIT 1';
    const row = await database.get(sql, []);
    return Task.fromRow(row);
  }

  /**
   * Save the task list
   * @param {string} text - Task list text
   * @returns {Promise<Task>}
   */
  async save(text) {
    const existingTask = await this.get();

    if (existingTask) {
      // Update existing
      const sql = 'UPDATE TasksList SET TasksList = ? WHERE ID = ?';
      await database.run(sql, [text, existingTask.id]);
      existingTask.text = text;
      eventBus.emit(Events.TASKS_SAVED, existingTask);
      return existingTask;
    } else {
      // Insert new
      const sql = 'INSERT INTO TasksList (TasksList) VALUES (?)';
      const result = await database.run(sql, [text]);
      const task = new Task({
        id: result.lastInsertRowid,
        text
      });
      eventBus.emit(Events.TASKS_SAVED, task);
      return task;
    }
  }

  /**
   * Clear all tasks
   * @returns {Promise<boolean>}
   */
  async clear() {
    const sql = 'DELETE FROM TasksList';
    await database.run(sql, []);
    eventBus.emit(Events.TASKS_SAVED, Task.create());
    return true;
  }

  /**
   * Check if task list exists
   * @returns {Promise<boolean>}
   */
  async exists() {
    const sql = 'SELECT COUNT(*) as count FROM TasksList';
    const row = await database.get(sql, []);
    return (row?.count || 0) > 0;
  }
}

// Export singleton instance
export const tasksService = new TasksService();
