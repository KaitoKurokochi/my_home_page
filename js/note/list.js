// ── Note item builder ─────────────────────────────────────────────────────────

// Fills the compose form with this note so the submit handler PATCHes it (via
// window._editingIssueNumber/_editingItem) instead of POSTing a new one.
function loadNoteIntoEditor(issue, item, label, roles, bodyText) {
  const textarea = document.getElementById('note-input');
  if (!textarea) return;
  textarea.value = bodyText;
  if (label) {
    selectedLabel = label;
    renderLabelBar();
  }
  selectedRoles.clear();
  roles.forEach(r => selectedRoles.add(r));
  renderRoleBar();
  window._editingIssueNumber = issue.number;
  window._editingItem = item;
  textarea.focus();
  textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// The note text, collapsed to a preview when long, plus its Show more/less toggle
// (returned only when collapsing applies). Returns the elements to append, in order.
function buildCollapsibleBody(displayText) {
  const COLLAPSE_CHARS = 100;
  const COLLAPSE_LINES = 3;
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
  bodyWrap.appendChild(body);
  if (!needsCollapse) return [bodyWrap];

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
  return [bodyWrap, toggleBtn];
}

function buildNoteItem(issue) {
  const date = new Date(issue.created_at);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const dateLabel = isToday
    ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const { label, roles } = parseTitleParts(issue.title);
  const roleIconMap = Object.fromEntries(getRoles().map(({ key, icon }) => [key, icon]));
  const bodyText = issue.body || '';
  const bodyLines = bodyText.split('\n').filter(l => l.trim());
  const displayText = bodyLines.join('\n') || '';

  const item = document.createElement('div');
  item.className = 'note-item';

  function replaceWith(newTitle) {
    const updated = { ...issue, title: newTitle };
    item.replaceWith(buildNoteItem(updated));
  }

  // ── Tags row ──────────────────────────────────────────────────────────────
  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'note-item-tags';

  if (label) {
    const tagSpan = document.createElement('span');
    tagSpan.className = 'note-item-tag';
    tagSpan.textContent = label;
    tagSpan.title = 'クリックでラベル変更';
    tagSpan.addEventListener('click', e => {
      e.stopPropagation();
      const options = getLabels()
        .filter(l => departmentKeyForLabel(l) !== departmentKeyForLabel(label))
        .map(l => ({ label: l, value: l }));
      showDropdown(tagSpan, options, newLabel => {
        const newTitle = buildTitle(newLabel, roles);
        changeIssueTitleOptimistically(issue, newTitle, replaceWith);
      });
    });
    tagsDiv.appendChild(tagSpan);
  }

  roles.forEach(roleKey => {
    const roleSpan = document.createElement('span');
    roleSpan.className = 'note-item-role';
    roleSpan.title = `${roleKey}（クリックで削除）`;
    roleSpan.textContent = roleIconMap[roleKey] ?? roleKey;
    roleSpan.addEventListener('click', e => {
      e.stopPropagation();
      const newRoles = roles.filter(r => r !== roleKey);
      const newTitle = buildTitle(label, newRoles);
      changeIssueTitleOptimistically(issue, newTitle, replaceWith);
    });
    tagsDiv.appendChild(roleSpan);
  });

  if (roles.length === 0) {
    const addRoleBtn = document.createElement('button');
    addRoleBtn.className = 'note-item-add-role';
    addRoleBtn.textContent = '+';
    addRoleBtn.title = 'ロールを追加';
    addRoleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const options = getRoles().map(({ key, icon }) => ({ label: `${icon} ${key}`, value: key }));
      showDropdown(addRoleBtn, options, roleKey => {
        const newTitle = buildTitle(label, [roleKey]);
        changeIssueTitleOptimistically(issue, newTitle, replaceWith);
      });
    });
    tagsDiv.appendChild(addRoleBtn);
  }

  const mentionBtn = document.createElement('button');
  mentionBtn.className = 'note-item-mention-btn';
  mentionBtn.textContent = '@';
  mentionBtn.title = 'このノートをメンション';
  mentionBtn.addEventListener('click', e => {
    e.stopPropagation();
    window.setMention({ title: displayText, section: label, number: issue.number });
  });
  tagsDiv.appendChild(mentionBtn);

  const dateSpan = document.createElement('span');
  dateSpan.className = 'note-item-date';
  dateSpan.textContent = dateLabel;
  tagsDiv.appendChild(dateSpan);

  const menuBtn = document.createElement('button');
  menuBtn.className = 'note-item-menu-btn';
  menuBtn.textContent = '⋮';
  menuBtn.title = 'メニュー';
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    showDropdown(menuBtn, [
      { label: '✏ Edit', value: 'edit' },
      { label: '🗑 Delete', value: 'delete', danger: true },
    ], action => {
      if (action === 'delete') {
        if (!confirm('このノートを削除しますか？')) return;
        updateIssue(issue.number, { state: 'closed' })
          .then(() => item.remove())
          .catch(err => console.error('Delete failed:', err));
      } else if (action === 'edit') {
        loadNoteIntoEditor(issue, item, label, roles, bodyText);
      }
    });
  });
  tagsDiv.appendChild(menuBtn);

  item.appendChild(tagsDiv);

  buildCollapsibleBody(displayText).forEach(el => item.appendChild(el));

  return item;
}

// ── Load recent notes ─────────────────────────────────────────────────────────

async function loadNotes() {
  const list = document.getElementById('note-list');
  if (!list) return;
  list.innerHTML = '<p class="note-list-loading">Loading...</p>';

  try {
    const issues = await fetchRecentNotes();

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
