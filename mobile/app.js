// ── Config ────────────────────────────────────────────────────────────────────
// Depends on: ../shared/github-client.js (getToken, esc), ../shared/notes-api.js
// (GITHUB_API, parseTitleParts, buildTitle, updateIssue, fetchRecentNotes),
// ../shared/note-labels.js (guessLabel, isBookLabel, isVideoLabel, templates),
// ../shared/sync-api.js (pullSync, pushSync)

// ── Tab navigation ────────────────────────────────────────────────────────────

const TAB_NAMES = ['form', 'notes', 'report'];
let currentTabIndex = 0;
let notesLoaded   = false;
let notesLoading  = false;
let reportLoaded  = false;

function switchTab(name) {
  const idx = TAB_NAMES.indexOf(name);
  if (idx === -1) return;

  const panels = document.querySelectorAll('.panel');
  panels.forEach((p, i) => {
    p.classList.remove('active', 'prev');
    if (i === idx) p.classList.add('active');
    else if (i < idx) p.classList.add('prev');
  });

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  currentTabIndex = idx;

  if (name === 'notes'  && !notesLoaded && !notesLoading) { loadNotes(); }
  if (name === 'report' && !reportLoaded) { reportLoaded = true; loadReport(); }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Swipe navigation ──────────────────────────────────────────────────────────

(function () {
  let startX = 0;

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 50) return;
    const next = dx < 0
      ? Math.min(currentTabIndex + 1, TAB_NAMES.length - 1)
      : Math.max(currentTabIndex - 1, 0);
    if (next !== currentTabIndex) switchTab(TAB_NAMES[next]);
  }, { passive: true });
})();

// ── Mention state ─────────────────────────────────────────────────────────────

let currentMention = null;

// guessLabel/isBookLabel/isVideoLabel/BOOKS_*/VIDEO_*/ALL_TEMPLATES come from
// ../shared/note-labels.js. getBookTemplate/getVideoTemplate stay local since
// this side also treats the Journal role as a Todo-template trigger and
// desktop's doesn't — not merged since it's unclear which is intended.

// ── Label-specific templates ──────────────────────────────────────────────────

function getBookTemplate() {
  return (selectedRoles.has('Todo') || selectedRoles.has('Journal'))
    ? BOOKS_TODO_TEMPLATE : BOOKS_DONE_TEMPLATE;
}

function getVideoTemplate() {
  return (selectedRoles.has('Todo') || selectedRoles.has('Journal'))
    ? VIDEO_TODO_TEMPLATE : VIDEO_DONE_TEMPLATE;
}

function updateNoteTemplate() {
  const textarea = document.getElementById('note-input');
  if (!textarea) return;
  if (isBookLabel(selectedLabel)) {
    const tpl = getBookTemplate();
    if (!textarea.value.trim() || ALL_TEMPLATES.includes(textarea.value)) textarea.value = tpl;
  } else if (isVideoLabel(selectedLabel)) {
    const tpl = getVideoTemplate();
    if (!textarea.value.trim() || ALL_TEMPLATES.includes(textarea.value)) textarea.value = tpl;
  } else {
    if (ALL_TEMPLATES.includes(textarea.value)) textarea.value = '';
  }
}

// Select a label pill in the form UI by label name
function selectLabelPill(name) {
  selectedLabel = name;
  const labelRow = document.getElementById('label-row');
  if (!labelRow) {
    console.debug('[mobile-note] selectLabelPill: label-row not found, selectedLabel set to', name);
    return;
  }
  labelRow.querySelectorAll('.label-pill').forEach(p => {
    p.classList.toggle('selected', p.textContent.trim() === name);
  });
}

function setMention(item) {
  currentMention = item;
  renderMentionBadge();
  // sourceLabel > departmentKey > section name (departmentKey maps report department to its label)
  const labelCandidate = item.sourceLabel || item.departmentKey || item.section;
  const matched = guessLabel(labelCandidate);
  if (matched) {
    selectLabelPill(matched);
  }
}

function renderMentionBadge() {
  const badge = document.getElementById('mention-badge');
  if (!badge) return;
  if (currentMention) {
    const displaySec = currentMention.sourceLabel || currentMention.section;
    const sec = displaySec ? ` · ${displaySec}` : '';
    badge.classList.remove('hidden');
    badge.querySelector('.mention-badge-text').textContent = `@ ${currentMention.title}`;
    badge.querySelector('.mention-badge-section').textContent = sec;
  } else {
    badge.classList.add('hidden');
  }
}

// ── Token setup ───────────────────────────────────────────────────────────────

function renderTokenSetup() {
  const c = document.getElementById('form-container');
  c.innerHTML = `
    <div class="token-setup">
      <p>GitHub Personal Access Token (fine-grained PAT) を入力してください。<br>トークンはこのブラウザのlocalStorageにのみ保存されます。</p>
      <input type="password" id="token-input" class="token-input" placeholder="ghp_xxxxxxxxxxxx" />
      <button class="submit-btn" id="token-save">保存</button>
    </div>
  `;
  document.getElementById('token-save').addEventListener('click', () => {
    const val = document.getElementById('token-input').value.trim();
    if (!val) return;
    localStorage.setItem('NOTE_TOKEN', val);
    init();
  });
}

