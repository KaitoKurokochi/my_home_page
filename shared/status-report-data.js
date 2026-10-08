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

// Populated by fetchAgentDepartments() — [filePath, displayName, departmentKey]
// triplets, derived from agent-scripts' departments.json (key + label) plus
// the universal "<key>/status.md" file-path convention every department
// follows (including HQ, whose own status.md also carries "My Home Page"'s
// todos, merged 2026-09-17, under its "### My Home Page" heading — no
// separate file). No longer hardcoded here: this used to duplicate
// departments.json's key list (and silently miss any department added
// there, as happened with "health") — see computeDepartmentSelection(),
// which awaits fetchAgentDepartments() before anything below reads this.
// Empty (nothing shown) on fetch failure — same fail-soft-to-empty
// philosophy as fetchSelectedDepartments()/fetchZoneDepartments() below, no
// department-specific hardcoded fallback list.
let AGENT_DEPARTMENTS = [];

// Reverse map: display name → department key (e.g. "University" → "univ").
// Rebuilt by fetchAgentDepartments() each time AGENT_DEPARTMENTS changes.
let DISPLAY_NAME_TO_KEY = {};

let _agentDepartmentsCache = null;

// Fetches (once — cached after) departments.json and derives AGENT_DEPARTMENTS
// + DISPLAY_NAME_TO_KEY from it. Awaited by computeDepartmentSelection()
// before either is read, so every caller of that function (and
// fetchStatusReportData(), which calls it) sees up-to-date data without
// needing to call this directly.
async function fetchAgentDepartments() {
  if (_agentDepartmentsCache) return _agentDepartmentsCache;
  try {
    const text = await githubFetch('my_home_page/runtime/departments.json');
    const parsed = JSON.parse(text);
    _agentDepartmentsCache = parsed.map(d => [`${d.key}/status.md`, d.label || d.key, d.key]);
  } catch (_) {
    _agentDepartmentsCache = [];
  }
  AGENT_DEPARTMENTS = _agentDepartmentsCache;
  DISPLAY_NAME_TO_KEY = Object.fromEntries(AGENT_DEPARTMENTS.map(([, name, key]) => [name, key]));
  return AGENT_DEPARTMENTS;
}

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

// Fetches zone_departments.json from GitHub — {zone_name: [department_key, ...]},
// built by agent-scripts from each department's own "zones" setting in its
// department_settings/<key>.toml (see select_departments.py's
// build_zone_departments()). {} on failure.
async function fetchZoneDepartments() {
  try {
    const text = await githubFetch('my_home_page/runtime/zone_departments.json');
    const parsed = JSON.parse(text);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) {
    return {};
  }
}

// Computes the set of department keys to display based on:
//   1. selected_departments.json contents — this is also where "always show"
//      (department_settings/<key>.toml's always = true) and a calendar match
//      live now (agent-scripts' select_departments.py matches a department's
//      own key against today's event calendar labels first, falling back to
//      its configured calendar_trigger aliases), so display itself needs no
//      separate always-list or calendar-matching pass here
//   2. context rules (window.currentZone, via zone_departments.json)
//   3. schedule-based rules (window.todayEvents[].calendar — desktop-only;
//      mobile has no calendar widget, so window.todayEvents is just absent
//      and this branch is a no-op there)
// Also computes which department keys should be auto-expanded: the
// schedule-based rule below (#3) is expand-only now, since display is
// already covered by #1 above. selected_departments.json's "auto_expand"
// (weekday-based, from each department's own toml — see
// fetchSelectedDepartments()) and zone_departments.json's entry for
// window.currentZone (also from each department's own toml — see
// fetchZoneDepartments()) feed both display and expand.
// Returns { departmentKeys: Set<string>, autoExpand: Set<string> } (both department keys).
// Nothing is shown if selected_departments.json's fetch fails — no hardcoded
// always-list fallback (fail-soft-to-empty, same philosophy as
// fetchAgentDepartments()/fetchZoneDepartments()).
async function computeDepartmentSelection() {
  await fetchAgentDepartments();

  const departmentKeys = new Set();
  const autoExpand = new Set();

  const validDepartmentKeys = new Set(AGENT_DEPARTMENTS.map(([,, k]) => k));

  const { departments: selected, autoExpand: serverAutoExpand } = await fetchSelectedDepartments();
  for (const k of selected) departmentKeys.add(k);
  for (const k of serverAutoExpand) autoExpand.add(k);

  const zone = window.currentZone;  // may be undefined if GPS not yet ready
  if (zone) {
    const zoneDepartments = await fetchZoneDepartments();
    for (const k of (zoneDepartments[zone] || [])) {
      departmentKeys.add(k);
      autoExpand.add(k);
    }
  }

  const events = Array.isArray(window.todayEvents) ? window.todayEvents : [];
  for (const ev of events) {
    const cal = ev.calendar;
    if (cal && validDepartmentKeys.has(cal)) {
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
