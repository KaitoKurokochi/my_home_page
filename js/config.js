// ── Shared GitHub API config ────────────────────────────────────────────────
//
// This file must be loaded FIRST (before all other scripts) because all other
// JS files depend on the constants and functions defined here.
//
// Token is stored only in localStorage — never in the codebase.
// To set it: localStorage.setItem('NOTE_TOKEN', 'ghp_xxxxxxxxxxxx')

const GITHUB_OWNER = 'KaitoKurokochi';
const NOTES_REPO   = 'agent';

// ── Token ─────────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('NOTE_TOKEN') || '';
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
  const token = getToken();
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/${path}`,
    { headers, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`${res.status} ${path}`);

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
