// ── Shared status report data ────────────────────────────────────────────────
// Used by both js/status.js (desktop) and mobile/report.js (mobile).
// Depends on: shared/github-client.js (githubFetch)
//
// Fetches each domain's status.md, extracts the display-worthy body, and
// decides which domains to include — up through "clean per-domain markdown
// text". Turning that into HTML/DOM (markdownToHtml, section wrapping,
// mention buttons, etc.) is UI-specific and stays local to each side, since
// desktop and mobile render this into genuinely different layouts.
//
// Both js/status.js and mobile/report.js used to each fetch a different file
// per domain (status.md vs the retired note.md pipeline, frozen since
// 2026-09-20) — this is the single source now.

// All available domains: [filePath, displayName, domainKey]
// "My Home Page" was merged into HQ (2026-09-17) and has no status.md of its
// own anymore — its todos live under HQ/status.md's "### My Home Page" heading.
const AGENT_DOMAINS = [
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

// Domains always shown regardless of selected_domains.json or context.
const ALWAYS_DOMAIN_KEYS = ['research', 'general', 'living'];

// Reverse map: display name → domain key (e.g. "University" → "univ")
const DISPLAY_NAME_TO_KEY = Object.fromEntries(AGENT_DOMAINS.map(([, name, key]) => [name, key]));

// Returns the display name for a domain key (looks up AGENT_DOMAINS).
function domainName(key) {
  const entry = AGENT_DOMAINS.find(([,, k]) => k === key);
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

// Fetches selected_domains.json from GitHub. Returns an array of domain
// keys, or [] on failure.
async function fetchSelectedDomains() {
  try {
    const text = await githubFetch('my_home_page/runtime/selected_domains.json');
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.domains)) return parsed.domains;
    return [];
  } catch (_) {
    return [];
  }
}

// Computes the set of domain keys to display based on:
//   1. always set (ALWAYS_DOMAIN_KEYS)
//   2. selected_domains.json contents
//   3. context rules (window.currentZone, day of week)
//   4. schedule-based rules (window.todayEvents[].calendar — desktop-only;
//      mobile has no calendar widget, so window.todayEvents is just absent
//      and this branch is a no-op there)
// Also computes which domain keys should be auto-expanded.
// Returns { domainKeys: Set<string>, autoExpand: Set<string> } (both domain keys)
async function computeDomainSelection() {
  const domainKeys = new Set(ALWAYS_DOMAIN_KEYS);
  const autoExpand = new Set();

  const validDomainKeys = new Set(AGENT_DOMAINS.map(([,, k]) => k));

  const selected = await fetchSelectedDomains();
  for (const k of selected) domainKeys.add(k);

  const zone = window.currentZone;  // may be undefined if GPS not yet ready
  const dow  = new Date().getDay(); // 0 = Sunday

  if (zone === 'home') {
    autoExpand.add('living');
  }
  if (zone === 'univ') {
    autoExpand.add('research');
  }
  if (zone === 'lions_is') {
    domainKeys.add('Lions_IS');
    autoExpand.add('Lions_IS');
  }
  if (dow === 0) {
    domainKeys.add('HQ');
    autoExpand.add('HQ');
  }

  const events = Array.isArray(window.todayEvents) ? window.todayEvents : [];
  for (const ev of events) {
    const cal = ev.calendar;
    if (cal && validDomainKeys.has(cal)) {
      domainKeys.add(cal);
      autoExpand.add(cal);
    }
  }

  return { domainKeys, autoExpand };
}

// Fetches and assembles this cycle's status report data: one entry per
// visible domain with its extracted status.md body, plus the set of display
// names that should start auto-expanded.
// Returns { domains: [{ name, status, domainKey }], autoExpandNames: Set<string> }
async function fetchStatusReportData() {
  const { domainKeys, autoExpand } = await computeDomainSelection();

  // Preserve AGENT_DOMAINS' canonical order.
  const selectedDomains = AGENT_DOMAINS.filter(([,, k]) => domainKeys.has(k));

  const results = await Promise.all(
    selectedDomains.map(async ([path, name, key]) => {
      try {
        const md = await githubFetch(path);
        const status = extractStatusBody(md);
        if (!status) return null;
        return { name, status, domainKey: key };
      } catch (_) {
        return null;
      }
    })
  );

  const autoExpandNames = new Set([...autoExpand].map(domainName));

  return { domains: results.filter(Boolean), autoExpandNames };
}
