/**
 * DocumentsService - Service for managing hierarchical documents and pages
 */

import { database } from '../database/Database.js';
import { QueryBuilder } from '../database/QueryBuilder.js';
import { Document, DOC_DELIMITER } from '../models/Document.js';
import { eventBus, Events } from '../core/EventBus.js';

export class DocumentsService {
  /**
   * Get all root documents (documents at the top level)
   * @returns {Promise<Document[]>}
   */
  async getRootDocuments() {
    const sql = `
      SELECT DISTINCT DocLocation FROM Docs
      WHERE DocLocation IS NOT NULL AND DocLocation != ''
      AND DocIndentLevel = 0
      ORDER BY DocOrder ASC
    `;

    const rows = await database.query(sql, []);

    // Get unique root document names
    const rootDocs = new Set();
    rows.forEach(row => {
      const parts = row.DocLocation.split(DOC_DELIMITER);
      if (parts[0]) {
        rootDocs.add(parts[0]);
      }
    });

    return Array.from(rootDocs).map((name, index) =>
      new Document({ name, location: '', order: index })
    );
  }

  /**
   * Get all unique document locations (for tree building)
   * @returns {Promise<string[]>}
   */
  async getAllDocumentPaths() {
    const sql = `
      SELECT DISTINCT DocLocation, MIN(DocOrder) as docOrder FROM Docs
      WHERE DocLocation IS NOT NULL AND DocLocation != ''
      GROUP BY DocLocation
      ORDER BY docOrder ASC
    `;

    const rows = await database.query(sql, []);
    return rows.map(row => row.DocLocation);
  }

  /**
   * Get pages for a document
   * @param {string} documentPath - Full document path
   * @returns {Promise<Document[]>}
   */
  async getPages(documentPath) {
    const { sql, params } = QueryBuilder.select('Docs')
      .select(['*'])
      .where('DocLocation', '=', documentPath)
      .orderBy('PageOrder', 'ASC')
      .build();

    const rows = await database.query(sql, params);
    return rows.map(row => Document.fromRow(row));
  }

  /**
   * Get a specific page
   * @param {string} documentPath - Document path
   * @param {string} pageName - Page name
   * @returns {Promise<Document|null>}
   */
  async getPage(documentPath, pageName) {
    const sql = `
      SELECT * FROM Docs
      WHERE DocLocation = ? AND DocName = ?
      LIMIT 1
    `;

    const row = await database.get(sql, [documentPath, pageName]);
    return Document.fromRow(row);
  }

  /**
   * Create a new document
   * @param {string} name - Document name
   * @param {string} parentPath - Parent document path (empty for root)
   * @returns {Promise<Document>}
   */
  async createDocument(name, parentPath = '') {
    const fullPath = parentPath ? `${parentPath}${DOC_DELIMITER}${name}` : name;

    // Check if document already exists
    const exists = await this.documentExists(fullPath);
    if (exists) {
      // Generate unique name
      name = await this.generateUniqueName(name, parentPath);
    }

    // Get next order
    const order = await this.getNextDocOrder();

    // Create the document with a default first page
    const doc = Document.create(name, parentPath || fullPath, order);

    // Insert into database
    const { sql, params } = QueryBuilder.insert('Docs')
      .values({
        DocName: 'Page 1',
        DocLocation: parentPath ? `${parentPath}${DOC_DELIMITER}${name}` : name,
        DocColor: 0,
        DocText: '',
        LastModified: new Date().toISOString(),
        DocIndentLevel: 0,
        DocOrder: order,
        PageOrder: 0
      })
      .build();

    await database.run(sql, params);
    eventBus.emit(Events.DOC_CREATED, doc);
    return doc;
  }

  /**
   * Create a new page in a document
   * @param {string} documentPath - Document path
   * @param {string} pageName - Page name
   * @param {number} indentLevel - Indent level
   * @returns {Promise<Document>}
   */
  async createPage(documentPath, pageName, indentLevel = 0) {
    // Get next page order for this document
    const pageOrder = await this.getNextPageOrder(documentPath);

    const { sql, params } = QueryBuilder.insert('Docs')
      .values({
        DocName: pageName,
        DocLocation: documentPath,
        DocColor: 0,
        DocText: '',
        LastModified: new Date().toISOString(),
        DocIndentLevel: indentLevel,
        DocOrder: 0,
        PageOrder: pageOrder
      })
      .build();

    const result = await database.run(sql, params);

    const page = new Document({
      id: result.lastInsertRowid,
      name: pageName,
      location: documentPath,
      indentLevel,
      pageOrder
    });

    eventBus.emit(Events.PAGE_SAVED, page);
    return page;
  }

