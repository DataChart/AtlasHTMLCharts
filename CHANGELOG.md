# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- Charts no longer animate when the viewer's system asks for reduced motion (`prefers-reduced-motion: reduce`).
- A copy of `templates/dashboard.html` in `dashboards/` now works unchanged: it loads the starter data from
  `../templates/starter-data.js` and its nav link points at the page itself.
- Date-time values such as `2024-01-05 13:45` parse in Safari (they were read as blank), and times without a zone
  are read as local time in every browser.
- `min` / `max` aggregations, table data bars and bubble sizes no longer throw in Safari on more than 65,536 values.
- The system light/dark switch also re-colours charts in Safari 13.
- Escape closes an open Download menu or multi-select dropdown and returns focus to its button.
- The Download menu and multi-select dropdowns work from the keyboard alone: ArrowDown opens them, arrow keys,
  Home and End move between items, Tab out closes them, and the dropdown button announces its slicer name.

### Changed
- Slicers are applied once per refresh and shared by every visual, instead of once per visual.
- Stacked and clustered charts with a `series` field group each category once instead of filtering per cell.
- Browser tests run in Chromium, Firefox and WebKit in CI.

### Added
- Package metadata (`repository`, `bugs`, `homepage`, `engines`), `.editorconfig`, Dependabot for npm and Actions.

## [0.1.0] - 2026-10-14

### Added
- Page template, 30+ visual types, slicers, cross-filtering, drill-down and drill-through, JSON Schema and
  validator, Playwright tests, `AGENTS.md` and the prompt library.
