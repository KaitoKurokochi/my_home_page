// ── Shared status report data ────────────────────────────────────────────────
// Used by both js/status.js (desktop) and mobile/report.js (mobile).
// Depends on: shared/github-client.js (githubFetch)
//
// Fetches each department's status.md, extracts the display-worthy body and decides which
// departments to include. Turning that markdown into DOM is UI-specific and stays local to each
// side, since desktop and mobile render genuinely different layouts.

// Populated by fetchAgentDepartments(): [filePath, displayName, departmentKey] triplets from
// departments.json plus the "<key>/status.md" file-path convention (HQ's status.md also carries
// the "### My Home Page" todos). Empty on fetch failure: nothing is shown, no hardcoded fallback.
let AGENT_DEPARTMENTS = [];

let DISPLAY_NAME_TO_KEY = {};

let _agentDepartmentsCache = null;

// Fetches departments.json once (cached) and derives AGENT_DEPARTMENTS + DISPLAY_NAME_TO_KEY.
// computeDepartmentSelection() awaits it, so callers don't need to call it directly.
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

function departmentName(key) {
  const entry = AGENT_DEPARTMENTS.find(([,, k]) => k === key);
  return entry ? entry[1] : key;
}

// The displayable part of a status.md: drops the leading "# ..." title and any preamble before the
// first "## " section.
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

// Fetches selected_departments.json: { departments: string[], autoExpand: string[] }. departments
// are the keys to show; autoExpand is each department's expand_days (weekday names) already
// resolved against today by select_departments.py (e.g. HQ opening on Sundays). Both empty on
// failure or when an older file has no "auto_expand" key.
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

// Fetches zone_departments.json ({zone_name: [department_key, ...]}, built from each department's
// "zones" setting). {} on failure.
async function fetchZoneDepartments() {
  try {
    const text = await githubFetch('my_home_page/runtime/zone_departments.json');
    const parsed = JSON.parse(text);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) {
    return {};
  }
}

// Which department keys to display and which to auto-expand. Display comes from:
//   1. selected_departments.json (select_departments.py already applied always, days and calendar
//      matching), plus its "auto_expand" weekday rule
//   2. zone_departments.json's entry for window.currentZone (shown and expanded)
//   3. window.todayEvents[].calendar matching a department key (expand only; desktop-only —
//      mobile has no calendar widget, so this is a no-op there)
// Returns { departmentKeys: Set<string>, autoExpand: Set<string> }. Nothing is shown if the
// selected_departments.json fetch fails.
async function computeDepartmentSelection() {
  await fetchAgentDepartments();

  const departmentKeys = new Set();
  const autoExpand = new Set();

  const validDepartmentKeys = new Set(AGENT_DEPARTMENTS.map(([,, k]) => k));

  const { departments: selected, autoExpand: serverAutoExpand } = await fetchSelectedDepartments();
  for (const k of selected) departmentKeys.add(k);
  for (const k of serverAutoExpand) autoExpand.add(k);

  const zone = window.currentZone;
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

// One entry per visible department with its extracted status.md body, plus the display names that
// start auto-expanded.
// Returns { departments: [{ name, status, departmentKey }], autoExpandNames: Set<string> }
async function fetchStatusReportData() {
  const { departmentKeys, autoExpand } = await computeDepartmentSelection();

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
