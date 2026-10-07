// ── Shared status report data ────────────────────────────────────────────────
// Used by both js/status.js (desktop) and mobile/report.js (mobile).
// Depends on: shared/github-client.js (githubFetch)
//
// Fetches each department's status.md, extracts the display-worthy body, and
// decides which departments to include — up through "clean per-department markdown
// text". Turning that into HTML/DOM (markdownToHtml, section wrapping,
// mention buttons, etc.) is UI-specific and stays local to each side, since
// desktop and mobile render this into genuinely different layouts.
//
// Both js/status.js and mobile/report.js used to each fetch a different file
// per department (status.md vs the retired note.md pipeline, frozen since
// 2026-09-20) — this is the single source now.

// All available departments: [filePath, displayName, departmentKey]
// "My Home Page" was merged into HQ (2026-09-17) and has no status.md of its
// own anymore — its todos live under HQ/status.md's "### My Home Page" heading.
const AGENT_DEPARTMENTS = [
  ['research/status.md',      'Research',     'research'],
  ['Lions_IS/status.md',      'Lions IS',     'Lions_IS'],
  ['baseball/status.md',      'Baseball',     'baseball'],
  ['football/status.md',      'Football',     'football'],
  ['books/status.md',         'Books',        'books'],
  ['softball/status.md',      'Softball',     'softball'],
  ['univ/status.md',          'University',   'univ'],
  ['video_content/status.md', 'Video Content','video_content'],
  ['general/status.md',       'General',      'general'],
  ['living/status.md',        'Living',       'living'],
  ['HQ/status.md',            'HQ',           'HQ'],
];

// Departments always shown regardless of selected_departments.json or context.
const ALWAYS_DEPARTMENT_KEYS = ['research', 'general', 'living'];

// Reverse map: display name → department key (e.g. "University" → "univ")
const DISPLAY_NAME_TO_KEY = Object.fromEntries(AGENT_DEPARTMENTS.map(([, name, key]) => [name, key]));

// Returns the display name for a department key (looks up AGENT_DEPARTMENTS).
function departmentName(key) {
  const entry = AGENT_DEPARTMENTS.find(([,, k]) => k === key);
  return entry ? entry[1] : key;
}

// Extracts the displayable body from a status.md string: drops the leading
// "# ..." title line and any preamble text before the first "## " section,
// so only the actual Todo/Ideas/etc. sections remain.
function extractStatusBody(md) {
  const lines = md.split('\n');
  let start = 0;
  if (lines.length && /^# /.test(lines[0])) start = 1;
  let firstH2 = -1;
  for (let i = start; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { firstH2 = i; break; }
  }
  const body = firstH2 >= 0 ? lines.slice(firstH2) : lines.slice(start);
  while (body.length && body[0].trim() === '') body.shift();
  while (body.length && body[body.length - 1].trim() === '') body.pop();
  return body.join('\n');
}

// Fetches selected_departments.json from GitHub.
// Returns { departments: string[], autoExpand: string[] } — departments is
// the keys to show; autoExpand is department_settings/<key>.toml's optional
// expand_days (weekday names), already resolved against today server-side
// (see agent-scripts' select_departments.py select_auto_expand()) — e.g. HQ's
// section opening specifically on Sundays, when its weekly recurring task
// appears. Both empty on failure or for an older cached file with no
// "auto_expand" key.
async function fetchSelectedDepartments() {
  try {
    const text = await githubFetch('my_home_page/runtime/selected_departments.json');
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { departments: parsed, autoExpand: [] };
    return {
      departments: Array.isArray(parsed.departments) ? parsed.departments : [],
      autoExpand: Array.isArray(parsed.auto_expand) ? parsed.auto_expand : [],
    };
  } catch (_) {
    return { departments: [], autoExpand: [] };
  }
}

// Computes the set of department keys to display based on:
//   1. always set (ALWAYS_DEPARTMENT_KEYS)
//   2. selected_departments.json contents
//   3. context rules (window.currentZone)
//   4. schedule-based rules (window.todayEvents[].calendar — desktop-only;
//      mobile has no calendar widget, so window.todayEvents is just absent
//      and this branch is a no-op there)
// Also computes which department keys should be auto-expanded — this now
// includes selected_departments.json's "auto_expand" (weekday-based, from
// each department's own toml — see fetchSelectedDepartments()) alongside the
// zone/calendar rules below.
// Returns { departmentKeys: Set<string>, autoExpand: Set<string> } (both department keys)
async function computeDepartmentSelection() {
  const departmentKeys = new Set(ALWAYS_DEPARTMENT_KEYS);
  const autoExpand = new Set();

  const validDepartmentKeys = new Set(AGENT_DEPARTMENTS.map(([,, k]) => k));

  const { departments: selected, autoExpand: serverAutoExpand } = await fetchSelectedDepartments();
  for (const k of selected) departmentKeys.add(k);
  for (const k of serverAutoExpand) autoExpand.add(k);

  const zone = window.currentZone;  // may be undefined if GPS not yet ready

  if (zone === 'home') {
    autoExpand.add('living');
  }
  if (zone === 'univ') {
    autoExpand.add('research');
  }
  if (zone === 'lions_is') {
    departmentKeys.add('Lions_IS');
    autoExpand.add('Lions_IS');
  }

  const events = Array.isArray(window.todayEvents) ? window.todayEvents : [];
  for (const ev of events) {
    const cal = ev.calendar;
    if (cal && validDepartmentKeys.has(cal)) {
      departmentKeys.add(cal);
      autoExpand.add(cal);
    }
  }

  return { departmentKeys, autoExpand };
}

// Fetches and assembles this cycle's status report data: one entry per
// visible department with its extracted status.md body, plus the set of display
// names that should start auto-expanded.
// Returns { departments: [{ name, status, departmentKey }], autoExpandNames: Set<string> }
async function fetchStatusReportData() {
  const { departmentKeys, autoExpand } = await computeDepartmentSelection();

  // Preserve AGENT_DEPARTMENTS' canonical order.
  const selectedDepartments = AGENT_DEPARTMENTS.filter(([,, k]) => departmentKeys.has(k));

  const results = await Promise.all(
    selectedDepartments.map(async ([path, name, key]) => {
      try {
        const md = await githubFetch(path);
        const status = extractStatusBody(md);
        if (!status) return null;
        return { name, status, departmentKey: key };
      } catch (_) {
        return null;
      }
    })
  );

  const autoExpandNames = new Set([...autoExpand].map(departmentName));

  return { departments: results.filter(Boolean), autoExpandNames };
}
