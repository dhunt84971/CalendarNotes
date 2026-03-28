# Export Feature PRD

## Overview

Add an Export feature to CalendarNotes that allows users to export Documents and Pages to DOCX or PDF files. The feature is accessed via the existing context menu on Documents and Pages in the DocumentsPanel tree view.

## Tech Stack Context

- **Framework:** Electron 28 with vanilla JavaScript (ES modules)
- **Build Tool:** Electron Vite 2.0
- **Markdown:** `marked` v11.1.1
- **Database:** SQLite via `better-sqlite3`
- **Settings:** JSON file at `app.getPath('userData')/settings.json`
- **Architecture:** Main process (IPC handlers) / Preload bridge / Renderer (components, services, models)

## Feature Requirements

### 1. Context Menu Integration

Add an "Export..." menu item to the existing context menus for both Documents and Pages in the `DocumentsPanel` component. The menu item triggers the export modal dialog.

**Affected files:**
- `src/renderer/components/DocumentsPanel.js` - Add "Export..." context menu item

### 2. Export Modal Dialog

When "Export..." is selected, display a modal dialog with the following options:

#### 2.1 Common Options (All Export Scenarios)

| Option | Type | Values | Default |
|--------|------|--------|---------|
| File Type | Radio/Select | DOCX, PDF | Last used (from settings), or PDF |
| Page Orientation | Radio/Select | Portrait, Landscape | Last used (from settings), or Portrait |
| Include Table of Contents | Checkbox | On/Off | Last used (from settings), or Off |
| File Name | Text Input | User-specified | Name of the page or document being exported |
| File Location | Directory Picker | User-specified | Last used location (from settings), or user's Documents folder |

#### 2.2 Document-Specific Options

| Option | Type | Values | Default |
|--------|------|--------|---------|
| Export Mode | Radio/Select | Single Document, Individual Documents | Single Document |
| Export All Sub Documents | Checkbox | On/Off (visible only when document contains sub-documents AND export mode is Single Document) | Off |

#### 2.3 Option Interactions

- **Individual Documents mode:** File name input is disabled. Files are named based on page names. User can only specify the export location.
- **Export All Sub Documents:** When enabled, file name input is disabled. User can only specify the export location. Each sub-document is exported as a separate file named `<parent name> - <sub name>`.

### 3. Export Behavior

#### 3.1 Single Page Export

- Export the page content as a DOCX or PDF file.
- Respect all markdown formatting in the source content.
- Include a Title at the top of the exported file using the page name.
- Include footer page numbering.
- Render tabular data in proper tables:
  - Column alignment based on markdown alignment syntax (`:---`, `:---:`, `---:`).
  - Column widths adjusted to minimize row count (auto-fit content).
- If Table of Contents is enabled, generate a TOC using up to 3 heading levels.

#### 3.2 Document Export - Single Document Mode

- Export all pages within the document to a single DOCX or PDF file.
- Default filename is the document name.
- Each page name becomes a Header 1 (`#`) in the exported file.
- All markdown headers within page content are demoted by one level (e.g., `#` becomes `##`, `##` becomes `###`, etc.).
- All other single-page export rules apply (markdown rendering, tables, page numbering, optional TOC).

#### 3.3 Document Export - Individual Documents Mode

