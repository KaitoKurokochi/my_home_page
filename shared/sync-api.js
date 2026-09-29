// ── Shared sync: roles ↔ vault's my_home_page/runtime/sync.json ──────────────
// Used by both note.js/sync.js (desktop) and app.js/sync.js (mobile).
// Depends on: shared/github-client.js (GITHUB_OWNER, NOTES_REPO, getToken)
//
// Labels are no longer synced here — they come from shared/departments-api.js's
// fetchDepartmentLabels() instead (2026-09-29, see status.md/history.md).
// A "labels" field may still linger in existing sync.json files from before
// this change; it's simply ignored now, never read or written.
//
// Reads/writes the 'note_roles' localStorage key directly (rather than
// through each side's own getRoles(), whose default values intentionally
// differ between desktop and mobile) so this works identically regardless
// of which page loads it.
//
// pushSync() fetches the current file, merges roles into whatever is
// already there (preserving unrelated fields like "groups"), and PUTs — with
// no sha when the file doesn't exist yet (first-time creation), retrying once
// on 409 (stale sha race) with a fresh fetch+merge.
//
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

// Pull remote → localStorage, then re-render whichever UI is loaded on this
// page (guarded so this works whether the page defines desktop's
// renderRoleBar or mobile's renderForm).
async function pullSync() {
  if (!getToken()) return;
  try {
    const res = await fetch(SYNC_API, { headers: _syncHeaders() });
    if (!res.ok) return; // 404 on first use — will be created on first push
    const data = await res.json();
    const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
    localStorage.setItem(SYNC_SHA_KEY, data.sha);
    if (content.roles  !== undefined) localStorage.setItem('note_roles',  JSON.stringify(content.roles));
    if (typeof renderRoleBar  === 'function' && document.getElementById('note-role-bar'))  renderRoleBar();
    if (typeof renderForm     === 'function' && document.getElementById('form-container')) renderForm();
  } catch (_) { /* silent */ }
}

// Push localStorage → remote. See module comment above for the merge/retry
// behavior.
async function pushSync() {
  if (!getToken()) return;
  const rolesRaw = localStorage.getItem('note_roles');

  async function attempt() {
    const getRes = await fetch(SYNC_API, { headers: _syncHeaders() });
    let sha = null;
    let existing = {};
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      existing = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
    }
    const payload = { ...existing };
    if (rolesRaw !== null) payload.roles = JSON.parse(rolesRaw);
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2) + '\n')));
    const body = { message: 'sync', content: encoded };
    if (sha) body.sha = sha;
    return fetch(SYNC_API, { method: 'PUT', headers: _syncHeaders(), body: JSON.stringify(body) });
  }

  try {
    let res = await attempt();
    if (res.status === 409) res = await attempt(); // stale sha race — retry once with a fresh fetch+merge
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(SYNC_SHA_KEY, data.content.sha);
    }
  } catch (_) { /* silent */ }
}
