// ── Config ────────────────────────────────────────────────────────────────────
// Depends on: shared/github-client.js (getToken, esc), shared/notes-api.js
// (GITHUB_API, parseTitleParts, buildTitle, updateIssue, changeIssueTitleOptimistically, fetchRecentNotes),
// shared/note-labels.js (guessLabel, isBookLabel, isVideoLabel, templates),
// shared/sync-api.js (pullSync, pushSync), shared/departments-api.js
// (fetchDepartmentLabels — labels now come from the department list, not a
// per-browser editable list; see that file's header for why, 2026-09-29)
// Token is stored in localStorage (never in the codebase).
// To set it, open DevTools console and run:
//   localStorage.setItem('NOTE_TOKEN', 'ghp_xxxxxxxxxxxx')

const NOTE_TOKEN_KEY  = 'NOTE_TOKEN';
const DEFAULT_ROLES   = [
  { key: 'Memo',        icon: '📝' },
  { key: 'Todo',        icon: '🔔' },
  { key: 'Idea',        icon: '💡' },
  { key: 'Journal',     icon: '📓' },
  { key: 'Question',    icon: '❓' },
  { key: 'Done',        icon: '✅' },
];

// getLabels() reads fetchDepartmentLabels()'s cache (shared/departments-api.js); initNote() awaits
// it once before any render.
function getLabels() { return _departmentLabelsCache || DEPARTMENTS_FALLBACK; }
function getRoles()  { return JSON.parse(localStorage.getItem(NOTE_ROLES_KEY)  || JSON.stringify(DEFAULT_ROLES)); }
function saveRoles(roles) {
  localStorage.setItem(NOTE_ROLES_KEY, JSON.stringify(roles));
  if (typeof pushSync === 'function') pushSync();
}

// ── Token setup UI ────────────────────────────────────────────────────────────

function renderTokenSetup() {
  const container = document.getElementById('note-container');
  container.innerHTML = `
    <div class="note-setup">
      <p class="note-setup-desc">GitHub token is not set. Enter your fine-grained PAT to enable My Note.</p>
      <div class="note-setup-row">
        <input type="password" id="note-token-input" class="note-token-input" placeholder="ghp_xxxxxxxxxxxx" />
        <button id="note-token-save" class="note-submit">Save</button>
      </div>
      <p class="note-setup-hint">The token is stored only in this browser's localStorage — never in the repository.</p>
    </div>
  `;
  document.getElementById('note-token-save').addEventListener('click', async () => {
    const val = document.getElementById('note-token-input').value.trim();
    if (!val) return;
    localStorage.setItem(NOTE_TOKEN_KEY, val);
    await fetchDepartmentLabels();
    renderNoteUI();
    loadNotes();
  });
}
