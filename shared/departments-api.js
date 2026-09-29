// ── Shared departments list ──────────────────────────────────────────────────
// Used by both js/note.js (desktop) and mobile/app.js (mobile).
// Depends on: shared/github-client.js (githubFetch)
//
// Fetches my_home_page/runtime/departments.json — pushed daily by
// agent-scripts' select_departments.py (see agent-scripts v1.16.5) — and
// returns its label list. This replaces the old per-browser, user-editable
// label list (localStorage 'note_labels', synced via sync.json): that list
// had drifted from the real department set over time (e.g. "Entertainment"/
// "Research" with no corresponding department), and there's no reason for
// note labels to be anything other than the department list itself
// (2026-09-29, see status.md/history.md).

// Used only if the fetch fails (network error, file missing, bad JSON) —
// keeps the label bar usable rather than empty.
const DEPARTMENTS_FALLBACK = [
  'baseball', 'books', 'football', 'general', 'health', 'HQ',
  'Lions_IS', 'living', 'research', 'softball', 'univ', 'video_content',
];

let _departmentLabelsCache = null;

// Fetches (once — cached after) and returns the department label list.
// Callers that need this synchronously (renderLabelBar, etc.) should await
// this once during page init and read getLabels() (each side's own thin
// cache-reader) afterward.
async function fetchDepartmentLabels() {
  if (_departmentLabelsCache) return _departmentLabelsCache;
  try {
    const text = await githubFetch('my_home_page/runtime/departments.json');
    const parsed = JSON.parse(text);
    const labels = parsed.map(d => d.label || d.key).filter(Boolean);
    _departmentLabelsCache = labels.length ? labels : DEPARTMENTS_FALLBACK;
  } catch (_) {
    _departmentLabelsCache = DEPARTMENTS_FALLBACK;
  }
  return _departmentLabelsCache;
}
