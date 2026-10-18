// ── Labels/roles storage (mobile) ────────────────────────────────────────────
// pullSync()/pushSync() live in ../shared/sync-api.js. Labels come from the cache of
// ../shared/departments-api.js's fetchDepartmentLabels(); roles keep their own local defaults.

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
function getRoles()  { return JSON.parse(localStorage.getItem(NOTE_ROLES_KEY)  || JSON.stringify(DEFAULT_ROLES)); }