  /**
   * Save page content
   * @param {string} documentPath - Document path
   * @param {string} pageName - Page name
   * @param {string} text - Page content
   * @returns {Promise<Document|null>}
   */
  async savePage(documentPath, pageName, text) {
    const sql = `
      UPDATE Docs SET DocText = ?, LastModified = ?
      WHERE DocLocation = ? AND DocName = ?
    `;

    await database.run(sql, [text, new Date().toISOString(), documentPath, pageName]);

    const page = await this.getPage(documentPath, pageName);
    if (page) {
      eventBus.emit(Events.PAGE_SAVED, page);
    }
    return page;
  }

  /**
   * Rename a document
   * @param {string} oldPath - Old document path
   * @param {string} newName - New document name
   * @returns {Promise<boolean>}
   */
  async renameDocument(oldPath, newName) {
    const parts = oldPath.split(DOC_DELIMITER);
    const parentPath = parts.slice(0, -1).join(DOC_DELIMITER);
    const newPath = parentPath ? `${parentPath}${DOC_DELIMITER}${newName}` : newName;

    // Update all pages in this document
    const sql = `
      UPDATE Docs SET DocLocation = ?
      WHERE DocLocation = ?
    `;

    await database.run(sql, [newPath, oldPath]);

    // Update child documents (those that have this document in their path)
    const updateChildrenSql = `
      UPDATE Docs SET DocLocation = REPLACE(DocLocation, ?, ?)
      WHERE DocLocation LIKE ?
    `;

    await database.run(updateChildrenSql, [oldPath, newPath, `${oldPath}${DOC_DELIMITER}%`]);

    eventBus.emit(Events.DOC_RENAMED, { oldPath, newPath, newName });
    return true;
  }

  /**
   * Rename a page
   * @param {string} documentPath - Document path
   * @param {string} oldName - Old page name
   * @param {string} newName - New page name
   * @returns {Promise<boolean>}
   */
  async renamePage(documentPath, oldName, newName) {
    const sql = `
      UPDATE Docs SET DocName = ?, LastModified = ?
      WHERE DocLocation = ? AND DocName = ?
    `;

    await database.run(sql, [newName, new Date().toISOString(), documentPath, oldName]);
    return true;
  }

  /**
   * Delete a document and all its pages/children
   * @param {string} documentPath - Document path
   * @returns {Promise<boolean>}
   */
  async deleteDocument(documentPath) {
    // Delete all pages in this document
    let sql = 'DELETE FROM Docs WHERE DocLocation = ?';
    await database.run(sql, [documentPath]);

    // Delete all child documents
    sql = 'DELETE FROM Docs WHERE DocLocation LIKE ?';
    await database.run(sql, [`${documentPath}${DOC_DELIMITER}%`]);

    eventBus.emit(Events.DOC_DELETED, { path: documentPath });
    return true;
  }

  /**
   * Delete a page
   * @param {string} documentPath - Document path
   * @param {string} pageName - Page name
   * @returns {Promise<boolean>}
   */
  async deletePage(documentPath, pageName) {
    const sql = 'DELETE FROM Docs WHERE DocLocation = ? AND DocName = ?';
    await database.run(sql, [documentPath, pageName]);
    return true;
  }

  /**
   * Update page order
   * @param {string} documentPath - Document path
   * @param {string} pageName - Page name
   * @param {number} newOrder - New page order
   * @returns {Promise<boolean>}
   */
  async updatePageOrder(documentPath, pageName, newOrder) {
    const sql = 'UPDATE Docs SET PageOrder = ? WHERE DocLocation = ? AND DocName = ?';
    await database.run(sql, [newOrder, documentPath, pageName]);
    return true;
  }

  /**
   * Update page indent level
   * @param {string} documentPath - Document path
   * @param {string} pageName - Page name
   * @param {number} indentLevel - New indent level
   * @returns {Promise<boolean>}
   */
  async updatePageIndent(documentPath, pageName, indentLevel) {
    const sql = 'UPDATE Docs SET DocIndentLevel = ? WHERE DocLocation = ? AND DocName = ?';
    await database.run(sql, [indentLevel, documentPath, pageName]);
    return true;
  }

