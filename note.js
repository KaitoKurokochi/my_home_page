// ── Config ────────────────────────────────────────────────────────────────────
// Token is stored in localStorage (never in the codebase).
// To set it, open DevTools console and run:
//   localStorage.setItem('NOTE_TOKEN', 'ghp_xxxxxxxxxxxx')

const NOTE_OWNER = 'KaitoKurokochi';
const NOTE_REPO  = 'my_notes';
const GITHUB_API = `https://api.github.com/repos/${NOTE_OWNER}/${NOTE_REPO}/issues`;

const NOTE_TOKEN_KEY  = 'NOTE_TOKEN';
const NOTE_LABELS_KEY = 'note_labels';
const DEFAULT_LABELS  = ['Lions_IS', 'Entertainment', 'Research'];

function getToken()  { return localStorage.getItem(NOTE_TOKEN_KEY) || ''; }
function getLabels() { return JSON.parse(localStorage.getItem(NOTE_LABELS_KEY) || JSON.stringify(DEFAULT_LABELS)); }
function saveLabels(labels) {
  localStorage.setItem(NOTE_LABELS_KEY, JSON.stringify(labels));
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
  document.getElementById('note-token-save').addEventListener('click', () => {
    const val = document.getElementById('note-token-input').value.trim();
    if (!val) return;
    localStorage.setItem(NOTE_TOKEN_KEY, val);
    renderNoteUI();
    loadNotes();
  });
}

// ── Label bar ─────────────────────────────────────────────────────────────────

let selectedLabel = null;
const selectedRoles = new Set();
const ROLES = ['Memo', 'Todo', 'Idea', 'Want to do', 'Question'];

function renderLabelBar() {
  const bar = document.getElementById('note-label-bar');
  const labels = getLabels();
  bar.innerHTML = '';

  labels.forEach((name, i) => {
    const pill = document.createElement('span');
    pill.className = 'note-label-pill' + (name === selectedLabel ? ' selected' : '');
    pill.dataset.index = i;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'note-label-name';
    nameSpan.textContent = name;
    nameSpan.addEventListener('click', () => {
      selectedLabel = name;
      renderLabelBar();
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'note-label-edit';
    editBtn.title = 'Rename';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startLabelEdit(pill, i, name);
    });

    pill.appendChild(nameSpan);
    pill.appendChild(editBtn);
    bar.appendChild(pill);
  });

  // Add label button
  const addBtn = document.createElement('button');
  addBtn.className = 'note-label-add';
  addBtn.textContent = '+ Add';
  addBtn.addEventListener('click', () => {
    const labels = getLabels();
    const newName = 'New label';
    labels.push(newName);
    saveLabels(labels);
    renderLabelBar();
    // Immediately open edit for the new label
    const newIndex = labels.length - 1;
    const pills = document.querySelectorAll('.note-label-pill');
    startLabelEdit(pills[newIndex], newIndex, newName);
  });
  bar.appendChild(addBtn);
}

function startLabelEdit(pill, index, currentName) {
  const input = document.createElement('input');
  input.className = 'note-label-edit-input';
  input.value = currentName;
  pill.innerHTML = '';
  pill.appendChild(input);
  input.focus();
  input.select();

  function commit() {
    const val = input.value.trim();
    if (val) {
      const labels = getLabels();
      labels[index] = val;
      saveLabels(labels);
      if (selectedLabel === currentName) selectedLabel = val;
    }
    renderLabelBar();
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); renderLabelBar(); }
  });
}

// ── Role bar ──────────────────────────────────────────────────────────────────

function renderRoleBar() {
  const bar = document.getElementById('note-role-bar');
  bar.innerHTML = '';

  ROLES.forEach(role => {
    const pill = document.createElement('span');
    pill.className = 'note-role-pill' + (selectedRoles.has(role) ? ' selected' : '');
    pill.textContent = role;
    pill.addEventListener('click', () => {
      if (selectedRoles.has(role)) selectedRoles.delete(role);
      else selectedRoles.add(role);
      renderRoleBar();
    });
    bar.appendChild(pill);
  });
}

