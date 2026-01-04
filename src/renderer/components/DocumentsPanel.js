/**
 * DocumentsPanel - Panel for managing hierarchical documents
 */

import { createElement, $, addEvent, clearChildren, showConfirmDialog } from '../ui/DOMHelper.js';
import { eventBus, Events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { documentsService } from '../services/DocumentsService.js';
import { TreeView } from './TreeView.js';
import { contextMenu } from './ContextMenu.js';
import { markdownRenderer } from './MarkdownRenderer.js';

export class DocumentsPanel {
  /**
   * Create a DocumentsPanel
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
    this.container = container;
    this.treeView = null;
    this.currentDoc = null;
    this.currentPage = null;
    this.isDirty = false;
    this.isDocumentMode = false;
    this.lastSavedText = '';
    this.cleanups = [];
    this.draggedPageEl = null;
    this.draggedPageName = null;
    this.contextSelectedPage = null;

    this.init();
  }

  /**
   * Initialize the panel
   */
  init() {
    this.render();
    this.bindEvents();
    this.loadDocuments();
  }

  /**
   * Render the panel
   */
  render() {
    this.container.innerHTML = `
      <div class="tab-footer"></div>
      <div class="docs-panel">
        <div class="docs-border">
          <div class="docs-toolbar">
            <button class="btn btn-add-doc" title="Add Document">+ ADD DOC</button>
            <button class="btn btn-expand-all btn-small" title="Expand All">+</button>
            <button class="btn btn-collapse-all btn-small" title="Collapse All">-</button>
          </div>
          <div class="docs-tree"></div>
        </div>
      </div>
    `;

    // Create tree view
    const treeContainer = $('.docs-tree', this.container);
    this.treeView = new TreeView(treeContainer, {
      onSelect: (item, path) => this.handleSelect(item, path),
      onContextMenu: (item, path, e) => this.handleContextMenu(item, path, e),
      onDrop: (srcPath, dstPath, item) => this.handleDocDrop(srcPath, dstPath)
    });

    // Get references to the main notes area for displaying document content
    this.notesTextareaEl = $('.notes-textarea');
    this.notesPreviewEl = $('.notes-preview');
    this.notesDateEl = $('.notes-date');

    // Get references to the pages sidebar
    this.pagesSidebar = $('#pages-sidebar');
    this.pagesSplitter = $('#pages-splitter');
    this.pagesList = $('#pages-list');
    this.addPageBtn = $('#btn-add-page');

    // Bind add page button
    if (this.addPageBtn) {
      addEvent(this.addPageBtn, 'click', () => this.addPage());
    }

    // Make + ADD DOC button a drop target for moving docs to root
    const addDocBtn = $('.btn-add-doc', this.container);
    if (addDocBtn) {
      addDocBtn.addEventListener('dragenter', (e) => {
        if (this.treeView.getDraggedPath()) {
          addDocBtn.classList.add('drag-target');
        }
      });

      addDocBtn.addEventListener('dragleave', () => {
        addDocBtn.classList.remove('drag-target');
      });

      addDocBtn.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      addDocBtn.addEventListener('drop', async (e) => {
        e.preventDefault();
        addDocBtn.classList.remove('drag-target');

        const draggedPath = this.treeView.getDraggedPath();
        if (draggedPath) {
          // Move document to root
          await documentsService.moveDocument(draggedPath, '');
          await this.loadDocuments();
        }
      });
    }

    // Setup global drag handlers for pages being dropped on tree items
    this.setupPageToDocDrop();
  }

  /**
   * Setup drag handlers for dropping pages onto documents
   */
  setupPageToDocDrop() {
    const treeContainer = $('.docs-tree', this.container);
    if (!treeContainer) return;

    // When a page is being dragged over the tree, highlight tree items
    treeContainer.addEventListener('dragenter', (e) => {
      if (this.draggedPageName) {
        const itemEl = e.target.closest('.tree-item');
        if (itemEl) {
          itemEl.classList.add('drag-target');
        }
      }
    });

    treeContainer.addEventListener('dragleave', (e) => {
      // Only handle dragleave for page drags, not document drags
      if (this.draggedPageName) {
        const itemEl = e.target.closest('.tree-item');
        if (itemEl) {
          itemEl.classList.remove('drag-target');
        }
      }
    });

    treeContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      const itemEl = e.target.closest('.tree-item');
      if (itemEl) {
        itemEl.classList.remove('drag-target');
      }

      // If we're dragging a page and dropping on a document
      if (this.draggedPageName && this.currentDoc && itemEl) {
        const targetDocPath = itemEl.dataset.path;
        if (targetDocPath && targetDocPath !== this.currentDoc) {
          await documentsService.movePageToDocument(this.currentDoc, this.draggedPageName, targetDocPath);
          await this.populatePagesList(this.currentDoc);
        }
      }
    });
  }

  /**
   * Show the pages sidebar
   */
  showPagesSidebar() {
    if (this.pagesSidebar) this.pagesSidebar.classList.remove('hidden');
    if (this.pagesSplitter) this.pagesSplitter.classList.remove('hidden');
  }

  /**
   * Hide the pages sidebar
   */
  hidePagesSidebar() {
    if (this.pagesSidebar) this.pagesSidebar.classList.add('hidden');
    if (this.pagesSplitter) this.pagesSplitter.classList.add('hidden');
  }

  /**
   * Populate the pages list for a document
   * @param {string} docPath - Document path
   */
  async populatePagesList(docPath) {
    if (!this.pagesList) return;

    clearChildren(this.pagesList);
    const pages = await documentsService.getPages(docPath);

    pages.forEach((page, index) => {
      const pageEl = createElement('div', {
        classes: ['page-item'],
        text: page.name,
        data: { docPath, pageName: page.name },
        attrs: { draggable: 'true' }
      });

      // Apply indent styling
      if (page.indent > 0) {
        pageEl.style.paddingLeft = `${10 + page.indent * 15}px`;
      }

      pageEl.addEventListener('click', () => {
        // Update selection
        this.pagesList.querySelectorAll('.page-item').forEach(el => el.classList.remove('selected'));
        pageEl.classList.add('selected');
        // Load the page
        this.loadPage(docPath, page.name);
      });

      // Context menu for pages
      pageEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.contextSelectedPage = page.name;
        this.showPageContextMenu(e.clientX, e.clientY, page);
      });

      // Drag start
      pageEl.addEventListener('dragstart', (e) => {
        this.draggedPageEl = pageEl;
        this.draggedPageName = page.name;
        pageEl.style.opacity = '0.5';
      });

      // Drag end
      pageEl.addEventListener('dragend', () => {
        pageEl.style.opacity = '';
        this.draggedPageEl = null;
        this.draggedPageName = null;
      });

      // Drag enter
      pageEl.addEventListener('dragenter', (e) => {
        if (this.draggedPageEl) {
          pageEl.classList.add('drag-target');
        }
      });

      // Drag leave
      pageEl.addEventListener('dragleave', () => {
        pageEl.classList.remove('drag-target');
      });

      // Drag over
      pageEl.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      // Drop
      pageEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        pageEl.classList.remove('drag-target');

        if (this.draggedPageName && this.draggedPageName !== page.name) {
          await this.swapPages(this.draggedPageName, page.name);
        }
      });

      this.pagesList.appendChild(pageEl);

      // Select first page by default
      if (index === 0) {
        pageEl.classList.add('selected');
        this.loadPage(docPath, page.name);
      }
    });
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Add document button
    this.cleanups.push(
      addEvent($('.btn-add-doc', this.container), 'click', () => this.addDocument())
    );

    // Expand all button
    this.cleanups.push(
      addEvent($('.btn-expand-all', this.container), 'click', () => this.treeView.expandAll())
    );

    // Collapse all button
    this.cleanups.push(
      addEvent($('.btn-collapse-all', this.container), 'click', () => this.treeView.collapseAll())
    );

    // Listen for document selection from search
    this.cleanups.push(
      eventBus.on(Events.DOC_SELECTED, ({ path, name }) => {
        this.selectPage(path, name);
      })
    );

    // Listen for save events to save current document page
    this.cleanups.push(
      eventBus.on(Events.NOTE_SAVED, () => {
        // If we're viewing a document, save it
        if (this.currentDoc && this.currentPage && this.isDocumentMode) {
          this.savePage();
        }
      })
    );

    // Hide pages sidebar when switching to different panel or selecting a date
    this.cleanups.push(
      eventBus.on(Events.PANEL_SWITCHED, ({ panel }) => {
        if (panel !== 'docs') {
          this.hidePagesSidebar();
        }
      })
    );

    this.cleanups.push(
      eventBus.on(Events.DATE_SELECTED, () => {
        this.hidePagesSidebar();
        this.clearDocumentMode();
      })
    );
  }

  /**
   * Load documents from database
   */
  async loadDocuments() {
    try {
      const paths = await documentsService.getAllDocumentPaths();
      const treeData = this.buildTree(paths);
      this.treeView.setData(treeData);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }

  /**
   * Build tree structure from paths (documents only, no pages)
   * Creates a hierarchical tree from paths like "Parent/Child/Grandchild"
   * @param {string[]} paths - Document paths
   * @returns {Array} Tree data
   */
  buildTree(paths) {
    const root = [];
    const nodeMap = new Map(); // Maps full path to node

    // Process paths in DocOrder (do NOT sort - preserve database order)
    for (const fullPath of paths) {
      // DocLocation uses "/" as the hierarchy delimiter
      const parts = fullPath.split('/');
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${name}` : name;

        // Skip if we already have this node
        if (nodeMap.has(currentPath)) continue;

        const node = {
          name: name,
          path: currentPath,
          type: 'document',
          children: []
        };

        nodeMap.set(currentPath, node);

        if (parentPath) {
          // Add to parent's children
          const parentNode = nodeMap.get(parentPath);
          if (parentNode) {
            parentNode.children.push(node);
          }
        } else {
          // Root level node
          root.push(node);
        }
      }
    }

    return root;
  }

  /**
   * Handle item selection
   * @param {Object} item - Selected item
   * @param {string} path - Item path
   */
  async handleSelect(item, path) {
    // Save current page if dirty
    if (this.isDirty && this.currentDoc && this.currentPage) {
      await this.savePage();
    }

    // Document selected - show pages sidebar and populate pages list
    this.currentDoc = path;
    this.showPagesSidebar();
    await this.populatePagesList(path);
  }

  /**
   * Load a page
   * @param {string} docPath - Document path
   * @param {string} pageName - Page name
   */
  async loadPage(docPath, pageName) {
    try {
      const page = await documentsService.getPage(docPath, pageName);

      if (page) {
        this.currentDoc = docPath;
        this.currentPage = pageName;
        this.isDocumentMode = true;
        this.lastSavedText = page.text || '';

        // Display in main notes area
        if (this.notesTextareaEl) {
          this.notesTextareaEl.value = page.text || '';
        }

        // Update the date display to show document/page name
        if (this.notesDateEl) {
          this.notesDateEl.textContent = `${docPath} > ${pageName}`;
        }

        // Update preview if in preview mode
        if (this.notesPreviewEl) {
          const html = markdownRenderer.render(page.text || '');
          this.notesPreviewEl.innerHTML = html;
        }

        eventBus.emit(Events.DOC_LOADED, { path: docPath, name: pageName, text: page.text });
      }
    } catch (error) {
      console.error('Failed to load page:', error);
    }
  }

  /**
   * Select a specific page
   * @param {string} docPath - Document path
   * @param {string} pageName - Page name
   */
  async selectPage(docPath, pageName) {
    await this.loadPage(docPath, pageName);
    this.treeView.select(docPath);
  }

  /**
   * Handle context menu for documents
   * @param {Object} item - Item
   * @param {string} path - Path
   * @param {MouseEvent} e - Event
   */
  handleContextMenu(item, path, e) {
    contextMenu.show(e.clientX, e.clientY, [
      {
        label: 'ADD DOC',
        action: () => this.addDocument(path)
      },
      {
        label: 'RENAME',
        action: () => this.renameDocument(path)
      },
      {
        label: 'REMOVE',
        action: () => this.deleteDocument(path)
      },
      {
        label: 'MOVE UP',
        action: () => this.moveDocUp(path)
      },
      {
        label: 'MOVE DOWN',
        action: () => this.moveDocDown(path)
      }
    ]);
  }

  /**
   * Show context menu for pages
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} page - Page object
   */
  showPageContextMenu(x, y, page) {
    contextMenu.show(x, y, [
      {
        label: 'RENAME',
        action: () => this.renamePage(page.name)
      },
      {
        label: 'REMOVE',
        action: () => this.deletePage(page.name)
      },
      {
        label: 'INCREASE INDENT',
        action: () => this.increasePageIndent(page.name)
      },
      {
        label: 'DECREASE INDENT',
        action: () => this.decreasePageIndent(page.name)
      },
      {
        label: 'MOVE UP',
        action: () => this.movePageUp(page.name)
      },
      {
        label: 'MOVE DOWN',
        action: () => this.movePageDown(page.name)
      }
    ]);
  }

  /**
   * Handle document drop (reorder/move)
   * @param {string} srcPath - Source document path
   * @param {string} dstPath - Destination document path
   */
  async handleDocDrop(srcPath, dstPath) {
    try {
      await documentsService.moveDocument(srcPath, dstPath);
      await this.loadDocuments();
    } catch (error) {
      console.error('Failed to move document:', error);
    }
  }

  /**
   * Swap two pages
   * @param {string} srcName - Source page name
   * @param {string} dstName - Destination page name
   */
  async swapPages(srcName, dstName) {
    if (!this.currentDoc) return;

    try {
      await documentsService.swapPages(this.currentDoc, srcName, dstName);
      await this.populatePagesList(this.currentDoc);
    } catch (error) {
      console.error('Failed to swap pages:', error);
    }
  }

  /**
   * Move document up in order
   * @param {string} path - Document path
   */
  async moveDocUp(path) {
    try {
      await documentsService.moveDocumentUp(path);
      await this.loadDocuments();
    } catch (error) {
      console.error('Failed to move document up:', error);
    }
  }

  /**
   * Move document down in order
   * @param {string} path - Document path
   */
  async moveDocDown(path) {
    try {
      await documentsService.moveDocumentDown(path);
      await this.loadDocuments();
    } catch (error) {
      console.error('Failed to move document down:', error);
    }
  }

  /**
   * Rename a page with inline editing
   * @param {string} pageName - Page name
   */
  async renamePage(pageName) {
    // Find the page element by iterating through all pages
    const allPages = this.pagesList?.querySelectorAll('.page-item');
    const pageEl = Array.from(allPages || []).find(el => el.dataset.pageName === pageName);
    if (!pageEl) return;
    return this.doInlinePageRename(pageEl, pageName);
  }

  /**
   * Perform inline rename on a page element
   * @param {HTMLElement} pageEl - Page element
   * @param {string} pageName - Original page name
   */
  async doInlinePageRename(pageEl, pageName) {
    const originalName = pageName;

    // Create input field that matches page-item styling exactly
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalName;
    input.className = 'inline-edit-input';
    input.style.cssText = `
      width: 100%;
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      color: inherit;
      font-size: inherit;
      font-weight: inherit;
      font-family: inherit;
      box-sizing: border-box;
      outline: none;
    `;

    // Store original content and replace with input
    const originalContent = pageEl.textContent;
    pageEl.textContent = '';
    pageEl.appendChild(input);
    input.focus();
    input.select();

    const finishEdit = async (save) => {
      const newName = input.value.trim();

      if (save && newName && newName !== originalName) {
        try {
          await documentsService.renamePage(this.currentDoc, originalName, newName);
          await this.populatePagesList(this.currentDoc);
          // Reselect the renamed page
          if (this.currentPage === originalName) {
            this.currentPage = newName;
          }
          // Find and select the renamed page element
          const allPages = this.pagesList?.querySelectorAll('.page-item');
          const renamedEl = Array.from(allPages || []).find(el => el.dataset.pageName === newName);
          if (renamedEl) {
            allPages.forEach(el => el.classList.remove('selected'));
            renamedEl.classList.add('selected');
          }
        } catch (error) {
          console.error('Failed to rename page:', error);
          pageEl.textContent = originalContent;
        }
      } else {
        pageEl.textContent = originalContent;
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(false);
      }
    });

    input.addEventListener('blur', () => {
      // Small delay to allow click events to process
      setTimeout(() => finishEdit(true), 100);
    });
  }

  /**
   * Delete a page
   * @param {string} pageName - Page name
   */
  async deletePage(pageName) {
    const confirmed = await showConfirmDialog('Are you sure you want to delete this page?');
    if (!confirmed) return;

    try {
      await documentsService.deletePage(this.currentDoc, pageName);
      await this.populatePagesList(this.currentDoc);
      if (this.currentPage === pageName) {
        this.currentPage = null;
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
    }
  }

  /**
   * Increase page indent
   * @param {string} pageName - Page name
   */
  async increasePageIndent(pageName) {
    try {
      await documentsService.changePageIndent(this.currentDoc, pageName, 1);
      await this.populatePagesList(this.currentDoc);
    } catch (error) {
      console.error('Failed to increase page indent:', error);
    }
  }

  /**
   * Decrease page indent
   * @param {string} pageName - Page name
   */
  async decreasePageIndent(pageName) {
    try {
      await documentsService.changePageIndent(this.currentDoc, pageName, -1);
      await this.populatePagesList(this.currentDoc);
    } catch (error) {
      console.error('Failed to decrease page indent:', error);
    }
  }

  /**
   * Move page up in order
   * @param {string} pageName - Page name
   */
  async movePageUp(pageName) {
    try {
      await documentsService.movePageUp(this.currentDoc, pageName);
      await this.populatePagesList(this.currentDoc);
    } catch (error) {
      console.error('Failed to move page up:', error);
    }
  }

  /**
   * Move page down in order
   * @param {string} pageName - Page name
   */
  async movePageDown(pageName) {
    try {
      await documentsService.movePageDown(this.currentDoc, pageName);
      await this.populatePagesList(this.currentDoc);
    } catch (error) {
      console.error('Failed to move page down:', error);
    }
  }

  /**
   * Add a new document with auto-generated unique name
   * @param {string} parentPath - Parent document path
   */
  async addDocument(parentPath = '') {
    try {
      // Generate unique name
      const baseName = 'New Document';
      const name = await this.getUniqueDocumentName(baseName, parentPath);

      await documentsService.createDocument(name, parentPath);
      await this.loadDocuments();

      // Select the new document and trigger rename
      const newPath = parentPath ? `${parentPath}/${name}` : name;
      this.treeView.select(newPath);

      // Trigger inline rename so user can immediately change the name
      setTimeout(() => this.renameDocument(newPath), 100);
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  }

  /**
   * Generate a unique document name
   * @param {string} baseName - Base name to use
   * @param {string} parentPath - Parent path
   * @returns {Promise<string>} Unique name
   */
  async getUniqueDocumentName(baseName, parentPath) {
    const paths = await documentsService.getAllDocumentPaths();

    // Get existing names at this level
    const existingNames = new Set();
    const prefix = parentPath ? `${parentPath}/` : '';

    paths.forEach(path => {
      if (parentPath) {
        // For child documents, check paths that start with parent
        if (path.startsWith(prefix)) {
          const remainder = path.slice(prefix.length);
          const name = remainder.split('/')[0];
          if (name) existingNames.add(name);
        }
      } else {
        // For root documents, get the first part of the path
        const name = path.split('/')[0];
        if (name) existingNames.add(name);
      }
    });

    // Find unique name
    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let counter = 1;
    while (existingNames.has(`${baseName} (${counter})`)) {
      counter++;
    }
    return `${baseName} (${counter})`;
  }

  /**
   * Add a new page with auto-generated unique name
   * @param {string} docPath - Document path
   */
  async addPage(docPath = null) {
    docPath = docPath || this.currentDoc;
    if (!docPath) {
      return;
    }

    try {
      // Generate unique name
      const baseName = 'New Page';
      const name = await this.getUniquePageName(baseName, docPath);

      await documentsService.createPage(docPath, name);
      await this.populatePagesList(docPath);

      // Find and select the new page, then trigger rename
      const allPages = this.pagesList?.querySelectorAll('.page-item');
      const newPageEl = Array.from(allPages || []).find(el => el.dataset.pageName === name);
      if (newPageEl) {
        allPages.forEach(el => el.classList.remove('selected'));
        newPageEl.classList.add('selected');
        this.currentPage = name;

        // Trigger inline rename so user can immediately change the name
        setTimeout(() => this.renamePage(name), 100);
      }
    } catch (error) {
      console.error('Failed to create page:', error);
    }
  }

  /**
   * Generate a unique page name within a document
   * @param {string} baseName - Base name to use
   * @param {string} docPath - Document path
   * @returns {Promise<string>} Unique name
   */
  async getUniquePageName(baseName, docPath) {
    const pages = await documentsService.getPages(docPath);
    const existingNames = new Set(pages.map(p => p.name));

    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let counter = 1;
    while (existingNames.has(`${baseName} (${counter})`)) {
      counter++;
    }
    return `${baseName} (${counter})`;
  }

  /**
   * Rename a document with inline editing
   * @param {string} path - Document path
   */
  async renameDocument(path) {
    // Find the tree item element
    const treeContainer = $('.docs-tree', this.container);
    const treeItem = treeContainer?.querySelector(`[data-path="${path}"]`);
    if (!treeItem) return;

    const labelEl = treeItem.querySelector('.tree-label');
    if (!labelEl) return;

    const parts = path.split('/');
    const originalName = parts[parts.length - 1];

    // Create input field that matches tree-label styling exactly
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalName;
    input.className = 'inline-edit-input';
    input.style.cssText = `
      flex: 1;
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      color: inherit;
      font-size: inherit;
      font-family: inherit;
      box-sizing: border-box;
      outline: none;
      min-width: 50px;
    `;

    // Replace label with input
    labelEl.style.display = 'none';
    treeItem.insertBefore(input, labelEl);
    input.focus();
    input.select();

    let finished = false;

    const finishEdit = async (save) => {
      if (finished) return;
      finished = true;

      const newName = input.value.trim();
      input.remove();
      labelEl.style.display = '';

      if (save && newName && newName !== originalName) {
        try {
          await documentsService.renameDocument(path, newName);
          await this.loadDocuments();
          // Reselect the renamed document
          const newPath = parts.slice(0, -1).concat(newName).join('/') || newName;
          this.treeView.select(newPath);
        } catch (error) {
          console.error('Failed to rename document:', error);
        }
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finishEdit(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finishEdit(false);
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => finishEdit(true), 100);
    });

    // Prevent click from triggering tree selection
    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Delete a document
   * @param {string} path - Document path
   */
  async deleteDocument(path) {
    const confirmed = await showConfirmDialog('Are you sure you want to delete this document and all its pages?');
    if (!confirmed) return;

    try {
      await documentsService.deleteDocument(path);
      await this.loadDocuments();

      if (this.currentDoc === path) {
        this.currentDoc = null;
        this.currentPage = null;
        this.textareaEl.value = '';
        this.previewEl.innerHTML = '';
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  }

  /**
   * Save the current page
   */
  async savePage() {
    if (!this.currentDoc || !this.currentPage) return;

    try {
      const text = this.notesTextareaEl?.value || '';
      await documentsService.savePage(this.currentDoc, this.currentPage, text);
      this.lastSavedText = text;
      this.isDirty = false;
      state.set('documentDirty', false);
    } catch (error) {
      console.error('Failed to save page:', error);
    }
  }

  /**
   * Check if document content has changed
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    if (!this.isDocumentMode) return false;
    const currentText = this.notesTextareaEl?.value || '';
    return currentText !== this.lastSavedText;
  }

  /**
   * Clear document mode (when switching back to notes)
   */
  clearDocumentMode() {
    this.isDocumentMode = false;
    this.currentDoc = null;
    this.currentPage = null;
  }

  /**
   * Set spell checking - no longer needed as we use main notes area
   * @param {boolean} enabled - Whether enabled
   */
  setSpellCheck(enabled) {
    // Spell check is handled by the main NotesEditor
  }

  /**
   * Cleanup
   */
  destroy() {
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
    this.treeView?.destroy();
  }
}
