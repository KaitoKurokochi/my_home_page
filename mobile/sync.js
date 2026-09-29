// ── Labels/roles storage (mobile) ────────────────────────────────────────────
// pullSync()/pushSync() themselves now live in ../shared/sync-api.js.
// Labels now come from ../shared/departments-api.js's fetchDepartmentLabels()
// cache instead of a locally-maintained DEFAULT_LABELS (which had drifted
// badly from the real department list — stray "Others"/"my_home_page"
// entries, inconsistent casing — see status.md/history.md 2026-09-29).
// Roles are unaffected and keep their own local defaults.

const ROLES_KEY     = 'note_roles';

const DEFAULT_ROLES  = [
  { key: 'Memo',       icon: '📝' },
  { key: 'Todo',       icon: '🔲' },
  { key: 'Idea',       icon: '💡' },
  { key: 'Journal',    icon: '📓' },
  { key: 'Question',   icon: '❓' },
  { key: 'Done',       icon: '✅' },
];

// getLabels() reads fetchDepartmentLabels()'s cache (populated by initApp()
// before any render — see app.js) instead of localStorage.
function getLabels() { return _departmentLabelsCache || DEPARTMENTS_FALLBACK; }
function getRoles()  { return JSON.parse(localStorage.getItem(ROLES_KEY)  || JSON.stringify(DEFAULT_ROLES)); }
