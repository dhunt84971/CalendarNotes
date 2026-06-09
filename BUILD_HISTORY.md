# Build History

## v2.3.4 - 2026-06-09
- Fixed bug where saving a document page overwrote the current day's note in the database with the page content.
- Fixed loss of the selected document/page when leaving the Documents panel with unsaved edits and returning.
- Fixed the document tree not expanding to reveal a subdocument when navigating to it from a search result.

## v2.3.3 - 2026-04-05
- Search terms are now highlighted in the current note/document content after a search is performed, even when not hovering over a specific search result.
- Highlighting persists when navigating to a result and clears when switching away from the search panel or clearing the search.

## v2.3.2 - 2026-04-05
- Fixed bug where editing a document page and switching to Tasks would overwrite daily notes with document content.
- Document page changes are now saved when switching away from the Documents panel.

## v2.3.1 - 2026-03-27
- Fixed search preview line breaks.

## v2.3.0 - 2026-03-20
- Added export feature for documents and pages (DOCX and PDF formats).
- Export options include Table of Contents, orientation, and sub-document inclusion.

## v2.2.0 - 2026-03-01
- Fixed Linux icon and search field resizing.
- Fixed overwrite issue.

## v2.1.0 - 2026-02-15
- Added theme files and theme support.
- Added window size and location persistence.
- Fixed Linux install path.

## v2.0.0 - 2026-02-13
- Major refactor and cleanup of codebase.
- Fixed themes issue #86.
- Added Ctrl+S keyboard shortcut to save.
- Fixed error when no settings file exists.
- Fixed saving changes on same date selection.
- Fixed day highlight for month selection (issue #85).
- Fixed highlight day unhandled error.
- Added highlighted days on calendar for dates with notes.
- Updated packages and dependencies.

## v1.1.23 - 2025-03-23
- Updated electron-builder, removed gconf2 dependency.
- Fixed page selection.
- Minor theme color fixes.
- Fixed indents.

## v1.1.22 - 2025-03-23
- Added BurntBlue theme.
- Completed color-separation for themes.

## v1.1.21 - 2024-05-31
- Fixed delimiter and compiled successfully.
- Changed Doc delimiter to "->".
- Upgraded sqlite to 5.1.6.

## v1.1.20 - 2024-05-29
- Added dependencies to Readme.

## v1.1.19 - 2024-05-18
- Fixed awkward wording in documentation.
- Updated save on close description.

## v1.1.18 - 2024-04-26
- Updated version and dependencies.

## v1.1.17 - 2023-09-04
- Added gradient theme.
- Completed theme conversion to CSS variables.

## v1.1.16 - 2023-05-19
- Settings text color style respects theme.

## v1.1.15 - 2022-02-26
- Completed persist window size and position.
- Added closing save prompt for unsaved changes.

## v1.1.14 - 2021-09-06
- Added copy/paste and fixed tabbing.
- Fixed tab indenting of selection.

## v1.1.13 - 2021-08-29
- Removed erroneous extra body from HTML.

## v1.1.12 - 2021-08-28
- Completed synced search code modifications.

## v1.1.11 - 2021-08-27
- Completed side-by-side editing feature.
- Fixed unselectable errors.
- Fixed markdown areas selectable (issue #48).

## v1.1.10 - 2021-07-30
- Fixed all scrollbars.
- Improved scrollbar styling.

## v1.1.9 - 2021-07-18
- Fixed unnecessary saving of notes to DB.
- Fixed broken collapse and markdown view border.
- Blocked searching of documents if feature is not enabled.

## v1.1.8 - 2021-07-09
- Minor fixes.

## v1.1.7 - 2021-06-27
- Added document search with click navigation to results.
- Fixed expandToSelected method.

## v1.1.6 - 2021-02-14
- Added checkboxes for all themes (issue #8).
- Added version number display (issue #15).

## v1.1.5 - 2021-01-20
- Updated npm packages.
- Renamed functions.

## v1.1.4 - 2020-12-24
- Fixed tabbing in documents (issue #32).

## v1.1.3 - 2020-12-21
- Fixed date parsing error.
- Fixed date offset bug for SQLite.
- Added automatic saving of page edits prior to moving pages.

## v1.1.2 - 2020-12-19
- Added spell checking option.
- Added drag to Add Doc button to move document to root.
- Completed drag and drop features for documents and pages.
- Added Move Up/Down for documents and pages.
- Added expand and collapse buttons.

## v1.1.0 - 2020-11-29
- Added documents feature with page support.
- Added SQLite and MySQL support for documents.
- Made settings scrollable.
- Added settable SQLite DB file path.

## v1.0.2 - 2020-11-04
- Added await call support for saving tasks and notes.

## v1.0.1 - 2020-07-03
- Initial bug fixes.

## v1.0.0 - 2020-07-03
- Initial release.
