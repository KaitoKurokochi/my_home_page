// ── Config ────────────────────────────────────────────────────────────────────
// Depends on: js/config.js (GITHUB_OWNER, NOTES_REPO, getToken, esc)
// Token is stored in localStorage (never in the codebase).
// To set it, open DevTools console and run:
//   localStorage.setItem('NOTE_TOKEN', 'ghp_xxxxxxxxxxxx')

const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${NOTES_REPO}/issues`;

const NOTE_TOKEN_KEY  = 'NOTE_TOKEN';
const NOTE_LABELS_KEY = 'note_labels';
const NOTE_ROLES_KEY  = 'note_roles';
const DEFAULT_LABELS  = ['Lions_IS', 'Entertainment', 'Research', 'living'];
const DEFAULT_ROLES   = [
  { key: 'Memo',        icon: '📝' },
  { key: 'Todo',        icon: '🔔' },
  { key: 'Idea',        icon: '💡' },
  { key: 'Want to do',  icon: '⭐' },
  { key: 'Question',    icon: '❓' },
  { key: 'Done',        icon: '✅' },
];

// getToken() is defined in js/config.js
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
let currentMention = null;  // { title, section, number }

function guessLabel(section) {
  if (!section) return null;
  const labels = getLabels();
  if (labels.includes(section)) return section;
  // Strip non-alphanumeric chars (emoji, spaces, underscores) and compare case-insensitively.
  // e.g. "🔬 Research"→"research", "🦁 Lions IS"→"lionsis", "Lions_IS"→"lionsis" all match.
  const norm = s => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return labels.find(l => norm(l) === norm(section)) || null;
}

// Called from status.js or note list when user clicks [@] on an item
window.setMention = function(item) {
  currentMention = item;
  renderMentionBadge();
  // sourceLabel (from "(#NNN, label_key)" in Others section) takes priority over section name
  const labelCandidate = item.sourceLabel || item.section;
  const matched = guessLabel(labelCandidate);
  if (matched) {
    selectedLabel = matched;
    renderLabelBar();
  }
  const textarea = document.getElementById('note-input');
  if (textarea) {
    textarea.focus();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  // Show cancel button when mention is active
  const cancelBtn = document.getElementById('note-cancel');
  if (cancelBtn) cancelBtn.classList.remove('hidden');
};

function renderMentionBadge() {
  const badge = document.getElementById('note-mention-badge');
  if (!badge) return;
  if (currentMention) {
    const displaySec = currentMention.sourceLabel || currentMention.section;
    const sec = displaySec ? ` · ${displaySec}` : '';
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
      if (selectedRoles.has(key)) {
        selectedRoles.delete(key);
      } else {
        selectedRoles.clear();
        selectedRoles.add(key);
      }
      renderRoleBar();
    });
    bar.appendChild(pill);
  });
}

// ── Note UI ───────────────────────────────────────────────────────────────────

function resetForm() {
  const textarea = document.getElementById('note-input');
  const cancelBtn = document.getElementById('note-cancel');
  if (textarea) textarea.value = '';
  if (cancelBtn) cancelBtn.classList.add('hidden');
  selectedRoles.clear();
  renderRoleBar();
  currentMention = null;
  renderMentionBadge();
}

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
        <button type="button" id="note-cancel" class="note-cancel hidden">取り消し</button>
        <button type="submit" class="note-submit">Save</button>
      </div>
    </form>
    <div id="note-list" class="note-list"></div>
  `;

  // Default selection: determined by location zone; fall back to 'general'.
  if (!selectedLabel) selectedLabel = defaultLabelForZone(window.currentZone);
  renderLabelBar();
  renderRoleBar();

  // Show/hide cancel button based on textarea content
  document.getElementById('note-input').addEventListener('input', () => {
    const cancelBtn = document.getElementById('note-cancel');
    if (!cancelBtn) return;
    if (document.getElementById('note-input').value.trim()) {
      cancelBtn.classList.remove('hidden');
    } else {
      cancelBtn.classList.add('hidden');
    }
  });

  document.getElementById('note-cancel').addEventListener('click', () => {
    resetForm();
  });

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
    const refPrefix = currentMention ? (() => {
      // Strip both "(#NNN)" and "(#NNN, label_key)" suffixes from the title
      const cleanTitle = currentMention.title.replace(/\s*\(#\d+(?:,\s*[^)]+)?\)$/, '');
      const num = currentMention.number != null ? `#${currentMention.number} ` : '';
      const displaySec = currentMention.sourceLabel || currentMention.section;
      const sec = displaySec ? ` (${displaySec})` : '';
      return `ref: ${num}${cleanTitle}${sec}\n\n`;
    })() : '';
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

      resetForm();
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
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const dateLabel = isToday
    ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  // Add role button (shown only when no roles are set)
  if (roles.length === 0) {
    const addRoleBtn = document.createElement('button');
    addRoleBtn.className = 'note-item-add-role';
    addRoleBtn.textContent = '+';
    addRoleBtn.title = 'ロールを追加';
    addRoleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const options = getRoles().map(({ key, icon }) => ({ label: `${icon} ${key}`, value: key }));
      showDropdown(addRoleBtn, options, roleKey => {
        const newTitle = buildTitle(label, [roleKey], text);
        replaceWith(newTitle);
        updateIssue(issue.number, { title: newTitle }).catch(err => {
          console.error(err);
          replaceWith(issue.title);
        });
      });
    });
    tagsDiv.appendChild(addRoleBtn);
  }

  // Mention button
  const mentionBtn = document.createElement('button');
  mentionBtn.className = 'note-item-mention-btn';
  mentionBtn.textContent = '@';
  mentionBtn.title = 'このノートをメンション';
  mentionBtn.addEventListener('click', e => {
    e.stopPropagation();
    window.setMention({ title: text, section: label, number: issue.number });
  });
  tagsDiv.appendChild(mentionBtn);

  const dateSpan = document.createElement('span');
  dateSpan.className = 'note-item-date';
  dateSpan.textContent = dateLabel;
  tagsDiv.appendChild(dateSpan);

  item.appendChild(tagsDiv);

  // Body (collapse + edit)
  const COLLAPSE_CHARS = 100;
  const COLLAPSE_LINES = 3;
  const bodyText = issue.body || '';
  const displayText = bodyText || text;
  const lines = displayText.split('\n');
  const needsCollapse = displayText.length > COLLAPSE_CHARS || lines.length > COLLAPSE_LINES;
  let collapsed = needsCollapse;

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'note-item-body-wrap';

  const body = document.createElement('p');
  body.className = 'note-item-body';
  function setBodyText() {
    if (collapsed) {
      const preview = lines.slice(0, COLLAPSE_LINES).join('\n');
      body.textContent = (preview.length > COLLAPSE_CHARS ? preview.slice(0, COLLAPSE_CHARS) : preview) + '…';
      body.classList.add('is-collapsed');
    } else {
      body.textContent = displayText;
      body.classList.remove('is-collapsed');
    }
  }
  setBodyText();

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'note-item-edit-btn';
  editBtn.title = 'Edit';
  editBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    const ta = document.createElement('textarea');
    ta.className = 'note-item-edit-textarea';
    ta.value = bodyText;
    ta.rows = Math.max(3, lines.length + 1);
    bodyWrap.replaceChild(ta, body);
    editBtn.style.display = 'none';
    ta.focus();

    function save() {
      const newBody = ta.value;
      bodyWrap.replaceChild(body, ta);
      editBtn.style.display = '';
      if (newBody === bodyText) return;
      body.textContent = newBody;
      updateIssue(issue.number, { body: newBody })
        .then(updated => item.replaceWith(buildNoteItem(updated)))
        .catch(err => { console.error(err); setBodyText(); });
    }

    ta.addEventListener('blur', save);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Escape') { bodyWrap.replaceChild(body, ta); editBtn.style.display = ''; }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { ta.blur(); }
    });
  });

  bodyWrap.appendChild(body);
  bodyWrap.appendChild(editBtn);
  item.appendChild(bodyWrap);

  if (needsCollapse) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'note-item-toggle';
    toggleBtn.innerHTML = 'Show more <span class="note-item-toggle-chevron">▾</span>';
    toggleBtn.addEventListener('click', () => {
      collapsed = !collapsed;
      setBodyText();
      toggleBtn.innerHTML = collapsed
        ? 'Show more <span class="note-item-toggle-chevron">▾</span>'
        : 'Show less <span class="note-item-toggle-chevron rotated">▾</span>';
    });
    item.appendChild(toggleBtn);
  }


  return item;
}