- Export each page within the document as a separate DOCX or PDF file.
- User can only specify the export location (not individual filenames).
- Each file is named based on its page name.
- Page names are sanitized to create valid filenames for the current platform:
  - Remove/replace characters invalid for the OS (`\`, `/`, `:`, `*`, `?`, `"`, `<`, `>`, `|` on Windows; `/` on Linux/macOS).
  - Trim leading/trailing whitespace and dots.
  - Truncate to a reasonable maximum length (255 characters).
- Each individual export follows Single Page Export rules (Section 3.1).

#### 3.4 Document Export - Export All Sub Documents

- Available only when:
  1. The selected document contains sub-documents.
  2. Export mode is set to Single Document.
- When enabled, recursively exports each sub-document and its pages as a separate single-document file.
- File naming format: `<parent document name> - <sub-document name>`.
- User can only specify the export location.
- Each sub-document file follows the Single Document Mode rules (Section 3.2).

### 4. Settings Persistence

Export settings are saved in the application's `settings.json` file and restored the next time the export dialog is opened.

#### 4.1 Persisted Settings

Add the following to the Settings model and SettingsService:

```json
{
  "exportSettings": {
    "lastLocation": "",
    "fileType": "pdf",
    "includeTableOfContents": false,
    "pageOrientation": "portrait"
  }
}
```

| Setting | Type | Description |
|---------|------|-------------|
| `lastLocation` | string | Last used export directory path |
| `fileType` | string | `"docx"` or `"pdf"` |
| `includeTableOfContents` | boolean | Whether TOC was included in last export |
| `pageOrientation` | string | `"portrait"` or `"landscape"` |

#### 4.2 Default Location Logic

1. If `lastLocation` exists in settings and the directory is valid/accessible, use it.
2. Otherwise, fall back to the user's Documents folder (`app.getPath('documents')`).

### 5. File Generation

#### 5.1 DOCX Generation

- Use a library such as `docx` (npm: `docx`) to generate Word documents programmatically.
- Map markdown elements to DOCX equivalents:
  - Headers (H1-H6) to corresponding DOCX heading styles
  - Bold, italic, strikethrough, inline code to character formatting
  - Ordered/unordered lists to DOCX list elements
  - Code blocks to monospace-formatted paragraphs
  - Tables to DOCX tables with proper alignment and auto-fit column widths
  - Links to DOCX hyperlinks
  - Horizontal rules to DOCX separators
- Include page numbering in the footer.
- Apply page orientation (portrait/landscape) to the document section.
- Generate Table of Contents if enabled (up to 3 levels).

#### 5.2 PDF Generation

- Use a library such as `pdfkit`, `puppeteer`, or `pdf-lib` for PDF generation. An HTML-to-PDF approach using Electron's built-in `webContents.printToPDF()` or a library like `puppeteer` may provide the most faithful markdown rendering.
- Apply the same markdown-to-document mapping as DOCX.
- Include page numbering in the footer.
- Apply page orientation (portrait/landscape).
- Generate Table of Contents if enabled (up to 3 levels).

### 6. Architecture & Implementation

#### 6.1 New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/ExportDialog.js` | Modal dialog component for export options UI |
| `src/renderer/services/ExportService.js` | Export orchestration, markdown-to-document conversion, file generation |

#### 6.2 Modified Files

| File | Change |
|------|--------|
| `src/renderer/components/DocumentsPanel.js` | Add "Export..." context menu item for documents and pages |
| `src/renderer/models/Settings.js` | Add `exportSettings` property with defaults |
| `src/renderer/services/SettingsService.js` | Add getters/setters for export settings |
| `src/preload/preload.js` | Add IPC bridge for file save dialog and export directory validation |
| `src/main/IPCHandler.js` | Add IPC handlers for file save dialog, directory picker, and directory validation |
| `src/renderer/styles/main.css` | Add styles for the export modal dialog |
| `package.json` | Add dependencies for DOCX/PDF generation |

#### 6.3 IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `dialog:saveFile` | Renderer -> Main | Open native save file dialog with filters |
| `dialog:selectDirectory` | Renderer -> Main | Open native directory picker dialog |
| `fs:directoryExists` | Renderer -> Main | Validate that a directory path exists and is accessible |

#### 6.4 EventBus Events

| Event | Purpose |
|-------|---------|
| `EXPORT_STARTED` | Emitted when export begins (for potential progress indication) |
| `EXPORT_COMPLETED` | Emitted when export finishes successfully |
| `EXPORT_FAILED` | Emitted when export encounters an error |

### 7. UI/UX Details

#### 7.1 Modal Dialog Layout

The export dialog should follow the existing modal pattern used by `SettingsPanel` for visual consistency. Suggested layout:

```
+------------------------------------------+
|  Export                              [X]  |
+------------------------------------------+
|                                          |
|  File Type:    (*) PDF  ( ) DOCX         |
|                                          |
|  Orientation:  (*) Portrait              |
|                ( ) Landscape             |
|                                          |
|  [x] Include Table of Contents           |
|                                          |
|  --- Document Options (if applicable) ---|
|                                          |
|  Export Mode:  (*) Single Document       |
|               ( ) Individual Documents   |
|                                          |
|  [ ] Export All Sub Documents            |
|      (visible when sub-docs exist        |
|       and Single Document selected)      |
|                                          |
|  File Name:   [document-name        ]   |
|  Location:    [/home/user/Documents  ] [Browse] |
|                                          |
|  [Cancel]                     [Export]   |
+------------------------------------------+
```

#### 7.2 Validation

- File name must not be empty (when editable).
- Location must be a valid, writable directory.
- Show inline validation messages for invalid inputs.
- Disable the Export button until all required fields are valid.

#### 7.3 Progress & Feedback

- Show a brief progress indicator or spinner during export.
- On success, display a notification or brief confirmation message.
- On failure, display an error message describing what went wrong.

### 8. Filename Sanitization

Implement a utility function to sanitize page/document names for use as filenames:

```javascript
function sanitizeFilename(name) {
  // Remove characters invalid on Windows (superset of Linux/macOS restrictions)
  let sanitized = name.replace(/[\\/:*?"<>|]/g, '_');
  // Trim whitespace and dots
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  // Truncate to 255 characters (filesystem limit)
  sanitized = sanitized.substring(0, 255);
  // Fallback for empty result
  return sanitized || 'Untitled';
}
```

### 9. Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `docx` | DOCX file generation | Mature, well-maintained library for creating Word documents |
| PDF solution (TBD) | PDF file generation | Options: Electron's `printToPDF`, `pdfmake`, `puppeteer`, or `html-pdf` |

### 10. Out of Scope

- Export of calendar notes (only Documents and Pages).
- Export to formats other than DOCX and PDF.
- Batch export from a menu bar (only context menu access).
- Cloud storage integration for export location.
- Export preview within the modal.
