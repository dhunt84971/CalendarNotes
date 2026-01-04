/**
 * DateUtils - Date formatting and manipulation utilities
 */

/**
 * Format a date for SQLite storage (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string}
 */
export function formatForSqlite(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date for display (MM/DD/YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string}
 */
export function formatForDisplay(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${year}`;
}

/**
 * Format a date as ISO string
 * @param {Date|string} date - Date to format
 * @returns {string}
 */
export function formatISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString();
}

/**
 * Get the current date/time as ISO string
 * @returns {string}
 */
export function now() {
  return new Date().toISOString();
}

/**
 * Parse a date string into a Date object
 * @param {string} dateStr - Date string (YYYY-MM-DD or MM/DD/YYYY)
 * @returns {Date}
 */
export function parseDate(dateStr) {
  if (!dateStr) return new Date();

  // Handle YYYY-MM-DD format
  if (dateStr.includes('-')) {
    return new Date(dateStr);
  }

  // Handle MM/DD/YYYY format
  if (dateStr.includes('/')) {
    const [month, day, year] = dateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return new Date(dateStr);
}

/**
 * Check if two dates are the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
}

/**
 * Check if a date is today
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
export function isToday(date) {
  return isSameDay(date, new Date());
}

/**
 * Get the number of days in a month
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the first day of the month (0 = Sunday, 6 = Saturday)
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {number}
 */
export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

/**
 * Add days to a date
 * @param {Date} date - Starting date
 * @param {number} days - Number of days to add
 * @returns {Date}
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date
 * @param {Date} date - Starting date
 * @param {number} months - Number of months to add
 * @returns {Date}
 */
export function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Pad a number to 2 digits
 * @param {number} n - Number to pad
 * @returns {string}
 */
export function twoDigits(n) {
  return String(n).padStart(2, '0');
}

/**
 * Month names
 */
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Short month names
 */
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Day names
 */
export const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

/**
 * Short day names
 */
export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