  /**
   * Swap two pages' orders
   * @param {string} documentPath - Document path
   * @param {string} page1Name - First page name
   * @param {string} page2Name - Second page name
   * @returns {Promise<boolean>}
   */
  async swapPages(documentPath, page1Name, page2Name) {
    const page1 = await this.getPage(documentPath, page1Name);
    const page2 = await this.getPage(documentPath, page2Name);

    if (!page1 || !page2) return false;

    await this.updatePageOrder(documentPath, page1Name, page2.pageOrder);
    await this.updatePageOrder(documentPath, page2Name, page1.pageOrder);

    return true;
  }

  /**
   * Check if a document exists
   * @param {string} documentPath - Document path
   * @returns {Promise<boolean>}
   */
  async documentExists(documentPath) {
    const sql = 'SELECT COUNT(*) as count FROM Docs WHERE DocLocation = ?';
    const row = await database.get(sql, [documentPath]);
    return (row?.count || 0) > 0;
  }

  /**
   * Get next document order number
   * @returns {Promise<number>}
   */
  async getNextDocOrder() {
    const sql = 'SELECT MAX(DocOrder) as maxOrder FROM Docs';
    const row = await database.get(sql, []);
    return (row?.maxOrder || 0) + 1;
  }

  /**
   * Get next page order number for a document
   * @param {string} documentPath - Document path
   * @returns {Promise<number>}
   */
  async getNextPageOrder(documentPath) {
    const sql = 'SELECT MAX(PageOrder) as maxOrder FROM Docs WHERE DocLocation = ?';
    const row = await database.get(sql, [documentPath]);
    return (row?.maxOrder || 0) + 1;
  }

  /**
   * Generate a unique document name
   * @param {string} baseName - Base name
   * @param {string} parentPath - Parent path
   * @returns {Promise<string>}
   */
  async generateUniqueName(baseName, parentPath) {
    let name = baseName;
    let counter = 1;

    while (await this.documentExists(parentPath ? `${parentPath}${DOC_DELIMITER}${name}` : name)) {
      name = `${baseName} (${counter})`;
      counter++;
    }

    return name;
  }

  /**
   * Move document - if same parent, swap. Otherwise move into target.
   * @param {string} srcPath - Source document path
   * @param {string} dstPath - Destination document path (empty string for root)
   * @returns {Promise<boolean>}
   */
  async moveDocument(srcPath, dstPath) {
    const srcParts = srcPath.split(DOC_DELIMITER);
    const srcName = srcParts[srcParts.length - 1];
    const srcParentPath = srcParts.slice(0, -1).join(DOC_DELIMITER);

    const dstParts = dstPath ? dstPath.split(DOC_DELIMITER) : [];
    const dstParentPath = dstParts.slice(0, -1).join(DOC_DELIMITER);

    if (srcParentPath === dstParentPath && dstPath) {
      // Same parent - swap positions
      return await this.swapDocuments(srcPath, dstPath);
    } else {
      // Different parent - move into destination
      const newPath = dstPath ? `${dstPath}${DOC_DELIMITER}${srcName}` : srcName;

      // Make sure we're not moving into ourselves
      if (dstPath.startsWith(srcPath + DOC_DELIMITER) || dstPath === srcPath) {
        return false;
      }

      // Generate unique name if needed
      const uniquePath = await this.getUniqueDocPath(newPath);
      return await this.updateDocumentLocation(srcPath, uniquePath);
    }
  }

  /**
   * Swap two documents' orders
   * @param {string} path1 - First document path
   * @param {string} path2 - Second document path
   * @returns {Promise<boolean>}
   */
  async swapDocuments(path1, path2) {
    const sql1 = 'SELECT MIN(DocOrder) as docOrder FROM Docs WHERE DocLocation = ? OR DocLocation LIKE ?';
    const row1 = await database.get(sql1, [path1, `${path1}${DOC_DELIMITER}%`]);

    const sql2 = 'SELECT MIN(DocOrder) as docOrder FROM Docs WHERE DocLocation = ? OR DocLocation LIKE ?';
    const row2 = await database.get(sql2, [path2, `${path2}${DOC_DELIMITER}%`]);

    if (!row1 || !row2) return false;

    let order1 = row1.docOrder;
    let order2 = row2.docOrder;

    // If orders are the same, we can't just swap - need to assign distinct values
    if (order1 === order2) {
      order1 = await this.getNextDocOrder();
      order2 = order1 + 1;
    }

    // Swap the orders using a temp value to avoid conflicts
    const tempOrder = -1;

    // Set path1 to temp first
    await database.run(
      'UPDATE Docs SET DocOrder = ? WHERE DocLocation = ? OR DocLocation LIKE ?',
      [tempOrder, path1, `${path1}${DOC_DELIMITER}%`]
    );

    // Set path2 to path1's original order
    await database.run(
      'UPDATE Docs SET DocOrder = ? WHERE DocLocation = ? OR DocLocation LIKE ?',
      [order1, path2, `${path2}${DOC_DELIMITER}%`]
    );

    // Set path1 to path2's original order
    await database.run(
      'UPDATE Docs SET DocOrder = ? WHERE DocLocation = ? OR DocLocation LIKE ?',
      [order2, path1, `${path1}${DOC_DELIMITER}%`]
    );

    return true;
  }

