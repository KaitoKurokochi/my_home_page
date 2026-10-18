// ── Shared departments list ──────────────────────────────────────────────────
// Used by both js/note.js (desktop) and mobile/app.js (mobile).
// Depends on: shared/github-client.js (githubFetch)
//
// Fetches my_home_page/runtime/departments.json (pushed daily by agent-scripts'
// select_departments.py) and returns its label list: note labels are the department list itself.

// Used only if the fetch fails (network error, file missing, bad JSON) —
// keeps the label bar usable rather than empty.
const DEPARTMENTS_FALLBACK = [
  'baseball', 'books', 'football', 'general', 'health', 'HQ',
  'Lions_IS', 'living', 'research', 'softball', 'univ', 'video_content',
];

let _departmentLabelsCache = null;
let _departmentList = [];  // [{key, label}] from departments.json; empty until fetched (or if the fetch failed)

// Issue titles must carry the department KEY ("Lions_IS"), not its display label
// ("Lions IS"): agent-scripts' sync matches a title's first bracket against the key,
// so a display-label title is never picked up. Maps a label (or an already-key
// string) to its key; anything unknown (fetch failed, hand-typed) comes back unchanged.
function departmentKeyForLabel(label) {
  const norm = String(label || '').trim().toLowerCase();
  const hit = _departmentList.find(d =>
    (d.label || '').toLowerCase() === norm || (d.key || '').toLowerCase() === norm);
  return hit ? hit.key : label;
}

// Fetches once (cached after). Callers needing the labels synchronously (renderLabelBar, etc.)
// await this once during page init, then read getLabels() (each side's own cache-reader).
async function fetchDepartmentLabels() {
  if (_departmentLabelsCache) return _departmentLabelsCache;
  try {
    const text = await githubFetch('my_home_page/runtime/departments.json');
    const parsed = JSON.parse(text);
    _departmentList = parsed.filter(d => d && d.key);
    const labels = parsed.map(d => d.label || d.key).filter(Boolean);
    _departmentLabelsCache = labels.length ? labels : DEPARTMENTS_FALLBACK;
  } catch (_) {
    _departmentLabelsCache = DEPARTMENTS_FALLBACK;
  }
  return _departmentLabelsCache;
}
