// ── Shared GitHub API client ─────────────────────────────────────────────────
// Used by both the desktop page (js/) and the mobile PWA (mobile/).
// Must be loaded first — everything else depends on these.
//
// Token is stored only in localStorage — never in the codebase.
// To set it: localStorage.setItem('NOTE_TOKEN', 'ghp_xxxxxxxxxxxx')

const GITHUB_OWNER = 'KaitoKurokochi';
const NOTES_REPO   = 'vault';   // data store (JSON/note.md/report files) and GitHub Issues (note CRUD backend)

// ── Token ─────────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('NOTE_TOKEN') || '';
}

function githubHeaders() {
  const token = getToken();
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ── GitHub Contents API fetch ─────────────────────────────────────────────────
//
// Fetches a file from the GitHub Contents API and returns the decoded text.
// path: e.g. 'my_home_page/runtime/news.json'
// options.repo: override repo (default: NOTES_REPO)
// options.returnMeta: if true, returns { text, sha } instead of just text
//
// Throws on HTTP error.

async function githubFetch(path, options = {}) {
  const repo = options.repo || NOTES_REPO;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/${path}`,
    { headers: githubHeaders(), cache: 'no-store' }
  );
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${path}`), { status: res.status });

  const meta = await res.json();
  const text = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))));

  if (options.returnMeta) return { text, sha: meta.sha };
  return text;
}

// ── HTML escape ───────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Local date ────────────────────────────────────────────────────────────────

// Today's date as YYYY-MM-DD in the browser's local time zone. Do not use
// new Date().toISOString().slice(0, 10) for this: that is the UTC date, which is
// still "yesterday" between 00:00 and 09:00 JST and breaks comparisons against
// the JST dates the agent-scripts pipeline writes (e.g. due_today.json's "date").
function localDateString(d = new Date()) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
