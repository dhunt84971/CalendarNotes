/**
 * ExportService - Handles exporting documents and pages to DOCX and PDF
 */

import { eventBus, Events } from '../core/EventBus.js';
import { documentsService } from './DocumentsService.js';
import { marked } from 'marked';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ExternalHyperlink,
  PageNumber, Footer, Header, ShadingType, convertInchesToTwip,
  Bookmark, InternalHyperlink, TabStopType, TabStopPosition, LeaderType,
  PageReference
} from 'docx';

/**
 * Sanitize a string for use as a filename
 * @param {string} name - Raw name
 * @returns {string} Safe filename
 */
export function sanitizeFilename(name) {
  let sanitized = name.replace(/[\\/:*?"<>|]/g, '_');
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  sanitized = sanitized.substring(0, 255);
  return sanitized || 'Untitled';
}

/**
 * Demote all markdown headers by one level
 * @param {string} markdown - Markdown text
 * @returns {string} Markdown with demoted headers
 */
function demoteHeaders(markdown) {
  return markdown.replace(/^(#{1,5})\s/gm, '$1# ');
}

/**
 * Preprocess markdown to fix patterns that confuse the parser.
 * Strips leading "- " from lines that begin a markdown table so the
 * lexer recognises the table instead of treating it as a list item.
 * @param {string} markdown - Raw markdown text
 * @returns {string} Cleaned markdown
 */
function preprocessMarkdown(markdown) {
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    // Check if this line starts with "- |" and next line is a separator row
    const match = lines[i].match(/^\s*-\s*(\|.+)$/);
    if (match && /^\s*\|[\s:|-]+\|/.test(lines[i + 1])) {
      lines[i] = match[1]; // strip the leading "- "
    }
  }
  return lines.join('\n');
}

/**
 * Parse markdown tokens using marked lexer
 * @param {string} markdown - Markdown text
 * @returns {Array} Token array
 */
function parseMarkdown(markdown) {
  return marked.lexer(preprocessMarkdown(markdown));
}

/**
 * Decode HTML entities back to plain text
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
function decodeEntities(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

/**
 * Convert inline tokens to docx TextRun array
 * @param {Array} tokens - Inline tokens from marked
 * @returns {TextRun[]}
 */
function inlineTokensToTextRuns(tokens) {
  if (!tokens || tokens.length === 0) return [new TextRun('')];
  const runs = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        runs.push(new TextRun({ text: decodeEntities(token.text) }));
        break;
      case 'strong':
        runs.push(...(token.tokens || []).map(t =>
          new TextRun({ text: decodeEntities(t.raw || t.text || ''), bold: true })
        ));
        break;
      case 'em':
        runs.push(...(token.tokens || []).map(t =>
          new TextRun({ text: decodeEntities(t.raw || t.text || ''), italics: true })
        ));
        break;
      case 'del':
        runs.push(...(token.tokens || []).map(t =>
          new TextRun({ text: decodeEntities(t.raw || t.text || ''), strike: true })
        ));
        break;
      case 'codespan':
        runs.push(new TextRun({
          text: decodeEntities(token.text),
          font: 'Courier New',
          shading: { type: ShadingType.SOLID, color: 'E8E8E8' }
        }));
        break;
      case 'link':
        runs.push(new ExternalHyperlink({
          link: token.href,
          children: [new TextRun({ text: decodeEntities(token.text), color: '0563C1', underline: {} })]
        }));
        break;
      case 'br':
        runs.push(new TextRun({ break: 1 }));
        break;
      case 'escape':
        runs.push(new TextRun({ text: decodeEntities(token.text) }));
        break;
      default:
        if (token.raw) runs.push(new TextRun({ text: decodeEntities(token.raw) }));
        break;
    }
  }

  return runs.length > 0 ? runs : [new TextRun('')];
}

/**
 * Map markdown alignment to docx AlignmentType
 * @param {string} align - 'left', 'center', 'right', or null
 * @returns {string}
 */
function mapAlignment(align) {
  switch (align) {
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    default: return AlignmentType.LEFT;
  }
}

/**
 * Convert a markdown table token to a docx Table
 * @param {Object} token - Table token from marked lexer
 * @returns {Table}
 */
function tableTokenToDocx(token) {
  const allRows = [];
  const aligns = token.align || [];

  // Header row
  const headerCells = token.header.map((cell, i) => {
    return new TableCell({
      children: [new Paragraph({
        children: inlineTokensToTextRuns(cell.tokens),
        alignment: mapAlignment(aligns[i])
      })],
      shading: { type: ShadingType.SOLID, color: 'D9E2F3' }
    });
  });
  allRows.push(new TableRow({ children: headerCells, tableHeader: true }));

  // Data rows
  for (const row of token.rows) {
    const cells = row.map((cell, i) => {
      return new TableCell({
        children: [new Paragraph({
          children: inlineTokensToTextRuns(cell.tokens),
          alignment: mapAlignment(aligns[i])
        })]
      });
    });
    allRows.push(new TableRow({ children: cells }));
  }

  return new Table({
    rows: allRows,
    width: { size: 100, type: WidthType.PERCENTAGE }
  });
}

/**
 * Convert a list token to docx paragraphs
 * @param {Object} token - List token from marked lexer
 * @param {number} level - Nesting level
 * @returns {Paragraph[]}
 */
function listTokenToDocx(token, level = 0) {
  const paragraphs = [];
  const isOrdered = token.ordered;

  token.items.forEach((item, index) => {
    const bullet = isOrdered ? `${token.start + index}.` : '\u2022';
    const indent = level * 360;

    // Get text runs from the item's inline tokens
    const textTokens = item.tokens?.find(t => t.type === 'text');
    const runs = textTokens?.tokens
      ? inlineTokensToTextRuns(textTokens.tokens)
      : [new TextRun({ text: decodeEntities(item.text || '') })];

    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: `${bullet} ` }),
        ...runs
      ],
      indent: { left: convertInchesToTwip(0.25) + indent }
    }));

    // Handle nested lists
    for (const subToken of (item.tokens || [])) {
      if (subToken.type === 'list') {
        paragraphs.push(...listTokenToDocx(subToken, level + 1));
      }
    }
  });

  return paragraphs;
}

