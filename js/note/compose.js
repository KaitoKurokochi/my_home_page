// ── Label bar ─────────────────────────────────────────────────────────────────

let selectedLabel = null;
const selectedRoles = new Set();
let currentMention = null;  // { title, section, number }

// Called from status.js or note list when user clicks [@] on an item
window.setMention = function(item) {
  currentMention = item;
  renderMentionBadge();
  // sourceLabel > departmentKey > section name (departmentKey fixes display-name/label mismatches like "University" vs "univ")
  const labelCandidate = item.sourceLabel || item.departmentKey || item.section;
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

  labels.forEach((name) => {
    const pill = document.createElement('span');
    pill.className = 'note-label-pill' + (name === selectedLabel ? ' selected' : '');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'note-label-name';
    nameSpan.textContent = name;
    nameSpan.addEventListener('click', () => {
      selectedLabel = name;
      renderLabelBar();
    });

    pill.appendChild(nameSpan);
    bar.appendChild(pill);
  });

  updateNoteTemplate();
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
  updateNoteTemplate();
}

// ── Label-specific templates ──────────────────────────────────────────────────
// isBookLabel/isVideoLabel/BOOKS_*/VIDEO_*/ALL_TEMPLATES come from
// shared/note-labels.js. getBookTemplate/getVideoTemplate stay local since
// mobile's version also treats the Journal role as a Todo-template trigger
// and desktop's doesn't — not merged since it's unclear which is intended.

function getBookTemplate() {
  return (selectedRoles.has('Todo'))
    ? BOOKS_TODO_TEMPLATE : BOOKS_DONE_TEMPLATE;
}

function getVideoTemplate() {
  return (selectedRoles.has('Todo'))
    ? VIDEO_TODO_TEMPLATE : VIDEO_DONE_TEMPLATE;
}

// Inserts or swaps the appropriate template in the textarea based on the
// current label and role.  Only acts when the textarea is empty or still holds
// an unmodified template (i.e. the user hasn't started typing yet).
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

  // Default selection: determined by location zone; fall back to 'general'.
  if (!selectedLabel) selectedLabel = defaultLabelForZone(window.currentZone);
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
    if (!text && !selectedRoles.has('Done')) return;

    status.textContent = 'Saving...';
    status.className = 'note-status';

    const newTitle = buildTitle(selectedLabel, [...selectedRoles]);

    // ── Edit mode: PATCH existing issue ──────────────────────────────────────
    if (window._editingIssueNumber) {
      const editNum = window._editingIssueNumber;
      const editItem = window._editingItem;
      window._editingIssueNumber = null;
      window._editingItem = null;
      try {
        const updated = await updateIssue(editNum, { title: newTitle, body: text });
        document.getElementById('note-input').value = '';
        selectedRoles.clear();
        renderRoleBar();
        status.textContent = 'Updated.';
        status.className = 'note-status note-status--ok';
        if (editItem && editItem.parentNode) editItem.replaceWith(buildNoteItem(updated));
      } catch (err) {
        status.textContent = `Failed: ${err.message}`;
        status.className = 'note-status note-status--err';
      }
      setTimeout(() => {
        const s = document.getElementById('note-status');
        if (s) { s.textContent = ''; s.className = 'note-status'; }
      }, 4000);
      return;
    }

    // ── Create mode: POST new issue ───────────────────────────────────────────
    const refPrefix = currentMention ? (() => {
      // Strip both "(#NNN)" and "(#NNN, label_key)" suffixes from the title.
      // No label/section suffix here (unlike the mention badge) — agent-scripts'
      // github_issues.py matches this line against the original status.md text
      // verbatim when there's no issue number to key off of, so anything appended
      // here would break that match (see status.md/history.md 2026-09-30).
      const cleanTitle = currentMention.title.replace(/\s*\(#\d+(?:,\s*[^)]+)?\)$/, '');
      const num = currentMention.number != null ? `#${currentMention.number} ` : '';
      return `ref: ${num}${cleanTitle}\n\n`;
    })() : '';
    const body = refPrefix + text;

    try {
      const res = await fetch(GITHUB_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newTitle, body, labels: ['note'] }),
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

// parseTitleParts/buildTitle/updateIssue come from shared/notes-api.js
