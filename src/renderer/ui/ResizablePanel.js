/**
 * ResizablePanel - Draggable panel splitter utility
 */

import { addEvent } from './DOMHelper.js';

export class ResizablePanel {
  /**
   * Create a ResizablePanel
   * @param {Object} options - Configuration options
   * @param {HTMLElement} options.splitter - Splitter element
   * @param {HTMLElement} options.panel - Panel to resize
   * @param {string} options.direction - 'horizontal' or 'vertical'
   * @param {number} options.minSize - Minimum panel size
   * @param {number} options.maxSize - Maximum panel size
   * @param {Function} options.onResize - Callback when resized
   */
  constructor(options) {
    this.splitter = options.splitter;
    this.panel = options.panel;
    this.direction = options.direction || 'horizontal';
    this.minSize = options.minSize || 100;
    this.maxSize = options.maxSize || 800;
    this.onResize = options.onResize || (() => {});

    this.isResizing = false;
    this.startPos = 0;
    this.startSize = 0;
    this.cleanups = [];

    this.init();
  }

  /**
   * Initialize the resizable panel
   */
  init() {
    // Mouse down on splitter
    this.cleanups.push(
      addEvent(this.splitter, 'mousedown', (e) => this.startResize(e))
    );

    // Touch support
    this.cleanups.push(
      addEvent(this.splitter, 'touchstart', (e) => this.startResize(e), { passive: false })
    );
  }

  /**
   * Start resizing
   * @param {MouseEvent|TouchEvent} e - Event
   */
  startResize(e) {
    e.preventDefault();

    this.isResizing = true;

    // Get starting position
    if (e.type === 'touchstart') {
      this.startPos = this.direction === 'horizontal'
        ? e.touches[0].clientX
        : e.touches[0].clientY;
    } else {
      this.startPos = this.direction === 'horizontal'
        ? e.clientX
        : e.clientY;
    }

    // Get starting size
    const style = getComputedStyle(this.panel);
    this.startSize = this.direction === 'horizontal'
      ? parseInt(style.width)
      : parseInt(style.height);

    // Add move and up listeners
    this.moveHandler = (e) => this.doResize(e);
    this.upHandler = () => this.stopResize();

    document.addEventListener('mousemove', this.moveHandler);
    document.addEventListener('mouseup', this.upHandler);
    document.addEventListener('touchmove', this.moveHandler, { passive: false });
    document.addEventListener('touchend', this.upHandler);

    // Visual feedback
    document.body.style.cursor = this.direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    this.splitter.classList.add('active');
  }

  /**
   * Perform resize
   * @param {MouseEvent|TouchEvent} e - Event
   */
  doResize(e) {
    if (!this.isResizing) return;

    e.preventDefault();

    // Get current position
    let currentPos;
    if (e.type === 'touchmove') {
      currentPos = this.direction === 'horizontal'
        ? e.touches[0].clientX
        : e.touches[0].clientY;
    } else {
      currentPos = this.direction === 'horizontal'
        ? e.clientX
        : e.clientY;
    }

    // Calculate new size
    const delta = currentPos - this.startPos;
    let newSize = this.startSize + delta;

    // Apply constraints
    newSize = Math.max(this.minSize, Math.min(this.maxSize, newSize));

    // Apply size
    if (this.direction === 'horizontal') {
      this.panel.style.width = `${newSize}px`;
    } else {
      this.panel.style.height = `${newSize}px`;
    }

    // Callback
    this.onResize(newSize);
  }

  /**
   * Stop resizing
   */
  stopResize() {
    this.isResizing = false;

    // Remove listeners
    document.removeEventListener('mousemove', this.moveHandler);
    document.removeEventListener('mouseup', this.upHandler);
    document.removeEventListener('touchmove', this.moveHandler);
    document.removeEventListener('touchend', this.upHandler);

    // Reset visual feedback
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.splitter.classList.remove('active');
  }

  /**
   * Get current size
   * @returns {number}
   */
  getSize() {
    const style = getComputedStyle(this.panel);
    return this.direction === 'horizontal'
      ? parseInt(style.width)
      : parseInt(style.height);
  }

  /**
   * Set size
   * @param {number} size - New size
   */
  setSize(size) {
    size = Math.max(this.minSize, Math.min(this.maxSize, size));

    if (this.direction === 'horizontal') {
      this.panel.style.width = `${size}px`;
    } else {
      this.panel.style.height = `${size}px`;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopResize();
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
  }
}
