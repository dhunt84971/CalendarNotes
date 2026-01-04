/**
 * DOMHelper - Safe DOM manipulation utilities
 * Prevents XSS and provides convenient DOM operations
 */

/**
 * Sanitize a string for safe HTML insertion
 * Escapes HTML special characters
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';

  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Create an element with attributes and content
 * @param {string} tag - HTML tag name
 * @param {Object} options - Element options
 * @param {Object} options.attrs - Attributes to set
 * @param {string} options.text - Text content (safe)
 * @param {string} options.html - HTML content (only use with trusted content!)
 * @param {string[]} options.classes - CSS classes to add
 * @param {Object} options.styles - Inline styles to set
 * @param {Object} options.data - Data attributes to set
 * @param {Object} options.events - Event listeners to add
 * @param {HTMLElement[]} options.children - Child elements to append
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, options = {}) {
  const el = document.createElement(tag);

  // Set attributes
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        el.setAttribute(key, value);
      }
    });
  }

  // Set text content (safe)
  if (options.text !== undefined) {
    el.textContent = options.text;
  }

  // Set HTML content (use with caution - only for trusted content)
  if (options.html !== undefined) {
    el.innerHTML = options.html;
  }

  // Add classes
  if (options.classes) {
    el.classList.add(...options.classes);
  }

  // Set styles
  if (options.styles) {
    Object.entries(options.styles).forEach(([key, value]) => {
      el.style[key] = value;
    });
  }

  // Set data attributes
  if (options.data) {
    Object.entries(options.data).forEach(([key, value]) => {
      el.dataset[key] = value;
    });
  }

  // Add event listeners
  if (options.events) {
    Object.entries(options.events).forEach(([event, handler]) => {
      el.addEventListener(event, handler);
    });
  }

  // Append children
  if (options.children) {
    options.children.forEach(child => {
      if (child) el.appendChild(child);
    });
  }

  return el;
}

/**
 * Query a single element
 * @param {string} selector - CSS selector
 * @param {HTMLElement} context - Context element (default: document)
 * @returns {HTMLElement|null} Found element or null
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Query multiple elements
 * @param {string} selector - CSS selector
 * @param {HTMLElement} context - Context element (default: document)
 * @returns {HTMLElement[]} Array of found elements
 */
export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Set text content safely
 * @param {HTMLElement} el - Element
 * @param {string} text - Text to set
 */
export function setText(el, text) {
  if (el) {
    el.textContent = text ?? '';
  }
}

/**
 * Set HTML content (only for trusted/sanitized content)
 * @param {HTMLElement} el - Element
 * @param {string} html - HTML to set
 * @param {Object} options - Options
 * @param {boolean} options.sanitize - Whether to sanitize the HTML
 */
export function setHTML(el, html, options = {}) {
  if (!el) return;

  if (options.sanitize) {
    // Basic sanitization - remove script tags and event handlers
    html = sanitizeHTML(html);
  }

  el.innerHTML = html ?? '';
}

/**
 * Basic HTML sanitization
 * Removes script tags, event handlers, and dangerous elements
 * @param {string} html - HTML to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(html) {
  if (!html) return '';

  // Create a temporary element
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove script tags
  temp.querySelectorAll('script').forEach(el => el.remove());

  // Remove event handler attributes
  temp.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
    // Remove javascript: URLs
    if (el.hasAttribute('href') && el.getAttribute('href').toLowerCase().startsWith('javascript:')) {
      el.setAttribute('href', '#');
    }
    if (el.hasAttribute('src') && el.getAttribute('src').toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('src');
    }
  });

  // Remove dangerous elements
  const dangerousTags = ['iframe', 'object', 'embed', 'form'];
  dangerousTags.forEach(tag => {
    temp.querySelectorAll(tag).forEach(el => el.remove());
  });

  return temp.innerHTML;
}

/**
 * Add event listener with automatic cleanup
 * @param {HTMLElement} el - Element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event listener options
 * @returns {Function} Cleanup function
 */
