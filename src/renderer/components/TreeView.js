/**
 * TreeView - Hierarchical tree view component
 */

import { createElement, $, $$, addEvent, clearChildren, toggleClass } from '../ui/DOMHelper.js';

export class TreeView {
  /**
   * Create a TreeView component
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Options
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onSelect: options.onSelect || (() => {}),
      onDoubleClick: options.onDoubleClick || (() => {}),
      onContextMenu: options.onContextMenu || (() => {}),
      onExpand: options.onExpand || (() => {}),
      onCollapse: options.onCollapse || (() => {}),
      onDrop: options.onDrop || (() => {}),
      draggable: options.draggable !== false,
      ...options
    };

    this.data = [];
    this.selectedPath = null;
    this.expandedPaths = new Set();
    this.cleanups = [];
    this.draggedItem = null;
    this.draggedPath = null;

    this.init();
  }

  /**
   * Initialize the tree view
   */
  init() {
    this.container.classList.add('tree-view');
    this.bindEvents();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Click handler for selection and expand/collapse
    this.cleanups.push(
      addEvent(this.container, 'click', (e) => {
        const itemEl = e.target.closest('.tree-item');
        if (!itemEl) return;

        const path = itemEl.dataset.path;

        // Toggle expand if clicking on the toggle button
        if (e.target.classList.contains('tree-toggle')) {
          this.toggleExpand(path);
          return;
        }

        // Select the item
        this.select(path);
      })
    );

    // Double click handler
    this.cleanups.push(
      addEvent(this.container, 'dblclick', (e) => {
        const itemEl = e.target.closest('.tree-item');
        if (!itemEl) return;

        const path = itemEl.dataset.path;
        const item = this.findItem(path);
        if (item) {
          this.options.onDoubleClick(item, path);
        }
      })
    );

    // Context menu handler
    this.cleanups.push(
      addEvent(this.container, 'contextmenu', (e) => {
        const itemEl = e.target.closest('.tree-item');
        if (!itemEl) return;

        e.preventDefault();
        const path = itemEl.dataset.path;
        const item = this.findItem(path);
        if (item) {
          this.select(path);
          this.options.onContextMenu(item, path, e);
        }
      })
    );

    // Drag and drop handlers
    if (this.options.draggable) {
      this.currentDragTargetPath = null;

      this.cleanups.push(
        addEvent(this.container, 'dragstart', (e) => {
          const itemEl = e.target.closest('.tree-item');
          if (!itemEl) return;

          this.draggedPath = itemEl.dataset.path;
          this.draggedItem = this.findItem(this.draggedPath);
          itemEl.style.opacity = '0.5';
        })
      );

      this.cleanups.push(
        addEvent(this.container, 'dragend', (e) => {
          const itemEl = e.target.closest('.tree-item');
          if (itemEl) {
            itemEl.style.opacity = '';
          }
          // Clear any remaining highlight
          this.clearDragHighlight();
          this.draggedPath = null;
          this.draggedItem = null;
        })
      );

      this.cleanups.push(
        addEvent(this.container, 'dragover', (e) => {
          e.preventDefault();

          if (this.draggedPath) {
            const itemEl = e.target.closest('.tree-item');
            const targetPath = itemEl ? itemEl.dataset.path : null;

            // Only update if target changed
            if (targetPath !== this.currentDragTargetPath) {
              // Clear previous highlight
              this.clearDragHighlight();

              // Add highlight to new target (if not the dragged item)
              if (itemEl && targetPath !== this.draggedPath) {
                itemEl.classList.add('drag-target');
                this.currentDragTargetPath = targetPath;
              }
            }
          }
        })
      );

      this.cleanups.push(
        addEvent(this.container, 'dragleave', (e) => {
          // Only clear if leaving the container entirely
          if (!e.relatedTarget || !this.container.contains(e.relatedTarget)) {
            this.clearDragHighlight();
          }
        })
      );

      this.cleanups.push(
        addEvent(this.container, 'drop', (e) => {
          e.preventDefault();

          const itemEl = e.target.closest('.tree-item');
          const targetPath = itemEl ? itemEl.dataset.path : null;

          // Clear highlight
          this.clearDragHighlight();

          if (this.draggedPath && targetPath && targetPath !== this.draggedPath) {
            this.options.onDrop(this.draggedPath, targetPath, this.draggedItem);
          }

          this.draggedPath = null;
          this.draggedItem = null;
        })
      );
    }
  }

  /**
   * Clear drag highlight from all items
   */
  clearDragHighlight() {
    const highlighted = this.container.querySelector('.tree-item.drag-target');
    if (highlighted) {
      highlighted.classList.remove('drag-target');
    }
    this.currentDragTargetPath = null;
  }

  /**
   * Set tree data
   * @param {Array} data - Tree data array
   */
  setData(data) {
    this.data = data;
    this.render();
  }

  /**
   * Render the tree
   */
  render() {
    clearChildren(this.container);
    this.renderItems(this.data, this.container, 0);
  }

