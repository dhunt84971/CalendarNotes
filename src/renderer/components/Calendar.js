/**
 * Calendar - Interactive calendar component for date selection
 */

import { createElement, $, clearChildren, addEvent, toggleClass } from '../ui/DOMHelper.js';
import { eventBus, Events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { notesService } from '../services/NotesService.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class Calendar {
  /**
   * Create a Calendar component
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
    this.container = container;
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.selectedDate = new Date();
    this.notedDays = new Set();
    this.cleanups = [];

    this.init();
  }

  /**
   * Initialize the calendar
   */
  init() {
    this.render();
    this.bindEvents();
    this.loadNotedDays();
  }

  /**
   * Render the calendar HTML
   */
  render() {
    clearChildren(this.container);

    // Wrap everything in #cal div like original
    const cal = createElement('div', { attrs: { id: 'cal' } });

    // Header with navigation (matching original layout)
    const header = createElement('div', {
      classes: ['calendar-header'],
      children: [
        createElement('button', {
          classes: ['cal-nav', 'prev', 'cal-prev'],
          html: '&lang;',
          attrs: { title: 'Previous Month' }
        }),
        createElement('span', {
          classes: ['cal-label'],
          text: `${MONTHS[this.currentMonth]} ${this.currentYear}`
        }),
        createElement('button', {
          classes: ['cal-nav', 'next', 'cal-next'],
          html: '&rang;',
          attrs: { title: 'Next Month' }
        }),
        createElement('button', {
          classes: ['cal-nav', 'today', 'cal-today'],
          html: '&rang;&rang;',
          attrs: { title: 'Go to Today' }
        })
      ]
    });

    // Days of week header
    const daysHeader = createElement('div', {
      classes: ['calendar-days-header'],
      children: DAYS.map(day =>
        createElement('span', { classes: ['day-name'], text: day.toLowerCase() })
      )
    });

    // Calendar grid
    const grid = createElement('div', {
      classes: ['calendar-grid']
    });

    this.renderDays(grid);

    cal.appendChild(header);
    cal.appendChild(daysHeader);
    cal.appendChild(grid);
    this.container.appendChild(cal);

    // Store references
    this.labelEl = $('.cal-label', this.container);
    this.gridEl = grid;
  }

  /**
   * Render the day cells
   * @param {HTMLElement} grid - Grid element
   */
  renderDays(grid) {
    clearChildren(grid);

    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getMonth() === this.currentMonth &&
                           today.getFullYear() === this.currentYear;
    const todayDate = today.getDate();

    // Previous month padding
    const prevMonthDays = new Date(this.currentYear, this.currentMonth, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      grid.appendChild(createElement('div', {
        classes: ['calendar-day', 'other-month'],
        text: String(prevMonthDays - i)
      }));
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const classes = ['calendar-day'];

      // Check if this is today
      if (isCurrentMonth && day === todayDate) {
        classes.push('today');
      }

      // Check if this is the selected date
      if (this.isSelectedDay(day)) {
        classes.push('selected');
      }

      // Check if this day has notes
      if (this.notedDays.has(day)) {
        classes.push('has-notes');
      }

      const dayEl = createElement('div', {
        classes,
        text: String(day),
        data: { day: String(day) }
      });

      grid.appendChild(dayEl);
    }

    // Next month padding (fill to 6 rows)
    const totalCells = firstDay + daysInMonth;
    const remainingCells = (Math.ceil(totalCells / 7) * 7) - totalCells;
    for (let i = 1; i <= remainingCells; i++) {
      grid.appendChild(createElement('div', {
        classes: ['calendar-day', 'other-month'],
        text: String(i)
      }));
    }
  }

  /**
   * Check if a day is the selected date
   * @param {number} day - Day number
   * @returns {boolean}
   */
  isSelectedDay(day) {
    return this.selectedDate.getDate() === day &&
           this.selectedDate.getMonth() === this.currentMonth &&
           this.selectedDate.getFullYear() === this.currentYear;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Navigation buttons
    this.cleanups.push(
      addEvent($('.cal-prev', this.container), 'click', () => this.prevMonth()),
      addEvent($('.cal-next', this.container), 'click', () => this.nextMonth()),
      addEvent($('.cal-today', this.container), 'click', () => this.goToToday())
    );

    // Day selection
    this.cleanups.push(
      addEvent(this.container, 'click', (e) => {
        const dayEl = e.target.closest('.calendar-day:not(.other-month)');
        if (dayEl) {
          const day = parseInt(dayEl.dataset.day, 10);
          this.selectDay(day);
        }
      })
    );

    // Listen for external date changes
    this.cleanups.push(
      eventBus.on(Events.DATE_CHANGED, ({ date }) => {
        this.setDate(date);
      })
    );

    // Listen for note saves to update highlighting
    this.cleanups.push(
      eventBus.on(Events.NOTE_SAVED, () => {
        this.loadNotedDays();
      })
    );
  }

  /**
   * Navigate to previous month
   */
  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.updateCalendar();
  }

  /**
   * Navigate to next month
   */
  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.updateCalendar();
  }

  /**
   * Navigate to previous year
   */
  prevYear() {
    this.currentYear--;
    this.updateCalendar();
  }

  /**
   * Navigate to next year
   */
  nextYear() {
    this.currentYear++;
    this.updateCalendar();
  }

  /**
   * Go to today's date
   */
  goToToday() {
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.selectDay(today.getDate());
  }

  /**
   * Select a day
   * @param {number} day - Day number
   */
  selectDay(day) {
    this.selectedDate = new Date(this.currentYear, this.currentMonth, day);
    state.setSelectedDate(this.selectedDate);
    eventBus.emit(Events.DATE_SELECTED, { date: this.selectedDate });
    this.updateCalendar();
  }

  /**
   * Set the calendar to a specific date
   * @param {Date} date - Date to set
   */
  setDate(date) {
    this.selectedDate = new Date(date);
    this.currentMonth = date.getMonth();
    this.currentYear = date.getFullYear();
    this.updateCalendar();
  }

  /**
   * Update the calendar display
   */
  async updateCalendar() {
    // Update label
    if (this.labelEl) {
      this.labelEl.textContent = `${MONTHS[this.currentMonth]} ${this.currentYear}`;
    }

    // Load noted days for this month
    await this.loadNotedDays();

    // Re-render days
    if (this.gridEl) {
      this.renderDays(this.gridEl);
    }

    // Update state
    state.set('displayedMonth', this.currentMonth);
    state.set('displayedYear', this.currentYear);

    eventBus.emit(Events.MONTH_CHANGED, {
      month: this.currentMonth,
      year: this.currentYear
    });
  }

  /**
   * Load days that have notes for the current month
   */
  async loadNotedDays() {
    try {
      const days = await notesService.getNotedDaysInMonth(
        this.currentYear,
        this.currentMonth
      );
      this.notedDays = new Set(days);

      // Update highlighting if grid exists
      if (this.gridEl) {
        const dayEls = this.gridEl.querySelectorAll('.calendar-day:not(.other-month)');
        dayEls.forEach(el => {
          const day = parseInt(el.dataset.day, 10);
          toggleClass(el, 'has-notes', this.notedDays.has(day));
        });
      }
    } catch (error) {
      console.error('Failed to load noted days:', error);
    }
  }

  /**
   * Get the currently selected date
   * @returns {Date}
   */
  getSelectedDate() {
    return new Date(this.selectedDate);
  }

  /**
   * Get the selected date as a formatted string
   * @param {string} format - 'sqlite' | 'display'
   * @returns {string}
   */
  getFormattedDate(format = 'sqlite') {
    const year = this.selectedDate.getFullYear();
    const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDate.getDate()).padStart(2, '0');

    if (format === 'display') {
      return `${month}/${day}/${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  /**
   * Cleanup the component
   */
  destroy() {
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
    clearChildren(this.container);
  }
}