// ── Note UI ───────────────────────────────────────────────────────────────────

function renderNoteUI() {
  const container = document.getElementById('note-container');
  container.innerHTML = `
    <div id="note-label-bar" class="note-label-bar"></div>
    <form id="note-form" class="note-form" autocomplete="off">
      <textarea
        id="note-input"
        class="note-textarea"
        placeholder="What did you notice or learn today?"
        rows="4"
      ></textarea>
      <div id="note-role-bar" class="note-role-bar"></div>
      <div class="note-form-footer">
        <span id="note-status" class="note-status"></span>
        <button type="submit" class="note-submit">Save</button>
      </div>
    </form>
    <div id="note-list" class="note-list"></div>
  `;

  // Default selection: Research
  if (!selectedLabel) selectedLabel = 'Research';
  renderLabelBar();
  renderRoleBar();

  document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text   = document.getElementById('note-input').value.trim();
    const status = document.getElementById('note-status');

    if (!selectedLabel) {
      status.textContent = 'Please select a label.';
      status.className = 'note-status note-status--err';
      setTimeout(() => { status.textContent = ''; status.className = 'note-status'; }, 3000);
      return;
    }
    if (!text) return;

    status.textContent = 'Saving...';
    status.className = 'note-status';

    const roleStr = [...selectedRoles].map(r => `[${r}]`).join('');
    const title = `[${selectedLabel}]${roleStr} ` + text.slice(0, 72) + (text.length > 72 ? '…' : '');

    try {
      const res = await fetch(GITHUB_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, body: text, labels: ['note'] }),
      });

      if (res.status === 401) {
        localStorage.removeItem(NOTE_TOKEN_KEY);
        renderTokenSetup();
        return;
      }
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

      document.getElementById('note-input').value = '';
      status.textContent = 'Saved.';
      status.className = 'note-status note-status--ok';
      await loadNotes();
    } catch (err) {
      status.textContent = `Failed: ${err.message}`;
      status.className = 'note-status note-status--err';
    }

    setTimeout(() => {
      const s = document.getElementById('note-status');
      if (s) { s.textContent = ''; s.className = 'note-status'; }
    }, 4000);
  });
}

// ── Load recent notes ─────────────────────────────────────────────────────────

async function loadNotes() {
  const list = document.getElementById('note-list');
  if (!list) return;
  list.innerHTML = '<p class="note-list-loading">Loading...</p>';

  try {
    const res = await fetch(
      `${GITHUB_API}?labels=note&state=open&per_page=20&sort=created&direction=desc`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Accept': 'application/vnd.github+json',
        },
      }
    );
    if (!res.ok) throw new Error(`${res.status}`);
    const issues = await res.json();

    if (!issues.length) {
      list.innerHTML = '<p class="note-list-empty">No notes yet.</p>';
      return;
    }

    list.innerHTML = issues.map(issue => {
      const date  = new Date(issue.created_at);
      const dateLabel = date.toLocaleDateString('ja-JP', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      // Extract [Label] and any number of [Role] tags from title
      const brackets = [...issue.title.matchAll(/\[(.+?)\]/g)].map(m => m[1]);
      const tag      = brackets[0] || '';
      const roleTags = brackets.slice(1);
      return `
        <div class="note-item">
          <div class="note-item-tags">
            ${tag ? `<span class="note-item-tag">${escapeHtml(tag)}</span>` : ''}
            ${roleTags.map(r => `<span class="note-item-role">${escapeHtml(r)}</span>`).join('')}
          </div>
          <p class="note-item-body">${escapeHtml(issue.body || issue.title)}</p>
          <span class="note-item-date">${dateLabel}</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = `<p class="note-list-error">Failed to load: ${err.message}</p>`;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// ── Init ──────────────────────────────────────────────────────────────────────

function initNote() {
  if (getToken()) {
    renderNoteUI();
    loadNotes();
  } else {
    renderTokenSetup();
  }
}

initNote();
