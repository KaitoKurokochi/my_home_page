// ── Config ────────────────────────────────────────────────────────────────────
// Token is stored in localStorage (never in the codebase).
// To set it, open DevTools console and run:
//   localStorage.setItem('NOTE_TOKEN', 'ghp_xxxxxxxxxxxx')

const NOTE_OWNER = 'KaitoKurokochi';
const NOTE_REPO  = 'my_notes';
const GITHUB_API = `https://api.github.com/repos/${NOTE_OWNER}/${NOTE_REPO}/issues`;

const NOTE_TOKEN_KEY  = 'NOTE_TOKEN';
const NOTE_LABELS_KEY = 'note_labels';
const NOTE_ROLES_KEY  = 'note_roles';
const DEFAULT_LABELS  = ['Lions_IS', 'Entertainment', 'Research'];
const DEFAULT_ROLES   = [
  { key: 'Memo',        icon: '📝' },
  { key: 'Todo',        icon: '🔲' },
  { key: 'Idea',        icon: '💡' },
  { key: 'Want to do',  icon: '⭐' },
  { key: 'Question',    icon: '❓' },
  { key: 'Done',        icon: '✅' },
];

function getToken()  { return localStorage.getItem(NOTE_TOKEN_KEY) || ''; }
function getLabels() { return JSON.parse(localStorage.getItem(NOTE_LABELS_KEY) || JSON.stringify(DEFAULT_LABELS)); }
function getRoles()  { return JSON.parse(localStorage.getItem(NOTE_ROLES_KEY)  || JSON.stringify(DEFAULT_ROLES)); }
function saveLabels(labels) {
  localStorage.setItem(NOTE_LABELS_KEY, JSON.stringify(labels));
  if (typeof pushSync === 'function') pushSync();
}
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
let currentMention = null;  // { title, section }

