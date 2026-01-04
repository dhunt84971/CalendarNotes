/**
 * ContextMenu - Right-click context menu component
 */

import { createElement, addEvent, hide, show } from '../ui/DOMHelper.js';

export class ContextMenu {
  /**
   * Create a ContextMenu
   */
  constructor() {
    this.menuEl = null;
    this.isVisible = false;
    this.cleanups = [];

    this.init();
  }

  /**
   * Initialize the context menu
   */
  init() {
    // Create the menu element
    this.menuEl = createElement('div', {
      classes: ['context-menu'],
      styles: {
        position: 'fixed',
        display: 'none',
        zIndex: '10000'
      }
    });

    document.body.appendChild(this.menuEl);

    // Close on click outside
    this.cleanups.push(
      addEvent(document, 'click', (e) => {
        if (!this.menuEl.contains(e.target)) {
          this.hide();
        }
      })
    );

    // Close on escape
    this.cleanups.push(
      addEvent(document, 'keydown', (e) => {
        if (e.key === 'Escape') {
          this.hide();
        }
      })
    );

    // Close on scroll
    this.cleanups.push(
      addEvent(document, 'scroll', () => this.hide(), true)
    );
  }

  /**
   * Show the context menu
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Array<MenuItem>} items - Menu items
   */
  show(x, y, items) {
    // Build menu items
    this.menuEl.innerHTML = '';

    items.forEach(item => {
      if (item.separator) {
        this.menuEl.appendChild(createElement('div', {
          classes: ['context-menu-separator']
        }));
        return;
      }

      const itemClasses = ['context-menu-item'];
      if (item.disabled) {
        itemClasses.push('disabled');
      }

      const itemEl = createElement('div', {
        classes: itemClasses,
        text: item.label
      });

      if (!item.disabled && item.action) {
        itemEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hide();
          item.action();
        });
      }

      this.menuEl.appendChild(itemEl);
    });

    // Position the menu
    this.menuEl.style.left = `${x}px`;
    this.menuEl.style.top = `${y}px`;
    this.menuEl.style.display = 'block';

    // Adjust position if menu goes off screen
    const rect = this.menuEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth) {
      this.menuEl.style.left = `${x - rect.width}px`;
    }

    if (rect.bottom > viewportHeight) {
      this.menuEl.style.top = `${y - rect.height}px`;
    }

    this.isVisible = true;
  }

  /**
   * Hide the context menu
   */
  hide() {
    this.menuEl.style.display = 'none';
    this.isVisible = false;
  }

  /**
   * Check if menu is visible
   * @returns {boolean}
   */
  visible() {
    return this.isVisible;
  }

  /**
   * Cleanup the component
   */
  destroy() {
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];

    if (this.menuEl && this.menuEl.parentNode) {
      this.menuEl.parentNode.removeChild(this.menuEl);
    }
  }
}

/**
 * Menu item definition
 * @typedef {Object} MenuItem
 * @property {string} label - Menu item label
 * @property {Function} action - Action to perform on click
 * @property {boolean} [disabled] - Whether the item is disabled
 * @property {boolean} [separator] - Whether this is a separator
 */

// Create a singleton instance for global use
export const contextMenu = new ContextMenu();