  /**
   * Render tree items
   * @param {Array} items - Items to render
   * @param {HTMLElement} parent - Parent element
   * @param {number} level - Nesting level
   */
  renderItems(items, parent, level) {
    items.forEach(item => {
      const path = item.path || item.name;
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = this.expandedPaths.has(path);
      const isSelected = path === this.selectedPath;

      // Build classes array, filtering out empty strings
      const itemClasses = ['tree-item'];
      if (isSelected) itemClasses.push('selected');
      if (hasChildren) itemClasses.push('has-children');

      const itemEl = createElement('div', {
        classes: itemClasses,
        data: { path },
        styles: { marginLeft: `${level * 16}px` },
        attrs: this.options.draggable ? { draggable: 'true' } : {}
      });

      // Toggle button (CSS creates the triangle)
      const toggleClasses = ['tree-toggle'];
      if (hasChildren) {
        if (isExpanded) toggleClasses.push('expanded');
      } else {
        toggleClasses.push('placeholder');
      }
      itemEl.appendChild(createElement('span', {
        classes: toggleClasses
      }));

      // Label
      itemEl.appendChild(createElement('span', {
        classes: ['tree-label'],
        text: item.name || item.label
      }));

      parent.appendChild(itemEl);

      // Render children if expanded
      if (hasChildren && isExpanded) {
        const childrenContainer = createElement('div', {
          classes: ['tree-children']
        });
        this.renderItems(item.children, childrenContainer, level + 1);
        parent.appendChild(childrenContainer);
      }
    });
  }

  /**
   * Select an item
   * @param {string} path - Item path
   */
  select(path) {
    this.selectedPath = path;

    // Update visual selection
    $$('.tree-item', this.container).forEach(el => {
      toggleClass(el, 'selected', el.dataset.path === path);
    });

    // Call callback
    const item = this.findItem(path);
    if (item) {
      this.options.onSelect(item, path);
    }
  }

  /**
   * Toggle expand/collapse
   * @param {string} path - Item path
   */
  toggleExpand(path) {
    if (this.expandedPaths.has(path)) {
      this.collapse(path);
    } else {
      this.expand(path);
    }
  }

  /**
   * Expand an item
   * @param {string} path - Item path
   */
  expand(path) {
    this.expandedPaths.add(path);
    this.render();

    const item = this.findItem(path);
    if (item) {
      this.options.onExpand(item, path);
    }
  }

  /**
   * Collapse an item
   * @param {string} path - Item path
   */
  collapse(path) {
    this.expandedPaths.delete(path);
    this.render();

    const item = this.findItem(path);
    if (item) {
      this.options.onCollapse(item, path);
    }
  }

  /**
   * Expand all items
   */
  expandAll() {
    this.collectPaths(this.data).forEach(path => {
      this.expandedPaths.add(path);
    });
    this.render();
  }

  /**
   * Collapse all items
   */
  collapseAll() {
    this.expandedPaths.clear();
    this.render();
  }

  /**
   * Collect all paths in the tree
   * @param {Array} items - Items to collect from
   * @returns {Array<string>}
   */
  collectPaths(items) {
    const paths = [];
    items.forEach(item => {
      const path = item.path || item.name;
      paths.push(path);
      if (item.children) {
        paths.push(...this.collectPaths(item.children));
      }
    });
    return paths;
  }

  /**
   * Find an item by path
   * @param {string} path - Item path
   * @returns {Object|null}
   */
  findItem(path) {
    return this.findItemRecursive(this.data, path);
  }

  /**
   * Recursively find an item
   * @param {Array} items - Items to search
   * @param {string} path - Path to find
   * @returns {Object|null}
   */
  findItemRecursive(items, path) {
    for (const item of items) {
      const itemPath = item.path || item.name;
      if (itemPath === path) {
        return item;
      }
      if (item.children) {
        const found = this.findItemRecursive(item.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Get the selected path
   * @returns {string|null}
   */
  getSelectedPath() {
    return this.selectedPath;
  }

  /**
   * Get the selected item
   * @returns {Object|null}
   */
  getSelectedItem() {
    return this.selectedPath ? this.findItem(this.selectedPath) : null;
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedPath = null;
    $$('.tree-item', this.container).forEach(el => {
      el.classList.remove('selected');
    });
  }

  /**
   * Refresh the tree (re-render with current data)
   */
  refresh() {
    this.render();
  }

  /**
   * Get the currently dragged path (for external coordination)
   * @returns {string|null}
   */
  getDraggedPath() {
    return this.draggedPath;
  }

  /**
   * Get the currently dragged item (for external coordination)
   * @returns {Object|null}
   */
  getDraggedItem() {
    return this.draggedItem;
  }

  /**
   * Handle an external drop onto a tree item
   * @param {HTMLElement} targetEl - Target element
   * @returns {string|null} Target path or null
   */
  getDropTargetPath(targetEl) {
    const itemEl = targetEl.closest('.tree-item');
    return itemEl ? itemEl.dataset.path : null;
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