  /**
   * Update document location (move document and all children)
   * @param {string} oldPath - Old document path
   * @param {string} newPath - New document path
   * @returns {Promise<boolean>}
   */
  async updateDocumentLocation(oldPath, newPath) {
    // Update the document itself
    await database.run(
      'UPDATE Docs SET DocLocation = ? WHERE DocLocation = ?',
      [newPath, oldPath]
    );

    // Update all child documents
    await database.run(
      'UPDATE Docs SET DocLocation = REPLACE(DocLocation, ?, ?) WHERE DocLocation LIKE ?',
      [oldPath, newPath, `${oldPath}${DOC_DELIMITER}%`]
    );

    return true;
  }

  /**
   * Get unique document path (append number if exists)
   * @param {string} basePath - Base path
   * @returns {Promise<string>}
   */
  async getUniqueDocPath(basePath) {
    let path = basePath;
    let counter = 1;

    while (await this.documentExists(path)) {
      const parts = basePath.split(DOC_DELIMITER);
      const name = parts[parts.length - 1];
      parts[parts.length - 1] = `${name} (${counter})`;
      path = parts.join(DOC_DELIMITER);
      counter++;
    }

    return path;
  }

  /**
   * Move a page to a different document
   * @param {string} srcDocPath - Source document path
   * @param {string} pageName - Page name
   * @param {string} dstDocPath - Destination document path
   * @returns {Promise<boolean>}
   */
  async movePageToDocument(srcDocPath, pageName, dstDocPath) {
    // Get the next page order in the destination document
    const newPageOrder = await this.getNextPageOrder(dstDocPath);

    // Update the page's document location
    const sql = `
      UPDATE Docs SET DocLocation = ?, PageOrder = ?
      WHERE DocLocation = ? AND DocName = ?
    `;

    await database.run(sql, [dstDocPath, newPageOrder, srcDocPath, pageName]);
    return true;
  }

  /**
   * Move document up in order
   * @param {string} docPath - Document path
   * @returns {Promise<boolean>}
   */
  async moveDocumentUp(docPath) {
    // Get parent path
    const parts = docPath.split(DOC_DELIMITER);
    const parentPath = parts.slice(0, -1).join(DOC_DELIMITER);

    // Get all siblings at this level, ordered by DocOrder
    let siblingsSql;
    let siblingsParams;

    if (parentPath) {
      siblingsSql = `
        SELECT DISTINCT DocLocation, MIN(DocOrder) as docOrder FROM Docs
        WHERE DocLocation LIKE ? AND DocLocation NOT LIKE ?
        GROUP BY DocLocation
        ORDER BY docOrder ASC
      `;
      siblingsParams = [`${parentPath}${DOC_DELIMITER}%`, `${parentPath}${DOC_DELIMITER}%${DOC_DELIMITER}%`];
    } else {
      siblingsSql = `
        SELECT DISTINCT DocLocation, MIN(DocOrder) as docOrder FROM Docs
        WHERE DocLocation NOT LIKE '%${DOC_DELIMITER}%'
        GROUP BY DocLocation
        ORDER BY docOrder ASC
      `;
      siblingsParams = [];
    }

    const siblings = await database.query(siblingsSql, siblingsParams);
    if (!siblings || siblings.length < 2) return false;

    // Find current document's position in siblings
    const currentIndex = siblings.findIndex(s => s.DocLocation === docPath);
    if (currentIndex <= 0) return false;

    // Swap with previous sibling
    const prevSibling = siblings[currentIndex - 1];
    return await this.swapDocuments(docPath, prevSibling.DocLocation);
  }