// Called from status.js when user clicks [@] on a report item
window.setMention = function(item) {
  currentMention = item;
  renderMentionBadge();
  const textarea = document.getElementById('note-input');
  if (textarea) {
    textarea.focus();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

function renderMentionBadge() {
  const badge = document.getElementById('note-mention-badge');
  if (!badge) return;
  if (currentMention) {
    const sec = currentMention.section ? ` · ${currentMention.section}` : '';
    badge.innerHTML = `
      <span class="mention-badge-text">@ ${currentMention.title}<span class="mention-badge-section">${sec}</span></span>
      <button class="mention-badge-clear" title="メンションを外す">✕</button>
    `;
    badge.classList.remove('hidden');
    badge.querySelector('.mention-badge-clear').addEventListener('click', () => {
      currentMention = null;
      renderMentionBadge();
    });
  } else {
    badge.innerHTML = '';
    badge.classList.add('hidden');
  }
}

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

  getRoles().forEach(({ key, icon }) => {
    const pill = document.createElement('span');
    pill.className = 'note-role-pill' + (selectedRoles.has(key) ? ' selected' : '');
    pill.textContent = icon;
    pill.dataset.label = key;
    pill.addEventListener('click', () => {
      if (selectedRoles.has(key)) selectedRoles.delete(key);
      else selectedRoles.add(key);
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
      <div id="note-mention-badge" class="note-mention-badge hidden"></div>
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
    const refPrefix = currentMention
      ? `ref: ${currentMention.title}${currentMention.section ? ` (${currentMention.section})` : ''}\n\n`
      : '';
    const body = refPrefix + text;
    const title = `[${selectedLabel}]${roleStr} ` + text.slice(0, 72) + (text.length > 72 ? '…' : '');

    try {
      const res = await fetch(GITHUB_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, body, labels: ['note'] }),
      });

      if (res.status === 401) {
        localStorage.removeItem(NOTE_TOKEN_KEY);
        renderTokenSetup();
        return;
      }
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

      const created = await res.json();

      document.getElementById('note-input').value = '';
      currentMention = null;
      renderMentionBadge();
      status.textContent = 'Saved.';
      status.className = 'note-status note-status--ok';

      // Optimistic update: prepend the new note immediately without waiting for a reload
      const list = document.getElementById('note-list');
      if (list) {
        const empty = list.querySelector('.note-list-empty');
        if (empty) list.innerHTML = '';
        list.prepend(buildNoteItem(created));
      }
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

// ── Issue title parsing / building ────────────────────────────────────────────

function parseTitleParts(title) {
  const brackets = [...title.matchAll(/\[(.+?)\]/g)].map(m => m[1]);
  const label = brackets[0] || '';
  const roles = brackets.slice(1);
  const text  = title.replace(/^(\[[^\]]+\])+\s*/, '');
  return { label, roles, text };
}

function buildTitle(label, roles, text) {
  const roleStr = roles.map(r => `[${r}]`).join('');
  return `[${label}]${roleStr} ${text}`;
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

// ── Edit dropdown ─────────────────────────────────────────────────────────────

let _activeDropdown = null;

function closeDropdown() {
  if (_activeDropdown) { _activeDropdown.remove(); _activeDropdown = null; }
}

document.addEventListener('click', closeDropdown);

function showDropdown(anchor, items, onSelect) {
  closeDropdown();
  const rect = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'note-edit-dropdown';
  el.style.top  = `${rect.bottom + window.scrollY + 4}px`;
  el.style.left = `${rect.left  + window.scrollX}px`;
  el.addEventListener('click', e => e.stopPropagation());
  items.forEach(({ label, value }) => {
    const row = document.createElement('div');
    row.className = 'note-edit-dropdown-item';
    row.textContent = label;
    row.addEventListener('click', () => { closeDropdown(); onSelect(value); });
    el.appendChild(row);
  });
  document.body.appendChild(el);
  _activeDropdown = el;
}

// ── Note item builder ─────────────────────────────────────────────────────────

function buildNoteItem(issue) {
  const date = new Date(issue.created_at);
  const dateLabel = date.toLocaleDateString('ja-JP', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const { label, roles, text } = parseTitleParts(issue.title);
  const roleIconMap = Object.fromEntries(getRoles().map(({ key, icon }) => [key, icon]));

  const item = document.createElement('div');
  item.className = 'note-item';

  // Optimistic update: replace this item in-place with updated issue data
  function replaceWith(newTitle) {
    const updated = { ...issue, title: newTitle };
    item.replaceWith(buildNoteItem(updated));
  }

  // ── Tags row ──────────────────────────────────────────────────────────────
  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'note-item-tags';

  // Label (click → change)
  if (label) {
    const tagSpan = document.createElement('span');
    tagSpan.className = 'note-item-tag';
    tagSpan.textContent = label;
    tagSpan.title = 'クリックでラベル変更';
    tagSpan.addEventListener('click', e => {
      e.stopPropagation();
      const options = getLabels()
        .filter(l => l !== label)
        .map(l => ({ label: l, value: l }));
      showDropdown(tagSpan, options, newLabel => {
        const newTitle = buildTitle(newLabel, roles, text);
        replaceWith(newTitle);  // instant DOM update
        updateIssue(issue.number, { title: newTitle }).catch(err => {
          console.error(err);
          replaceWith(issue.title);  // revert on failure
        });
      });
    });
    tagsDiv.appendChild(tagSpan);
  }

  // Roles (click → remove)
  roles.forEach(roleKey => {
    const roleSpan = document.createElement('span');
    roleSpan.className = 'note-item-role';
    roleSpan.title = `${roleKey}（クリックで削除）`;
    roleSpan.textContent = roleIconMap[roleKey] ?? roleKey;
    roleSpan.addEventListener('click', e => {
      e.stopPropagation();
      const newRoles = roles.filter(r => r !== roleKey);
      const newTitle = buildTitle(label, newRoles, text);
      replaceWith(newTitle);
      updateIssue(issue.number, { title: newTitle }).catch(err => {
        console.error(err);
        replaceWith(issue.title);
      });
    });
    tagsDiv.appendChild(roleSpan);
  });

  // Add role button
  const addBtn = document.createElement('button');
  addBtn.className = 'note-item-add-role';
  addBtn.textContent = '+';
  addBtn.title = 'ロールを追加';
  addBtn.addEventListener('click', e => {
    e.stopPropagation();
    const options = getRoles()
      .filter(r => !roles.includes(r.key))
      .map(r => ({ label: `${r.icon} ${r.key}`, value: r.key }));
    showDropdown(addBtn, options, roleKey => {
      const newTitle = buildTitle(label, [...roles, roleKey], text);
      replaceWith(newTitle);
      updateIssue(issue.number, { title: newTitle }).catch(err => {
        console.error(err);
        replaceWith(issue.title);
      });
    });
  });
  tagsDiv.appendChild(addBtn);

  item.appendChild(tagsDiv);

  // Body
  const body = document.createElement('p');
  body.className = 'note-item-body';
  body.innerHTML = escapeHtml(issue.body || issue.title);
  item.appendChild(body);

  // Date
  const dateSpan = document.createElement('span');
  dateSpan.className = 'note-item-date';
  dateSpan.textContent = dateLabel;
  item.appendChild(dateSpan);

  return item;
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

    list.innerHTML = '';
    issues.forEach(issue => list.appendChild(buildNoteItem(issue)));
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
  // Initialize note_roles in localStorage if not yet set, so pushSync includes it
  if (localStorage.getItem(NOTE_ROLES_KEY) === null) {
    localStorage.setItem(NOTE_ROLES_KEY, JSON.stringify(DEFAULT_ROLES));
  }
  if (getToken()) {
    renderNoteUI();
    loadNotes();
  } else {
    renderTokenSetup();
  }
}

initNote();
