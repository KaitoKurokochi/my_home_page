// ── Shared note Issue API ─────────────────────────────────────────────────────
// Used by both note.js (desktop) and app.js (mobile).
// Depends on: shared/github-client.js (GITHUB_OWNER, NOTES_REPO, getToken)

const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${NOTES_REPO}/issues`;

// ── Issue title parsing / building ────────────────────────────────────────────

function parseTitleParts(title) {
  const brackets = [...title.matchAll(/\[(.+?)\]/g)].map(m => m[1]);
  const label = brackets[0] || '';
  const roles = brackets.slice(1);
  const text  = title.replace(/^(\[[^\]]+\])+\s*/, '');
  return { label, roles, text };
}

function buildTitle(label, roles) {
  const roleStr = roles.map(r => `[${r}]`).join('');
  return `[${label}]${roleStr}`;
}

// ── Issue update (PATCH) ──────────────────────────────────────────────────────

async function updateIssue(number, patch) {
  const res = await fetch(`${GITHUB_API}/${number}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

// ── Recent notes fetch ────────────────────────────────────────────────────────
//
// Fetches "note"-labeled issues, filtered to the last `cutoffHours` hours,
// newest first, capped at `limit`. Desktop and mobile used to each duplicate
// this fetch+filter logic, and had let the cutoff value drift between them
// (see history.md #887/#891) — this is the single source now.

async function fetchRecentNotes({ cutoffHours = 5, limit = 10 } = {}) {
  const res = await fetch(
    `${GITHUB_API}?labels=note&state=all&per_page=20&sort=created&direction=desc`,
    { headers: { 'Authorization': `Bearer ${getToken()}`, 'Accept': 'application/vnd.github+json' } }
  );
  if (!res.ok) throw new Error(`${res.status}`);
  const allIssues = await res.json();
  const cutoff = Date.now() - cutoffHours * 60 * 60 * 1000;
  return allIssues.filter(i => new Date(i.created_at).getTime() >= cutoff).slice(0, limit);
}