  /**
   * Move document down in order
   * @param {string} docPath - Document path
   * @returns {Promise<boolean>}
   */
  async moveDocumentDown(docPath) {
    // Get parent path
    const parts = docPath.split(DOC_DELIMITER);
    const parentPath = parts.slice(0, -1).join(DOC_DELIMITER);

    // Get all siblings at this level, ordered by DocOrder
    let siblingsSql;
    let siblingsParams;

    if (parentPath) {
      siblingsSql = `
        SELECT DISTINCT DocLocation, MIN(DocOrder) as docOrder FROM Docs
        WHERE DocLocation LIKE ? AND DocLocation NOT LIKE ?
        GROUP BY DocLocation
        ORDER BY docOrder ASC
      `;
      siblingsParams = [`${parentPath}${DOC_DELIMITER}%`, `${parentPath}${DOC_DELIMITER}%${DOC_DELIMITER}%`];
    } else {
      siblingsSql = `
        SELECT DISTINCT DocLocation, MIN(DocOrder) as docOrder FROM Docs
        WHERE DocLocation NOT LIKE '%${DOC_DELIMITER}%'
        GROUP BY DocLocation
        ORDER BY docOrder ASC
      `;
      siblingsParams = [];
    }

    const siblings = await database.query(siblingsSql, siblingsParams);
    if (!siblings || siblings.length < 2) return false;

    // Find current document's position in siblings
    const currentIndex = siblings.findIndex(s => s.DocLocation === docPath);
    if (currentIndex < 0 || currentIndex >= siblings.length - 1) return false; // Already at bottom or not found

    // Swap with next sibling
    const nextSibling = siblings[currentIndex + 1];
    return await this.swapDocuments(docPath, nextSibling.DocLocation);
  }

  /**
   * Change page indent level
   * @param {string} documentPath - Document path
   * @param {string} pageName - Page name
   * @param {number} delta - Change in indent (+1 or -1)
   * @returns {Promise<boolean>}
   */
  async changePageIndent(documentPath, pageName, delta) {
    const page = await this.getPage(documentPath, pageName);
    if (!page) return false;

    const newIndent = Math.max(0, (page.indent || 0) + delta);
    return await this.updatePageIndent(documentPath, pageName, newIndent);
  }

  /**
   * Move page up in order
   * @param {string} documentPath - Document path
   * @param {string} pageName - Page name
   * @returns {Promise<boolean>}
   */
  async movePageUp(documentPath, pageName) {
    const page = await this.getPage(documentPath, pageName);
    if (!page) return false;

    // Find page with next lower order
    const prevSql = `
      SELECT DocName, PageOrder FROM Docs
      WHERE DocLocation = ? AND PageOrder < ?
      ORDER BY PageOrder DESC
      LIMIT 1
    `;

    const prev = await database.get(prevSql, [documentPath, page.pageOrder]);
    if (!prev) return false;

    // Swap orders
    return await this.swapPages(documentPath, pageName, prev.DocName);
  }

  /**
   * Move page down in order
   * @param {string} documentPath - Document path
   * @param {string} pageName - Page name
   * @returns {Promise<boolean>}
   */
  async movePageDown(documentPath, pageName) {
    const page = await this.getPage(documentPath, pageName);
    if (!page) return false;

    // Find page with next higher order
    const nextSql = `
      SELECT DocName, PageOrder FROM Docs
      WHERE DocLocation = ? AND PageOrder > ?
      ORDER BY PageOrder ASC
      LIMIT 1
    `;

    const next = await database.get(nextSql, [documentPath, page.pageOrder]);
    if (!next) return false;

    // Swap orders
    return await this.swapPages(documentPath, pageName, next.DocName);
  }

  /**
   * Search documents and pages
   * @param {string[]} searchTerms - Search terms
   * @returns {Promise<{path: string, name: string, text: string, preview: string}[]>}
   */
  async search(searchTerms) {
    if (!searchTerms || searchTerms.length === 0) {
      return [];
    }

    const conditions = searchTerms.map(() => 'DocText LIKE ?').join(' AND ');
    const params = searchTerms.map(term => `%${term}%`);

    const sql = `
      SELECT DocLocation, DocName, DocText FROM Docs
      WHERE ${conditions}
      ORDER BY DocLocation, PageOrder
    `;

    const rows = await database.query(sql, params);

    return rows.map(row => ({
      path: row.DocLocation,
      name: row.DocName,
      text: row.DocText,
      preview: row.DocText?.substring(0, 200) || ''
    }));
  }
}

// Export singleton instance
export const documentsService = new DocumentsService();
