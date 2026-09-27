// ── Sync: pull labels/roles from agent/my_home_page/runtime/sync.json ────────

const SYNC_OWNER = 'KaitoKurokochi';
const SYNC_REPO  = 'vault';
const SYNC_FILE  = 'my_home_page/runtime/sync.json';
const SYNC_API   = `https://api.github.com/repos/${SYNC_OWNER}/${SYNC_REPO}/contents/${SYNC_FILE}`;

const TOKEN_KEY     = 'NOTE_TOKEN';
const LABELS_KEY    = 'note_labels';
const ROLES_KEY     = 'note_roles';
const SYNC_SHA_KEY  = 'mypage_sync_sha';

const DEFAULT_LABELS = [
  'Lions_IS', 'Books', 'Research', 'General', 'Softball',
  'my_home_page', 'Football', 'HQ', 'video_content', 'Others', 'Baseball',
];
const DEFAULT_ROLES  = [
  { key: 'Memo',       icon: '📝' },
  { key: 'Todo',       icon: '🔲' },
  { key: 'Idea',       icon: '💡' },
  { key: 'Journal',    icon: '📓' },
  { key: 'Question',   icon: '❓' },
  { key: 'Done',       icon: '✅' },
];

function getToken()  { return localStorage.getItem(TOKEN_KEY) || ''; }
function getLabels() { return JSON.parse(localStorage.getItem(LABELS_KEY) || JSON.stringify(DEFAULT_LABELS)); }
function getRoles()  { return JSON.parse(localStorage.getItem(ROLES_KEY)  || JSON.stringify(DEFAULT_ROLES)); }

function syncHeaders() {
  const t = getToken();
  return {
    'Accept': 'application/vnd.github+json',
    ...(t ? { 'Authorization': `Bearer ${t}` } : {}),
  };
}

async function pullSync() {
  if (!getToken()) return;
  try {
    const res = await fetch(SYNC_API, { headers: syncHeaders() });
    if (!res.ok) return;
    const data    = await res.json();
    const content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
    localStorage.setItem(SYNC_SHA_KEY, data.sha);
    if (content.labels !== undefined) localStorage.setItem(LABELS_KEY, JSON.stringify(content.labels));
    if (content.roles  !== undefined) localStorage.setItem(ROLES_KEY,  JSON.stringify(content.roles));
  } catch (_) { /* silent */ }
}

async function pushSync() {
  if (!getToken()) return;
  try {
    // Get current SHA
    const getRes = await fetch(SYNC_API, { headers: syncHeaders() });
    let sha = null;
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      // Merge with existing content to preserve other fields (e.g. groups)
      const existing = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
      const payload = {
        ...existing,
        labels: getLabels(),
        roles: getRoles(),
      };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2) + '\n')));
      await fetch(SYNC_API, {
        method: 'PUT',
        headers: { ...syncHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'chore: update labels via mobile', content: encoded, sha }),
      });
    }
  } catch (_) { /* silent */ }
}