// ── Form ──────────────────────────────────────────────────────────────────────

let selectedLabel = null;
const selectedRoles = new Set();

function renderForm() {
  const c = document.getElementById('form-container');
  const labels = getLabels();
  const roles  = getRoles();

  if (!selectedLabel && labels.length) {
    // Use location-based default if available (set by location.js), else fall back to first label
    const locDefault = window.defaultLabelForZone;
    selectedLabel = (locDefault && labels.includes(locDefault)) ? locDefault : labels[0];
  }

  c.innerHTML = `
    <form class="note-form" id="note-form" autocomplete="off">

      <div>
        <p class="section-title">Label</p>
        <div class="label-row" id="label-row"></div>
      </div>

      <div>
        <p class="section-title">Role</p>
        <div class="role-row" id="role-row"></div>
      </div>

      <div id="mention-badge" class="mention-badge hidden">
        <span class="mention-badge-text"></span><span class="mention-badge-section"></span>
        <button type="button" class="mention-clear">✕</button>
      </div>

      <textarea id="note-input" class="note-textarea" placeholder="Write a note, task, or idea" rows="5"></textarea>

      <button type="submit" class="submit-btn">Save</button>
      <p id="form-status" class="form-status"></p>

    </form>
  `;

  // Labels
  const labelRow = document.getElementById('label-row');

  function addLabelPill(l) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'label-pill' + (l === selectedLabel ? ' selected' : '');
    pill.textContent = l;
    pill.addEventListener('click', () => {
      selectedLabel = l;
      labelRow.querySelectorAll('.label-pill').forEach(p => p.classList.toggle('selected', p.textContent === l));
      updateNoteTemplate();
    });
    labelRow.appendChild(pill);
  }

  labels.forEach(l => addLabelPill(l));

  // Roles
  const roleRow = document.getElementById('role-row');
  roles.forEach(({ key, icon }) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'role-pill' + (selectedRoles.has(key) ? ' selected' : '');
    pill.textContent = icon;
    pill.dataset.label = key;
    pill.addEventListener('click', () => {
      if (selectedRoles.has(key)) {
        selectedRoles.delete(key);
        pill.classList.remove('selected');
      } else {
        selectedRoles.clear();
        roleRow.querySelectorAll('.role-pill').forEach(p => p.classList.remove('selected'));
        selectedRoles.add(key);
        pill.classList.add('selected');
      }
      updateNoteTemplate();
    });
    roleRow.appendChild(pill);
  });

  // Mention clear
  document.getElementById('mention-badge').querySelector('.mention-clear').addEventListener('click', () => {
    currentMention = null;
    renderMentionBadge();
  });

  renderMentionBadge();

  // Submit
  document.getElementById('note-form').addEventListener('submit', async e => {
    e.preventDefault();
    const text   = document.getElementById('note-input').value.trim();
    const status = document.getElementById('form-status');
    if ((!text && !selectedRoles.has('Done')) || !selectedLabel) return;

    const btn = document.querySelector('.submit-btn');
    btn.disabled = true;
    status.textContent = 'Saving...';
    status.className = 'form-status';

    const roleStr  = [...selectedRoles].map(r => `[${r}]`).join('');
    const refLine  = currentMention ? (() => {
      // Strip both "(#NNN)" and "(#NNN, label_key)" suffixes from the title
      const cleanTitle = currentMention.title.replace(/\s*\(#\d+(?:,\s*[^)]+)?\)$/, '');
      const num = currentMention.number != null ? `#${currentMention.number} ` : '';
      const displaySec = currentMention.sourceLabel || currentMention.section;
      const sec = displaySec ? ` (${displaySec})` : '';
      return `ref: ${num}${cleanTitle}${sec}\n\n`;
    })() : '';
    const body  = refLine + text;
    const title = `[${selectedLabel}]${roleStr}`;

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
      if (res.status === 401) { localStorage.removeItem('NOTE_TOKEN'); renderTokenSetup(); return; }
      if (!res.ok) throw new Error(`${res.status}`);

      document.getElementById('note-input').value = '';
      selectedRoles.clear();
      currentMention = null;
      renderMentionBadge();
      roleRow.querySelectorAll('.role-pill').forEach(p => p.classList.remove('selected'));
      status.textContent = 'Saved ✓';
      status.className = 'form-status ok';
      notesLoaded = false; // force reload next time
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.className = 'form-status err';
    } finally {
      btn.disabled = false;
      setTimeout(() => { const s = document.getElementById('form-status'); if (s) { s.textContent = ''; s.className = 'form-status'; } }, 4000);
    }
  });
}

// ── Notes list ────────────────────────────────────────────────────────────────

// esc() (HTML-escape only) comes from ../shared/github-client.js; this adds the
// newline→<br> conversion needed when rendering an issue body as HTML.
function esc2(str) {
  return esc(str).replace(/\n/g, '<br>');
}

// parseTitleParts/buildTitle/updateIssue come from ../shared/notes-api.js

