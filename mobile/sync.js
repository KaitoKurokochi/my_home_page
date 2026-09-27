// ── Labels/roles storage (mobile) ────────────────────────────────────────────
// pullSync()/pushSync() themselves now live in ../shared/sync-api.js — this
// file only keeps the label/role defaults and accessors, which stay local
// because mobile's DEFAULT_LABELS intentionally differs from desktop's
// (js/note.js's) — they're only ever used as first-run fallbacks before the
// first successful sync from vault.

const LABELS_KEY    = 'note_labels';
const ROLES_KEY     = 'note_roles';

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

function getLabels() { return JSON.parse(localStorage.getItem(LABELS_KEY) || JSON.stringify(DEFAULT_LABELS)); }
function getRoles()  { return JSON.parse(localStorage.getItem(ROLES_KEY)  || JSON.stringify(DEFAULT_ROLES)); }