// ── Load recent notes ─────────────────────────────────────────────────────────

async function loadNotes() {
  const list = document.getElementById('note-list');
  if (!list) return;
  list.innerHTML = '<p class="note-list-loading">Loading...</p>';

  try {
    const res = await fetch(
      `${GITHUB_API}?labels=note&state=all&per_page=20&sort=created&direction=desc`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Accept': 'application/vnd.github+json',
        },
      }
    );
    if (!res.ok) throw new Error(`${res.status}`);
    const allIssues = await res.json();

    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const issues = allIssues
      .filter(i => new Date(i.created_at).getTime() >= cutoff)
      .slice(0, 10);

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

// ── Location-based default label ─────────────────────────────────────────────

// Maps location zone name → default note label.
// Zone names come from location_zones.json (zone.name field).
const ZONE_DEFAULT_LABEL = {
  univ:     'Research',
  home:     'living',
  lions_is: 'Lions_IS',
};

// Returns the default label for the given zone name.
// Returns null when zoneName is unknown (location not yet resolved) so no label
// is pre-selected until GPS zone is confirmed via window.onLocationReady().
function defaultLabelForZone(zoneName) {
  if (!zoneName) return null;
  const labels = getLabels();
  const candidate = ZONE_DEFAULT_LABEL[zoneName];
  if (!candidate) return null; // unknown zone — wait for location
  // Verify the candidate is actually in the label list (may have been renamed)
  if (labels.includes(candidate)) return candidate;
  // Fall back to general if present
  if (labels.includes('general')) return 'general';
  return null;
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

// Register location-ready hook to update default label when GPS zone is confirmed.
// Wraps any previously registered window.onLocationReady (e.g. from status.js)
// so both callbacks fire.
(function registerLocationHook() {
  const prev = window.onLocationReady;
  window.onLocationReady = function () {
    // Update default label only if user has not manually selected one this session.
    // selectedLabel may already be set by user interaction; we only override the
    // initial default (i.e. when it equals the old fallback or a previous zone default).
    const autoDefaults = new Set(Object.values(ZONE_DEFAULT_LABEL).concat(['general']));
    if (selectedLabel === null || autoDefaults.has(selectedLabel)) {
      const newDefault = defaultLabelForZone(window.currentZone);
      if (newDefault && newDefault !== selectedLabel) {
        selectedLabel = newDefault;
        renderLabelBar();
      }
    }
    if (typeof prev === 'function') prev();
  };
})();

setInterval(() => { if (getToken()) loadNotes(); }, 10 * 60 * 1000);