/**
 * Convert markdown tokens to docx elements
 * @param {Array} tokens - Token array from marked lexer
 * @returns {Array} Array of docx elements (Paragraphs, Tables, etc.)
 */
function tokensToDocxElements(tokens, headings) {
  const elements = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const level = [
          HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
          HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6
        ][token.depth - 1] || HeadingLevel.HEADING_6;
        const headingText = decodeEntities(token.text || '');
        const bookmarkId = `_Toc_${headings ? headings.length : 0}`;
        const bookmark = new Bookmark({ id: bookmarkId, children: inlineTokensToTextRuns(token.tokens) });
        if (headings && token.depth <= 3) {
          headings.push({ text: headingText, depth: token.depth, bookmarkId });
        }
        elements.push(new Paragraph({
          children: [bookmark],
          heading: level
        }));
        break;
      }
      case 'paragraph':
        elements.push(new Paragraph({
          children: inlineTokensToTextRuns(token.tokens)
        }));
        break;
      case 'code':
        // Code block - each line as a monospace paragraph
        (token.text || '').split('\n').forEach(line => {
          elements.push(new Paragraph({
            children: [new TextRun({ text: line, font: 'Courier New', size: 20 })],
            shading: { type: ShadingType.SOLID, color: 'F5F5F5' },
            indent: { left: convertInchesToTwip(0.25) }
          }));
        });
        break;
      case 'table':
        elements.push(tableTokenToDocx(token));
        elements.push(new Paragraph({ children: [] })); // spacing after table
        break;
      case 'list':
        elements.push(...listTokenToDocx(token));
        break;
      case 'blockquote': {
        // Extract text from blockquote tokens and render as indented paragraphs
        const bqTokens = token.tokens || [];
        for (const bqToken of bqTokens) {
          if (bqToken.type === 'paragraph') {
            elements.push(new Paragraph({
              children: inlineTokensToTextRuns(bqToken.tokens),
              indent: { left: convertInchesToTwip(0.5) },
              border: { left: { style: BorderStyle.SINGLE, size: 3, color: '999999' } }
            }));
          } else {
            const subElements = tokensToDocxElements([bqToken]);
            elements.push(...subElements);
          }
        }
        break;
      }
      case 'hr':
        elements.push(new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } }
        }));
        break;
      case 'space':
        elements.push(new Paragraph({ children: [] }));
        break;
      default:
        if (token.raw?.trim()) {
          elements.push(new Paragraph({
            children: [new TextRun({ text: token.raw.trim() })]
          }));
        }
        break;
    }
  }

  return elements;
}

