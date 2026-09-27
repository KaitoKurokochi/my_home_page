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