let _dropdown = null;
function closeDropdown() { if (_dropdown) { _dropdown.remove(); _dropdown = null; } }
document.addEventListener('click', closeDropdown);

function showDropdown(anchor, options, onSelect) {
  closeDropdown();
  const rect = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'edit-dropdown';
  const top = rect.bottom + 6;
  el.style.top  = `${Math.min(top, window.innerHeight - 200)}px`;
  el.style.left = `${Math.max(8, rect.left)}px`;
  el.addEventListener('click', e => e.stopPropagation());
  options.forEach(({ label, value }) => {
    const row = document.createElement('div');
    row.className = 'edit-dropdown-item';
    row.textContent = label;
    row.addEventListener('click', () => { closeDropdown(); onSelect(value); });
    el.appendChild(row);
  });
  document.body.appendChild(el);
  _dropdown = el;
}

function buildNoteItem(issue) {
  const date = new Date(issue.created_at).toLocaleDateString('ja-JP', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const { label, roles } = parseTitleParts(issue.title);
  const roleIconMap = Object.fromEntries(getRoles().map(({ key, icon }) => [key, icon]));

  const item = document.createElement('div');
  item.className = 'note-item';

  function replaceWith(newTitle) {
    item.replaceWith(buildNoteItem({ ...issue, title: newTitle }));
  }

  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'note-item-tags';

  if (label) {
    const tag = document.createElement('span');
    tag.className = 'note-item-tag';
    tag.textContent = label;
    tag.addEventListener('click', e => {
      e.stopPropagation();
      const opts = getLabels().filter(l => l !== label).map(l => ({ label: l, value: l }));
      showDropdown(tag, opts, newLabel => {
        const t = buildTitle(newLabel, roles);
        replaceWith(t);
        updateIssue(issue.number, { title: t }).catch(() => replaceWith(issue.title));
      });
    });
    tagsDiv.appendChild(tag);
  }

  roles.forEach(roleKey => {
    const span = document.createElement('span');
    span.className = 'note-item-role';
    span.textContent = roleIconMap[roleKey] ?? roleKey;
    span.title = roleKey;
    span.addEventListener('click', e => {
      e.stopPropagation();
      const t = buildTitle(label, roles.filter(r => r !== roleKey));
      replaceWith(t);
      updateIssue(issue.number, { title: t }).catch(() => replaceWith(issue.title));
    });
    tagsDiv.appendChild(span);
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
        const t = buildTitle(label, [roleKey]);
        replaceWith(t);
        updateIssue(issue.number, { title: t }).catch(() => replaceWith(issue.title));
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
    const bodyLines = (issue.body || '').split('\n').filter(l => l.trim());
    const displayText = bodyLines[0] || issue.title;
    setMention({ title: displayText, section: label, number: issue.number });
    switchTab('form');
  });
  tagsDiv.appendChild(mentionBtn);

  item.appendChild(tagsDiv);

  const body = document.createElement('p');
  body.className = 'note-item-body';
  body.innerHTML = esc2(issue.body || issue.title);
  item.appendChild(body);

  const dateSpan = document.createElement('span');
  dateSpan.className = 'note-item-date';
  dateSpan.textContent = date;
  item.appendChild(dateSpan);

  return item;
}

const NOTES_CACHE_KEY = 'mobile_notes_cache';

function renderNoteItems(c, issues) {
  c.innerHTML = '';
  if (!issues.length) { c.innerHTML = '<p class="placeholder">No notes yet</p>'; return; }
  issues.forEach(issue => c.appendChild(buildNoteItem(issue)));
}

async function loadNotes() {
  notesLoading = true;
  const c = document.getElementById('notes-container');

  // Show cached notes immediately (even stale) while fetching fresh data
  let hasCached = false;
  try {
    const cached = JSON.parse(localStorage.getItem(NOTES_CACHE_KEY));
    if (cached && cached.items) {
      renderNoteItems(c, cached.items);
      hasCached = true;
    }
  } catch (_) {}

  if (!hasCached) c.innerHTML = '<p class="placeholder">Loading...</p>';

  try {
    const issues = await fetchRecentNotes();
    localStorage.setItem(NOTES_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: issues }));
    renderNoteItems(c, issues);
    notesLoaded  = true;
    notesLoading = false;
  } catch (err) {
    notesLoading = false;
    if (!hasCached) c.innerHTML = `<p class="error-msg">読み込み失敗: ${err.message}</p>`;
  }
}

// ── Notes refresh button ──────────────────────────────────────────────────────

document.getElementById('notes-refresh-btn').addEventListener('click', () => {
  if (notesLoading) return;
  const btn = document.getElementById('notes-refresh-btn');
  btn.classList.add('spinning');
  notesLoaded = false;
  loadNotes().finally(() => btn.classList.remove('spinning'));
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  if (!getToken()) { renderTokenSetup(); return; }
  pullSync(); // fire and forget (roles only now) — form renders without waiting for it
  await fetchDepartmentLabels();  // populate getLabels()'s cache before the first render
  renderForm();
  // Preload notes and report in the background so tabs open instantly
  loadNotes();
  reportLoaded = true; // prevent switchTab from triggering a second load
  loadReport();
}

init();
