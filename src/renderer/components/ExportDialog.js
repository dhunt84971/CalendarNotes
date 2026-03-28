/**
 * ExportDialog - Modal dialog for exporting documents and pages
 */

import { eventBus, Events } from '../core/EventBus.js';
import { settingsService } from '../services/SettingsService.js';

export class ExportDialog {
  constructor() {
    this.overlay = null;
    this.isOpen = false;
    this.exportContext = null; // { type, docPath, pageName, hasSubDocs }
    this.onExport = null; // callback set by App
    this.createDOM();
    this.bindEvents();
  }

  createDOM() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'export-overlay hidden';
    this.overlay.innerHTML = `
      <div class="export-dialog">
        <div class="settings-header">
          <h2>Export</h2>
          <button class="btn-close export-close">&times;</button>
        </div>
        <div class="settings-content">
          <div class="settings-group">
            <label>File Type</label>
            <div class="export-radio-group">
              <label class="radio-label">
                <input type="radio" name="export-file-type" value="pdf" checked> PDF
              </label>
              <label class="radio-label">
                <input type="radio" name="export-file-type" value="docx"> DOCX
              </label>
            </div>
          </div>

          <div class="settings-group">
            <label>Page Orientation</label>
            <div class="export-radio-group">
              <label class="radio-label">
                <input type="radio" name="export-orientation" value="portrait" checked> Portrait
              </label>
              <label class="radio-label">
                <input type="radio" name="export-orientation" value="landscape"> Landscape
              </label>
            </div>
          </div>

          <div class="settings-group">
            <label class="checkbox-label">
              <input type="checkbox" id="export-toc"> Include Table of Contents
            </label>
          </div>

          <div class="settings-group export-doc-options hidden">
            <label>Export Mode</label>
            <div class="export-radio-group">
              <label class="radio-label">
                <input type="radio" name="export-mode" value="single" checked> Single Document
              </label>
              <label class="radio-label">
                <input type="radio" name="export-mode" value="individual"> Individual Documents
              </label>
            </div>
          </div>

          <div class="settings-group export-subdocs-option hidden">
            <label class="checkbox-label">
              <input type="checkbox" id="export-subdocs"> Export All Sub Documents
            </label>
          </div>

          <div class="settings-group export-filename-group">
            <label>File Name</label>
            <input type="text" id="export-filename" class="input export-input">
            <div class="export-validation hidden" id="export-filename-error">File name is required</div>
          </div>

          <div class="settings-group">
            <label>Location</label>
            <div class="input-group">
              <input type="text" id="export-location" class="input export-input" readonly>
              <button class="btn export-browse-btn">Browse</button>
            </div>
            <div class="export-validation hidden" id="export-location-error">Please select a valid location</div>
          </div>
        </div>
        <div class="settings-footer">
          <div class="export-footer-left">
            <button class="btn export-cancel-btn">Cancel</button>
          </div>
          <button class="btn btn-primary export-btn" disabled>Export</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    // Cache elements
    this.closeBtn = this.overlay.querySelector('.export-close');
    this.cancelBtn = this.overlay.querySelector('.export-cancel-btn');
    this.exportBtn = this.overlay.querySelector('.export-btn');
    this.browseBtn = this.overlay.querySelector('.export-browse-btn');
    this.filenameInput = this.overlay.querySelector('#export-filename');
    this.locationInput = this.overlay.querySelector('#export-location');
    this.tocCheckbox = this.overlay.querySelector('#export-toc');
    this.subdocsCheckbox = this.overlay.querySelector('#export-subdocs');
    this.docOptionsGroup = this.overlay.querySelector('.export-doc-options');
    this.subdocsGroup = this.overlay.querySelector('.export-subdocs-option');
    this.filenameGroup = this.overlay.querySelector('.export-filename-group');
    this.filenameError = this.overlay.querySelector('#export-filename-error');
    this.locationError = this.overlay.querySelector('#export-location-error');
  }

  bindEvents() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.cancelBtn.addEventListener('click', () => this.close());
    this.exportBtn.addEventListener('click', () => this.doExport());
    this.browseBtn.addEventListener('click', () => this.browseLocation());

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Close on Escape
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    // File type changes
    this.overlay.querySelectorAll('input[name="export-file-type"]').forEach(radio => {
      radio.addEventListener('change', () => this.updateFileExtension());
    });

    // Export mode changes
    this.overlay.querySelectorAll('input[name="export-mode"]').forEach(radio => {
      radio.addEventListener('change', () => this.updateOptionVisibility());
    });

    // Sub-docs checkbox
    this.subdocsCheckbox.addEventListener('change', () => this.updateOptionVisibility());

    // Filename validation
    this.filenameInput.addEventListener('input', () => this.validate());

    // Listen for export requests
    eventBus.on(Events.EXPORT_REQUESTED, (data) => this.open(data));
  }

  async open(context) {
    this.exportContext = context;
    this.isOpen = true;

    // Load saved export settings
    const exportSettings = settingsService.getExportSettings();

    // Set file type
    const fileTypeRadio = this.overlay.querySelector(`input[name="export-file-type"][value="${exportSettings.fileType || 'pdf'}"]`);
    if (fileTypeRadio) fileTypeRadio.checked = true;

    // Set orientation
    const orientRadio = this.overlay.querySelector(`input[name="export-orientation"][value="${exportSettings.pageOrientation || 'portrait'}"]`);
    if (orientRadio) orientRadio.checked = true;

    // Set TOC
    this.tocCheckbox.checked = exportSettings.includeTableOfContents || false;

    // Set export mode to single by default
    const singleRadio = this.overlay.querySelector('input[name="export-mode"][value="single"]');
    if (singleRadio) singleRadio.checked = true;
    this.subdocsCheckbox.checked = false;

    // Set default filename
    const defaultName = context.type === 'page' ? context.pageName : context.docPath.split('/').pop();
    this.filenameInput.value = defaultName || 'Untitled';

    // Set location
    let location = exportSettings.lastLocation;
    if (location) {
      const dirCheck = await window.api.export.directoryExists(location);
      if (!dirCheck.exists || !dirCheck.writable) {
        location = '';
      }
    }
    if (!location) {
      location = await window.api.app.getPath('documents');
    }
    this.locationInput.value = location;

    // Show/hide document-specific options
    if (context.type === 'document') {
      this.docOptionsGroup.classList.remove('hidden');
      if (context.hasSubDocs) {
        this.subdocsGroup.classList.remove('hidden');
      } else {
        this.subdocsGroup.classList.add('hidden');
      }
    } else {
      this.docOptionsGroup.classList.add('hidden');
      this.subdocsGroup.classList.add('hidden');
    }

    this.updateOptionVisibility();
    this.validate();
    this.overlay.classList.remove('hidden');
    this.filenameInput.focus();
  }

  close() {
    this.isOpen = false;
    this.overlay.classList.add('hidden');
    this.exportContext = null;
  }

  getSelectedFileType() {
    return this.overlay.querySelector('input[name="export-file-type"]:checked')?.value || 'pdf';
  }

  getSelectedOrientation() {
    return this.overlay.querySelector('input[name="export-orientation"]:checked')?.value || 'portrait';
  }

  getSelectedExportMode() {
    return this.overlay.querySelector('input[name="export-mode"]:checked')?.value || 'single';
  }

  updateFileExtension() {
    // Update extension in filename if it has one
    const filename = this.filenameInput.value;
    const ext = this.getSelectedFileType();
    const otherExt = ext === 'pdf' ? 'docx' : 'pdf';
    if (filename.endsWith(`.${otherExt}`)) {
      this.filenameInput.value = filename.replace(`.${otherExt}`, `.${ext}`);
    }
  }

  updateOptionVisibility() {
    const isDocument = this.exportContext?.type === 'document';
    const mode = this.getSelectedExportMode();
    const subdocsChecked = this.subdocsCheckbox.checked;

    // Show subdocs option only for single mode with sub-documents
    if (isDocument && this.exportContext?.hasSubDocs && mode === 'single') {
      this.subdocsGroup.classList.remove('hidden');
    } else {
      this.subdocsGroup.classList.add('hidden');
      this.subdocsCheckbox.checked = false;
    }

    // Disable filename for individual mode or subdocs export
    const disableFilename = isDocument && (mode === 'individual' || subdocsChecked);
    this.filenameInput.disabled = disableFilename;
    if (disableFilename) {
      this.filenameInput.value = '(auto-generated)';
    } else if (this.filenameInput.value === '(auto-generated)') {
      // Restore default name
      const defaultName = this.exportContext?.type === 'page'
        ? this.exportContext.pageName
        : this.exportContext?.docPath.split('/').pop();
      this.filenameInput.value = defaultName || 'Untitled';
    }

    this.validate();
  }

  validate() {
    let valid = true;

    // Filename validation (only when editable)
    if (!this.filenameInput.disabled) {
      const filename = this.filenameInput.value.trim();
      if (!filename) {
        this.filenameError.classList.remove('hidden');
        valid = false;
      } else {
        this.filenameError.classList.add('hidden');
      }
    } else {
      this.filenameError.classList.add('hidden');
    }

    // Location validation
    const location = this.locationInput.value.trim();
    if (!location) {
      this.locationError.classList.remove('hidden');
      valid = false;
    } else {
      this.locationError.classList.add('hidden');
    }

    this.exportBtn.disabled = !valid;
    return valid;
  }

  async browseLocation() {
    const result = await window.api.export.selectDirectory({
      title: 'Select Export Location',
      defaultPath: this.locationInput.value
    });

    if (!result.canceled && result.filePaths?.length > 0) {
      this.locationInput.value = result.filePaths[0];
      this.validate();
    }
  }

  async doExport() {
    if (!this.validate()) return;

    const fileType = this.getSelectedFileType();
    const orientation = this.getSelectedOrientation();
    const includeTOC = this.tocCheckbox.checked;
    const location = this.locationInput.value.trim();

    // Save settings for next time
    await settingsService.updateExportSettings({
      lastLocation: location,
      fileType,
      includeTableOfContents: includeTOC,
      pageOrientation: orientation
    });

    const exportOptions = {
      type: this.exportContext.type,
      docPath: this.exportContext.docPath,
      pageName: this.exportContext.pageName,
      hasSubDocs: this.exportContext.hasSubDocs,
      fileType,
      orientation,
      includeTOC,
      filename: this.filenameInput.disabled ? null : this.filenameInput.value.trim(),
      location,
      exportMode: this.exportContext.type === 'document' ? this.getSelectedExportMode() : 'single',
      exportSubDocs: this.subdocsCheckbox.checked
    };

    // Show progress state
    this.exportBtn.textContent = 'Exporting...';
    this.exportBtn.disabled = true;
    this.cancelBtn.disabled = true;

    try {
      if (this.onExport) {
        await this.onExport(exportOptions);
      }
    } finally {
      this.exportBtn.textContent = 'Export';
      this.cancelBtn.disabled = false;
      this.close();
    }
  }

  destroy() {
    if (this.overlay) {
      this.overlay.remove();
    }
  }
}

export const exportDialog = new ExportDialog();
