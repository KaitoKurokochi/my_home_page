// ── Sync: persist groups + labels to agent/my_home_page/runtime/sync.json via GitHub Contents API ──
// Depends on: js/config.js (GITHUB_OWNER, NOTES_REPO, getToken)
//
// Uses the same NOTE_TOKEN already stored in localStorage by note.js.
// All failures are silent — sync is best-effort and never blocks the UI.

const SYNC_FILE    = 'my_home_page/runtime/sync.json';
const SYNC_API     = `https://api.github.com/repos/${GITHUB_OWNER}/${NOTES_REPO}/contents/${SYNC_FILE}`;
const SYNC_SHA_KEY = 'mypage_sync_sha';

function _syncHeaders() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

// Pull remote → localStorage, then re-render
async function pullSync() {
  if (!getToken()) return;
  try {
    const res = await fetch(SYNC_API, { headers: _syncHeaders() });
    if (!res.ok) return; // 404 on first use — will be created on first push
    const data = await res.json();
    const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
    localStorage.setItem(SYNC_SHA_KEY, data.sha);
    if (content.labels !== undefined) localStorage.setItem('note_labels',    JSON.stringify(content.labels));
    if (content.roles  !== undefined) localStorage.setItem('note_roles',     JSON.stringify(content.roles));
    // Re-render with synced data
    if (typeof renderLabelBar === 'function' && document.getElementById('note-label-bar')) renderLabelBar();
    if (typeof renderRoleBar  === 'function' && document.getElementById('note-role-bar'))  renderRoleBar();
  } catch (_) { /* silent */ }
}

// Push localStorage → remote (retries once on 409 Conflict with refreshed sha)
async function pushSync() {
  if (!getToken()) return;
  const labels   = JSON.parse(localStorage.getItem('note_labels')   || '[]');
  const rolesRaw = localStorage.getItem('note_roles');
  const payload  = { labels };
  if (rolesRaw !== null) payload.roles = JSON.parse(rolesRaw);
  const encoded  = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));

  async function attempt(sha) {
    const body = { message: 'sync', content: encoded };
    if (sha) body.sha = sha;
    const res = await fetch(SYNC_API, { method: 'PUT', headers: _syncHeaders(), body: JSON.stringify(body) });
    return res;
  }

  try {
    let sha = localStorage.getItem(SYNC_SHA_KEY);
    let res = await attempt(sha);

    // 409 Conflict means our sha is stale — fetch the latest sha and retry once
    if (res.status === 409) {
      const latest = await fetch(SYNC_API, { headers: _syncHeaders() });
      if (latest.ok) {
        const data = await latest.json();
        sha = data.sha;
        localStorage.setItem(SYNC_SHA_KEY, sha);
        res = await attempt(sha);
      }
    }

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(SYNC_SHA_KEY, data.content.sha);
    }
  } catch (_) { /* silent */ }
}

// Pull on page load (sync.js is loaded last, so render/renderLabelBar are already defined)
pullSync();
