// ── Sync: persist groups + labels to my_notes/sync.json via GitHub Contents API ──
//
// Uses the same NOTE_TOKEN already stored in localStorage by note.js.
// All failures are silent — sync is best-effort and never blocks the UI.

const SYNC_OWNER   = 'KaitoKurokochi';
const SYNC_REPO    = 'my_notes';
const SYNC_FILE    = 'sync.json';
const SYNC_API     = `https://api.github.com/repos/${SYNC_OWNER}/${SYNC_REPO}/contents/${SYNC_FILE}`;
const SYNC_SHA_KEY = 'mypage_sync_sha';

function _syncToken() {
  return localStorage.getItem('NOTE_TOKEN') || '';
}

function _syncHeaders() {
  return {
    'Authorization': `Bearer ${_syncToken()}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

// Pull remote → localStorage, then re-render
async function pullSync() {
  if (!_syncToken()) return;
  try {
    const res = await fetch(SYNC_API, { headers: _syncHeaders() });
    if (!res.ok) return; // 404 on first use — will be created on first push
    const data = await res.json();
    const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
    localStorage.setItem(SYNC_SHA_KEY, data.sha);
    if (content.groups !== undefined) localStorage.setItem('mypage_groups',  JSON.stringify(content.groups));
    if (content.labels !== undefined) localStorage.setItem('note_labels',    JSON.stringify(content.labels));
    // Re-render with synced data
    if (typeof render         === 'function') render();
    if (typeof renderLabelBar === 'function' && document.getElementById('note-label-bar')) renderLabelBar();
  } catch (_) { /* silent */ }
}

// Push localStorage → remote
async function pushSync() {
  if (!_syncToken()) { console.warn('[sync] push skipped: no token'); return; }
  const groups  = JSON.parse(localStorage.getItem('mypage_groups') || '[]');
  const labels  = JSON.parse(localStorage.getItem('note_labels')   || '[]');
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify({ groups, labels }, null, 2))));
  const sha     = localStorage.getItem(SYNC_SHA_KEY);
  const body    = { message: 'sync', content: encoded };
  if (sha) body.sha = sha;
  try {
    const res = await fetch(SYNC_API, { method: 'PUT', headers: _syncHeaders(), body: JSON.stringify(body) });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(SYNC_SHA_KEY, data.content.sha);
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('[sync] push failed', res.status, err.message);
    }
  } catch (e) { console.warn('[sync] push error', e); }
}

// Pull on page load (sync.js is loaded last, so render/renderLabelBar are already defined)
pullSync();