export function addEvent(el, event, handler, options) {
  if (!el) return () => {};

  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

/**
 * Add multiple event listeners
 * @param {HTMLElement} el - Element
 * @param {Object} events - Object of event name -> handler
 * @returns {Function} Cleanup function that removes all listeners
 */
export function addEvents(el, events) {
  const cleanups = Object.entries(events).map(([event, handler]) =>
    addEvent(el, event, handler)
  );
  return () => cleanups.forEach(cleanup => cleanup());
}

/**
 * Remove all children from an element
 * @param {HTMLElement} el - Element
 */
export function clearChildren(el) {
  if (el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }
}

/**
 * Show an element
 * @param {HTMLElement} el - Element
 * @param {string} display - Display value (default: 'block')
 */
export function show(el, display = 'block') {
  if (el) {
    el.style.display = display;
  }
}

/**
 * Hide an element
 * @param {HTMLElement} el - Element
 */
export function hide(el) {
  if (el) {
    el.style.display = 'none';
  }
}

/**
 * Toggle element visibility
 * @param {HTMLElement} el - Element
 * @param {boolean} visible - Force visibility state
 * @param {string} display - Display value when visible
 */
export function toggle(el, visible, display = 'block') {
  if (el) {
    if (visible === undefined) {
      visible = el.style.display === 'none';
    }
    el.style.display = visible ? display : 'none';
  }
}

/**
 * Add or remove a class based on condition
 * @param {HTMLElement} el - Element
 * @param {string} className - Class name
 * @param {boolean} condition - Whether to add or remove
 */
export function toggleClass(el, className, condition) {
  if (el) {
    el.classList.toggle(className, condition);
  }
}

/**
 * Get element by ID
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} Element or null
 */
export function byId(id) {
  return document.getElementById(id);
}

/**
 * Set CSS custom property
 * @param {string} name - Property name (with or without --)
 * @param {string} value - Property value
 * @param {HTMLElement} el - Element (default: document.documentElement)
 */
export function setCSSVar(name, value, el = document.documentElement) {
  const propName = name.startsWith('--') ? name : `--${name}`;
  el.style.setProperty(propName, value);
}

/**
 * Get CSS custom property value
 * @param {string} name - Property name (with or without --)
 * @param {HTMLElement} el - Element (default: document.documentElement)
 * @returns {string} Property value
 */
export function getCSSVar(name, el = document.documentElement) {
  const propName = name.startsWith('--') ? name : `--${name}`;
  return getComputedStyle(el).getPropertyValue(propName).trim();
}

/**
 * Wait for DOM content loaded
 * @returns {Promise} Resolves when DOM is ready
 */
export function domReady() {
  return new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    } else {
      resolve();
    }
  });
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle a function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Show a custom input dialog (replacement for prompt())
 * @param {string} message - Message to display
 * @param {string} defaultValue - Default input value
 * @returns {Promise<string|null>} User input or null if cancelled
 */
export function showInputDialog(message, defaultValue = '') {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = createElement('div', {
      styles: {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '20000'
      }
    });

    // Create dialog
    const dialog = createElement('div', {
      styles: {
        backgroundColor: 'var(--appBack)',
        padding: '20px',
        borderRadius: '8px',
        minWidth: '300px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }
    });

    // Message
    const messageEl = createElement('div', {
      text: message,
      styles: {
        marginBottom: '15px',
        color: 'var(--notesText)'
      }
    });

    // Input
    const input = createElement('input', {
      attrs: { type: 'text', value: defaultValue },
      styles: {
        width: '100%',
        padding: '8px',
        border: '1px solid var(--buttonsBorder)',
        borderRadius: '4px',
        marginBottom: '15px',
        boxSizing: 'border-box',
        backgroundColor: 'var(--notesBack)',
        color: 'var(--notesText)'
      }
    });

    // Buttons container
    const buttons = createElement('div', {
      styles: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px'
      }
    });

    // Cancel button
    const cancelBtn = createElement('button', {
      text: 'Cancel',
      styles: {
        padding: '8px 16px',
        backgroundColor: 'var(--appBack)',
        border: '1px solid var(--buttonsBorder)',
        borderRadius: '4px',
        cursor: 'pointer',
        color: 'var(--notesText)'
      }
    });

    // OK button
    const okBtn = createElement('button', {
      text: 'OK',
      styles: {
        padding: '8px 16px',
        backgroundColor: 'var(--buttonsBack)',
        color: 'var(--buttonsText)',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }
    });

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    okBtn.addEventListener('click', () => {
      cleanup();
      resolve(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        cleanup();
        resolve(input.value);
      } else if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(okBtn);
    dialog.appendChild(messageEl);
    dialog.appendChild(input);
    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus input and select text
    input.focus();
    input.select();
  });
}

/**
 * Show a custom confirm dialog (replacement for confirm())
 * @param {string} message - Message to display
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 */
export function showConfirmDialog(message) {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = createElement('div', {
      styles: {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '20000'
      }
    });

    // Create dialog
    const dialog = createElement('div', {
      styles: {
        backgroundColor: 'var(--appBack)',
        padding: '20px',
        borderRadius: '8px',
        minWidth: '300px',
        maxWidth: '400px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }
    });

    // Message
    const messageEl = createElement('div', {
      text: message,
      styles: {
        marginBottom: '20px',
        color: 'var(--notesText)'
      }
    });

    // Buttons container
    const buttons = createElement('div', {
      styles: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px'
      }
    });

    // Cancel button
    const cancelBtn = createElement('button', {
      text: 'Cancel',
      styles: {
        padding: '8px 16px',
        backgroundColor: 'var(--appBack)',
        border: '1px solid var(--buttonsBorder)',
        borderRadius: '4px',
        cursor: 'pointer',
        color: 'var(--notesText)'
      }
    });

    // OK button
    const okBtn = createElement('button', {
      text: 'OK',
      styles: {
        padding: '8px 16px',
        backgroundColor: 'var(--buttonsBack)',
        color: 'var(--buttonsText)',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }
    });

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    okBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter') {
        cleanup();
        document.removeEventListener('keydown', handler);
        resolve(true);
      } else if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', handler);
        resolve(false);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(okBtn);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus OK button
    okBtn.focus();
  });
}
