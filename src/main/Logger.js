import { app } from 'electron';
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

class Logger {
  constructor() {
    this.logPath = null;
    this.initialized = false;
  }

  /**
   * Initialize the logger. Overwrites any existing log file.
   * Log file location: {userData}/calendar-notes.log
   *   - Windows: %APPDATA%\Calendar Notes\calendar-notes.log
   *   - macOS:   ~/Library/Application Support/Calendar Notes/calendar-notes.log
   *   - Linux:   ~/.config/Calendar Notes/calendar-notes.log
   */
  init() {
    this.logPath = join(app.getPath('userData'), 'calendar-notes.log');
    // Overwrite the log file on each application start
    writeFileSync(this.logPath, `Calendar Notes v${app.getVersion()} started at ${new Date().toISOString()}\n`);
    this.initialized = true;
  }

  /**
   * Write a message to the log file
   * @param {string} level - Log level (INFO, ERROR, WARN)
   * @param  {...any} args - Values to log
   */
  write(level, ...args) {
    if (!this.initialized) return;

    const message = args.map(a => {
      if (a instanceof Error) return `${a.message}\n${a.stack}`;
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');

    const line = `[${level}] ${message}\n`;

    try {
      appendFileSync(this.logPath, line);
    } catch {
      // If we can't write to the log file, fall back to stdout
      process.stderr.write(`Logger write failed: ${line}`);
    }
  }

  info(...args) {
    this.write('INFO', ...args);
  }

  warn(...args) {
    this.write('WARN', ...args);
  }

  error(...args) {
    this.write('ERROR', ...args);
  }

  /**
   * Get the path to the log file
   * @returns {string|null}
   */
  getLogPath() {
    return this.logPath;
  }
}

export const logger = new Logger();