export class ExportService {
  constructor() {}

  /**
   * Export a single page to DOCX or PDF
   * @param {Object} options - Export options
   */
  async exportPage(options) {
    const { docPath, pageName, fileType, orientation, includeTOC, filename, location } = options;

    eventBus.emit(Events.EXPORT_STARTED, { type: 'page', pageName });

    try {
      const page = await documentsService.getPage(docPath, pageName);
      if (!page) throw new Error(`Page "${pageName}" not found`);

      const safeName = sanitizeFilename(filename || pageName);
      const filePath = `${location}/${safeName}.${fileType}`;

      if (fileType === 'docx') {
        await this.generateDocx({
          title: pageName,
          markdown: page.text || '',
          filePath,
          orientation,
          includeTOC
        });
      } else {
        await this.generatePdf({
          title: pageName,
          markdown: page.text || '',
          filePath,
          orientation,
          includeTOC
        });
      }

      eventBus.emit(Events.EXPORT_COMPLETED, { filePath });
      return { success: true, filePath };
    } catch (error) {
      eventBus.emit(Events.EXPORT_FAILED, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Export a document (single or individual mode)
   * @param {Object} options - Export options
   */
  async exportDocument(options) {
    const { docPath, fileType, orientation, includeTOC, filename, location,
            exportMode, exportSubDocs } = options;

    eventBus.emit(Events.EXPORT_STARTED, { type: 'document', docPath });

    try {
      if (exportSubDocs) {
        await this.exportSubDocuments(options);
      } else if (exportMode === 'individual') {
        await this.exportIndividual(options);
      } else {
        await this.exportSingleDocument(options);
      }

      eventBus.emit(Events.EXPORT_COMPLETED, { docPath });
      return { success: true };
    } catch (error) {
      eventBus.emit(Events.EXPORT_FAILED, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Export all pages of a document to a single file
   */
  async exportSingleDocument(options) {
    const { docPath, fileType, orientation, includeTOC, filename, location } = options;
    const pages = await documentsService.getPages(docPath);
    const docName = docPath.split('/').pop();

    // Combine pages: each page name becomes H1, content headers demoted
    let combinedMarkdown = '';
    for (const page of pages) {
      const pageData = await documentsService.getPage(docPath, page.name);
      combinedMarkdown += `# ${page.name}\n\n`;
      combinedMarkdown += demoteHeaders(pageData?.text || '') + '\n\n';
    }

    const safeName = sanitizeFilename(filename || docName);
    const filePath = `${location}/${safeName}.${fileType}`;

    if (fileType === 'docx') {
      await this.generateDocx({ title: docName, markdown: combinedMarkdown, filePath, orientation, includeTOC });
    } else {
      await this.generatePdf({ title: docName, markdown: combinedMarkdown, filePath, orientation, includeTOC });
    }
  }

  /**
   * Export each page as an individual file
   */
  async exportIndividual(options) {
    const { docPath, fileType, orientation, includeTOC, location } = options;
    const pages = await documentsService.getPages(docPath);

    for (const page of pages) {
      const pageData = await documentsService.getPage(docPath, page.name);
      const safeName = sanitizeFilename(page.name);
      const filePath = `${location}/${safeName}.${fileType}`;

      if (fileType === 'docx') {
        await this.generateDocx({ title: page.name, markdown: pageData?.text || '', filePath, orientation, includeTOC });
      } else {
        await this.generatePdf({ title: page.name, markdown: pageData?.text || '', filePath, orientation, includeTOC });
      }
    }
  }

  /**
   * Recursively export sub-documents
   */
  async exportSubDocuments(options) {
    const { docPath, fileType, orientation, includeTOC, location } = options;

    // First export the current document's pages as a single file
    const docName = docPath.split('/').pop();
    await this.exportSingleDocument({
      ...options,
      filename: sanitizeFilename(docName)
    });

    // Find sub-documents
    const allPaths = await documentsService.getAllDocumentPaths();
    const prefix = docPath + '/';
    const subDocs = allPaths.filter(p => p.startsWith(prefix) && p.split('/').length === docPath.split('/').length + 1);

    for (const subDocPath of subDocs) {
      const subName = subDocPath.split('/').pop();
      const parentName = docPath.split('/').pop();
      const exportName = sanitizeFilename(`${parentName} - ${subName}`);

      // Get sub-doc's pages and export as single document
      const pages = await documentsService.getPages(subDocPath);
      let combinedMarkdown = '';
      for (const page of pages) {
        const pageData = await documentsService.getPage(subDocPath, page.name);
        combinedMarkdown += `# ${page.name}\n\n`;
        combinedMarkdown += demoteHeaders(pageData?.text || '') + '\n\n';
      }

      const filePath = `${location}/${exportName}.${fileType}`;
      if (fileType === 'docx') {
        await this.generateDocx({ title: `${parentName} - ${subName}`, markdown: combinedMarkdown, filePath, orientation, includeTOC });
      } else {
        await this.generatePdf({ title: `${parentName} - ${subName}`, markdown: combinedMarkdown, filePath, orientation, includeTOC });
      }

      // Recursively handle sub-sub-documents
      const subSubDocs = allPaths.filter(p => p.startsWith(subDocPath + '/') && p.split('/').length === subDocPath.split('/').length + 1);
      if (subSubDocs.length > 0) {
        await this.exportSubDocuments({
          ...options,
          docPath: subDocPath
        });
      }
    }
  }

  /**
   * Generate a DOCX file from markdown
   * @param {Object} params - { title, markdown, filePath, orientation, includeTOC }
   */
  async generateDocx({ title, markdown, filePath, orientation, includeTOC }) {
    const tokens = parseMarkdown(markdown);
    const headings = includeTOC ? [] : null;
    const bodyElements = tokensToDocxElements(tokens, headings);

    // Build section children
    const children = [];

    // Title
    children.push(new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32 })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 300 }
    }));

    // Table of Contents - pre-populated with heading entries
    if (includeTOC && headings.length > 0) {
      // TOC title
      children.push(new Paragraph({
        children: [new TextRun({ text: 'Table of Contents', bold: true, size: 28 })],
        spacing: { after: 200 }
      }));

      // TOC entries with internal hyperlinks to bookmarked headings
      for (const h of headings) {
        const indent = (h.depth - 1) * 360;
        children.push(new Paragraph({
          children: [
            new InternalHyperlink({
              anchor: h.bookmarkId,
              children: [
                new TextRun({ text: h.text, color: '0563C1', underline: {} }),
              ]
            }),
            new TextRun({ children: ['\t'] }),
            new PageReference(h.bookmarkId)
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: LeaderType.DOT }],
          indent: { left: indent },
          spacing: { after: 40 }
        }));
      }

      children.push(new Paragraph({ children: [] }));
    }

    // Body content
    children.push(...bodyElements);

    const doc = new Document({
      styles: {
        default: {
          heading1: { paragraph: { outlineLevel: 0 } },
          heading2: { paragraph: { outlineLevel: 1 } },
          heading3: { paragraph: { outlineLevel: 2 } },
          heading4: { paragraph: { outlineLevel: 3 } },
          heading5: { paragraph: { outlineLevel: 4 } },
          heading6: { paragraph: { outlineLevel: 5 } }
        }
      },
      sections: [{
        properties: {
          page: {
            size: {
              orientation: orientation === 'landscape' ? 'landscape' : 'portrait'
            }
          }
        },
        headers: {
          default: new Header({ children: [] })
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              children: [
                new TextRun({ children: [PageNumber.CURRENT] }),
                new TextRun({ text: ' / ' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES] })
              ],
              alignment: AlignmentType.CENTER
            })]
          })
        },
        children
      }]
    });

    const blob = await Packer.toBlob(doc);
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const writeResult = await window.api.export.writeFile(filePath, Array.from(uint8));
    if (!writeResult.success) {
      throw new Error(writeResult.error || 'Failed to write DOCX file');
    }

  }

  /**
   * Generate a PDF file from markdown
   * @param {Object} params - { title, markdown, filePath, orientation, includeTOC }
   */
  async generatePdf({ title, markdown, filePath, orientation, includeTOC }) {
    const html = this.buildPdfHtml(title, markdown, includeTOC, orientation);

    const pdfResult = await window.api.export.toPDF({
      html,
      filePath,
      landscape: orientation === 'landscape'
    });

    if (!pdfResult.success) {
      throw new Error(pdfResult.error || 'PDF generation failed');
    }
  }

  /**
   * Build full HTML page for PDF rendering
   * @param {string} title - Document title
   * @param {string} markdown - Markdown content
   * @param {boolean} includeTOC - Whether to include TOC
   * @returns {string} Complete HTML document
   */
  buildPdfHtml(title, markdown, includeTOC, orientation) {
    // Parse markdown to get headings for TOC
    const tokens = parseMarkdown(markdown);
    let tocHtml = '';

    if (includeTOC) {
      const headings = tokens.filter(t => t.type === 'heading' && t.depth <= 3);
      if (headings.length > 0) {
        tocHtml = '<div class="toc"><h2>Table of Contents</h2>';
        for (const h of headings) {
          const indent = (h.depth - 1) * 20;
          const id = h.text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          tocHtml += `<div class="toc-entry" style="padding-left:${indent}px">` +
            `<a href="#${id}">${h.text}</a>` +
            `<span class="toc-dots"></span>` +
            `<span class="toc-page"></span></div>`;
        }
        tocHtml += '</div><hr>';
      }
    }

    // Render markdown to HTML, adding IDs to headings for TOC links
    const renderer = new marked.Renderer();
    renderer.heading = function(text, level) {
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return `<h${level} id="${id}">${text}</h${level}>`;
    };

    const contentHtml = marked.parse(preprocessMarkdown(markdown), { renderer, breaks: true, gfm: true });

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: #333;
    max-width: 100%;
    padding: 20px 40px;
  }
  h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 5px; }
  h2 { font-size: 20px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  h3 { font-size: 16px; }
  h4 { font-size: 14px; }
  .doc-title { font-size: 28px; font-weight: bold; margin-bottom: 20px; border-bottom: 3px solid #333; padding-bottom: 8px; }
  .toc { margin-bottom: 20px; }
  .toc h2 { font-size: 18px; }
  .toc-entry { margin: 4px 0; display: flex; align-items: baseline; }
  .toc-entry a { color: #0563C1; text-decoration: none; flex-shrink: 0; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #999; margin: 0 4px; min-width: 20px; position: relative; top: -3px; }
  .toc-page { flex-shrink: 0; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  th { background-color: #D9E2F3; font-weight: bold; }
  code { background: #f5f5f5; padding: 2px 4px; font-family: 'Courier New', monospace; font-size: 11px; }
  pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #999; margin-left: 0; padding-left: 15px; color: #666; }
  hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
  img { max-width: 100%; }
</style>
</head>
<body>
<div class="doc-title">${title}</div>
${tocHtml}
${contentHtml}
<script>
(function() {
  // Calculate page numbers for TOC entries based on heading positions.
  // Letter paper: 11in, margins 0.6in top/bottom, footer ~0.3in = ~9.5in usable ≈ 912px at 96dpi
  var pageHeight = ${orientation === 'landscape' ? '(8.5 - 1.5) * 96' : '(11 - 1.5) * 96'};
  const tocPages = document.querySelectorAll('.toc-page');
  const headings = document.querySelectorAll('h1[id], h2[id], h3[id]');
  headings.forEach(function(heading, i) {
    if (i < tocPages.length) {
      const page = Math.floor(heading.offsetTop / pageHeight) + 1;
      tocPages[i].textContent = page;
    }
  });
})();
</script>
</body>
</html>`;
  }

  /**
   * Main export dispatcher - called from ExportDialog
   * @param {Object} options - Full export options from dialog
   */
  async export(options) {
    if (options.type === 'page') {
      return this.exportPage(options);
    } else {
      return this.exportDocument(options);
    }
  }
}

export const exportService = new ExportService();
