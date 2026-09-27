# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-09-23

### Fixed
- Allow saving a note with empty body when the Done role is selected, matching my_home_page's note form (#890)

### Changed
- Extend the Notes panel's cutoff from 2h to 5h so recently created notes stay visible longer, matching my_home_page (#887)

## [1.4.2] - 2026-09-20

### Fixed
- app.js's NOTE_REPO (GitHub Issues backend) now points at KaitoKurokochi/vault instead of the retired KaitoKurokochi/agent — same repo the data reads already use.

## [1.4.1] - 2026-09-20

### Fixed
- report.js's HQ entry now reads HQ/note.md (renamed from agent_meta), DEFAULT_LABELS swaps 'Agent' for 'HQ', and the now-dead agent_meta label override in app.js is removed.

## [1.4.0] - 2026-09-20

### Changed
- sync.js, report.js, location.js now read data files (sync.json, due_today.json,
  selected_domains.json, note.md/status files, location_zones.json) from
  KaitoKurokochi/vault instead of agent. GitHub Issues (note CRUD) stay on agent.

## [1.3.1] - 2026-09-13

### Fixed
- Include closed issues when loading notes (state=all instead of state=open) (#817)
- Allow saving a note with empty body when the Done role is selected (#816)

### Added
- Manual refresh button on the Notes panel

## [1.3.0] - 2026-09-07

### Fixed
- Auto-select label from report tab mentions via domainKey

### Added
- Preload notes and report on app open for instant tab switching

## [1.2.5] - 2026-08-02

### Fixed
- Rewrite swipe/tab navigation using per-panel translateX classes; fixes Report and Notes panels not visible on mobile Safari

## [1.2.4] - 2026-08-02

### Fixed
- Use 100vw for panel width and translateX to fix layout on mobile Safari

## [1.2.3] - 2026-08-02

### Fixed
- Fix swipe listener on document instead of .panels so swipe works from scrollable tabs

## [1.2.2] - 2026-08-02

### Fixed
- Fix location_zones.json path (missing runtime/ prefix)

## [1.2.1] - 2026-08-02

### Fixed
- Simplify swipe detection by removing direction lock; swipe now works from all tabs

## [1.2.0] - 2026-08-01

### Added
- Swipe gesture to switch between Form / Notes / Report tabs

## [1.1.0] - 2026-07-22

### Added
- Collapsible domain cards in mobile status report

### Fixed
- Correct `selected_domains.json` path and safe fallback for missing file
- Collapse all cards by default; correct `due_today.json` path

## [1.0.3] - 2026-07-18

### Fixed
- Correct mention index offset across multiple domains in report tab

## [1.0.2] - 2026-07-18

### Fixed
- Add mention button to note items

## [1.0.1] - 2026-07-18

### Fixed
- Remove text content from issue title to match my-home-page format

## [1.0.0] - 2026-06-14

### Added
- Initial mobile note app with tab navigation (Notes / Form / Report)
- Tab bar moved to top with text labels and active color indicator; Save button
- PWA support: icons and `mobile-web-app-capable` meta tag
- Label creation in Form tab with sync to `my_notes/sync.json`
- Label rename and delete management modal in Form tab
- Phase section and subcat support in status report
- Checkbox items (`- [ ]` / `- [x]`) parsing in report
- Role picker button for note items without a role
- Location-aware label selection, due-today display, and status report integration (agent repo migration)

### Fixed
- Auto-label selection now correctly maps Phase items to parent label
- Section tracking for skipped headings in `markdownToHtml`
- Role selection changed to radio-button behavior
- Report 403 error message and DEFAULT_LABELS update

[Unreleased]: https://github.com/KaitoKurokochi/mobile-note/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/KaitoKurokochi/mobile-note/compare/v1.4.2...v1.5.0
[1.1.0]: https://github.com/KaitoKurokochi/mobile-note/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/KaitoKurokochi/mobile-note/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/KaitoKurokochi/mobile-note/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/KaitoKurokochi/mobile-note/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/KaitoKurokochi/mobile-note/releases/tag/v1.0.0
