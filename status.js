// ── Status: calendar widget (top-bar) + report (left-col) ────────────────────

const NOTES_OWNER = 'KaitoKurokochi';
const NOTES_REPO  = 'my_notes';

function notesToken() {
  return localStorage.getItem('NOTE_TOKEN') || '';
}

async function fetchMyNotesFile(path) {
  const token = notesToken();
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(
    `https://api.github.com/repos/${NOTES_OWNER}/${NOTES_REPO}/contents/${path}`,
    { headers }
  );
  if (!res.ok) throw new Error(`${res.status}`);
  const meta = await res.json();
  return decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))));
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Returns a stable key for an item: issue number if present, otherwise full text.
function itemKey(text) {
  const m = text.match(/\(#(\d+)(?:,\s*[^)]+)?\)/);
  return m ? '#' + m[1] : text;
}

// ── Calendar widget (top-bar) ─────────────────────────────────────────────────

async function renderCalWidget() {
  const widget = document.getElementById('cal-widget');
  if (!widget) return;

  const today = new Date();
  const dateLabel = today.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });

  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  let events = [];
  try {
    const raw = await fetchMyNotesFile('schedule.json');
    const sched = JSON.parse(raw);
    if (sched.date !== todayStr) {
      widget.innerHTML = `<button class="cal-summary">📅 ${dateLabel} <span class="cal-err">未取得</span></button>`;
      window.todayEvents = [];
      return;
    }
    events = sched.events || [];
    window.todayEvents = events;  // expose for meeting_note.js
  } catch (e) {
    widget.innerHTML = `<button class="cal-summary">📅 ${dateLabel} <span class="cal-err">–</span></button>`;
    window.todayEvents = [];
    return;
  }

  // ── Summary (pill) ──────────────────────────────────────────────────────────
  // Always render exactly 2 preview rows and 1 more-row so widget height is constant.
  const buildRow = (ev) =>
    `<span class="cal-preview-row"><span class="cal-preview-time">${esc(ev.allDay ? '終日' : ev.start)}</span><span class="cal-preview-title">${esc(ev.title)}</span></span>`;

  let row0, row1;
  if (events.length === 0) {
    row0 = `<span class="cal-preview-row"><span class="cal-preview-time"></span><span class="cal-preview-title">予定なし</span></span>`;
    row1 = `<span class="cal-preview-row" style="visibility:hidden"><span class="cal-preview-time"></span><span class="cal-preview-title">–</span></span>`;
  } else if (events.length === 1) {
    row0 = buildRow(events[0]);
    row1 = `<span class="cal-preview-row" style="visibility:hidden">${buildRow(events[0])}</span>`;
  } else {
    row0 = buildRow(events[0]);
    row1 = buildRow(events[1]);
  }

  const previewRows = row0 + row1;
  const more = events.length > 2
    ? `<span class="cal-more">+${events.length - 2}件</span>`
    : `<span class="cal-more" style="visibility:hidden">+0件</span>`;

  // ── List panel rows ─────────────────────────────────────────────────────────
  const detailRows = events.map((ev, i) => {
    const timeRange = ev.allDay ? '終日' : `${ev.start} – ${ev.end}`;
    return `<div class="cal-panel-event" data-event-index="${i}">
      <div class="cal-panel-time">${esc(timeRange)}</div>
      <div class="cal-panel-title">${esc(ev.title)}</div>
    </div>`;
  }).join('');

  const noEvents = !events.length ? '<div class="cal-panel-empty">今日の予定はありません</div>' : '';

  widget.innerHTML = `
    <button class="cal-summary" id="cal-summary">
      <span class="cal-date-label">${dateLabel}</span>
      <span class="cal-previews">${previewRows}${more}</span>
    </button>
    <div class="cal-panel hidden" id="cal-panel">
      <div class="cal-panel-header">${dateLabel}</div>
      ${detailRows}${noEvents}
    </div>
    <div class="cal-detail-panel hidden" id="cal-detail-panel">
      <button class="cal-detail-close" id="cal-detail-close" title="閉じる">✕</button>
      <div class="cal-detail-title" id="cal-detail-title"></div>
      <div class="cal-detail-time" id="cal-detail-time"></div>
      <div class="cal-detail-description" id="cal-detail-description"></div>
      <div class="cal-detail-location" id="cal-detail-location"></div>
    </div>`;

  // toggle list panel on summary click
  const btn        = document.getElementById('cal-summary');
  const panel      = document.getElementById('cal-panel');
  const detailPanel = document.getElementById('cal-detail-panel');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    // close detail panel when list panel closes
    if (panel.classList.contains('hidden')) {
      detailPanel.classList.add('hidden');
      panel.querySelectorAll('.cal-panel-event--active').forEach(el => el.classList.remove('cal-panel-event--active'));
    }
  });

  // Close both panels when clicking outside the widget
  document.addEventListener('click', (e) => {
    if (!widget.contains(e.target)) {
      panel.classList.add('hidden');
      detailPanel.classList.add('hidden');
      panel.querySelectorAll('.cal-panel-event--active').forEach(el => el.classList.remove('cal-panel-event--active'));
    }
  });

  // Close detail panel via close button
  document.getElementById('cal-detail-close').addEventListener('click', (e) => {
    e.stopPropagation();
    detailPanel.classList.add('hidden');
    panel.querySelectorAll('.cal-panel-event--active').forEach(el => el.classList.remove('cal-panel-event--active'));
  });

  // Event item click → show detail panel
  panel.querySelectorAll('.cal-panel-event[data-event-index]').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(row.dataset.eventIndex);
      const ev = events[idx];
      if (!ev) return;

      // Highlight selected row
      panel.querySelectorAll('.cal-panel-event--active').forEach(el => el.classList.remove('cal-panel-event--active'));
      row.classList.add('cal-panel-event--active');

      // Populate detail panel
      const timeRange = ev.allDay ? '終日' : `${ev.start} – ${ev.end}`;
      document.getElementById('cal-detail-title').textContent = ev.title || '';
      document.getElementById('cal-detail-time').textContent  = timeRange;

      const descEl = document.getElementById('cal-detail-description');
      if (ev.description) {
        descEl.textContent = ev.description;
        descEl.style.display = '';
      } else {
        descEl.textContent = '';
        descEl.style.display = 'none';
      }

      const locEl = document.getElementById('cal-detail-location');
      if (ev.location) {
        locEl.textContent = ev.location;
        locEl.style.display = '';
      } else {
        locEl.textContent = '';
        locEl.style.display = 'none';
      }

      // Position: to the right of the list panel; fall back to left if not enough space
      const panelRect  = panel.getBoundingClientRect();
      const widgetRect = widget.getBoundingClientRect();
      const spaceRight = window.innerWidth - panelRect.right;
      const detailW    = 300 + 8; // max-width + gap

      detailPanel.classList.remove('hidden');

      if (spaceRight >= detailW) {
        // Enough space on the right
        detailPanel.style.left = `${panel.offsetLeft + panel.offsetWidth + 8}px`;
        detailPanel.style.right = 'auto';
      } else {
        // Not enough space → show to the left of the list panel
        detailPanel.style.right = `${widget.offsetWidth - panel.offsetLeft + 8}px`;
        detailPanel.style.left = 'auto';
      }
      detailPanel.style.top = `${panel.offsetTop}px`;
    });
  });
}

// ── Report (left-col, above news) ─────────────────────────────────────────────

let mentionItems = [];  // shared with note.js via window

// Wraps each ## section (h2.mr-cat + its following sibling nodes up to the
// next h2) in a <div class="sr-section" data-key="KEY">.
// Adds a toggle arrow to the h2 and wires click-to-collapse behaviour.
// expandedKeys: Set of section keys to expand by default, or null = expand all.
function wrapSections(bodyEl, expandedKeys) {
  const children = Array.from(bodyEl.childNodes);
  let currentWrapper = null;

  for (const node of children) {
    const isH2 = node.nodeType === Node.ELEMENT_NODE && node.tagName === 'H2' && node.classList.contains('mr-cat');
    if (isH2) {
      // Derive a section key from the heading text (strip emoji + whitespace)
      const key = node.textContent.trim().replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim();
      currentWrapper = document.createElement('div');
      currentWrapper.className = 'sr-section';
      currentWrapper.dataset.key = key;
      bodyEl.insertBefore(currentWrapper, node);
      currentWrapper.appendChild(node);

      // Add arrow icon to h2
      const arrow = document.createElement('span');
      arrow.className = 'sr-arrow';
      arrow.textContent = '▼';
      node.appendChild(arrow);

      // Determine default state
      const shouldExpand = expandedKeys === null || expandedKeys.has(key);
      if (!shouldExpand) {
        currentWrapper.classList.add('collapsed');
      }

      // Click handler: toggle collapsed state (capture wrapper, not currentWrapper)
      const wrapper = currentWrapper;
      node.addEventListener('click', () => {
        wrapper.classList.toggle('collapsed');
      });
    } else if (currentWrapper) {
      // Wrap content nodes (all siblings after h2) in a body div
      if (!currentWrapper.querySelector('.sr-section-body')) {
        const body = document.createElement('div');
        body.className = 'sr-section-body';
        currentWrapper.appendChild(body);
      }
      currentWrapper.querySelector('.sr-section-body').appendChild(node);
    }
  }
}

// Applies location-based default expand/collapse state to sections.
// Calls detectExpandedSections() (async, from location_zones.js) and then
// re-applies the collapsed class to each sr-section wrapper.
async function applyLocationFilter(bodyEl) {
  if (typeof detectExpandedSections !== 'function') return;

  const expandedKeys = await detectExpandedSections();
  if (expandedKeys === null) return;  // fallback: all already expanded

  bodyEl.querySelectorAll('.sr-section').forEach(wrapper => {
    const key = wrapper.dataset.key || '';

    // Match: exact or substring
    let shouldExpand = false;
    for (const k of expandedKeys) {
      if (key === k || key.includes(k) || k.includes(key)) {
        shouldExpand = true;
        break;
      }
    }
    if (!shouldExpand) {
      wrapper.classList.add('collapsed');
    } else {
      wrapper.classList.remove('collapsed');
    }
  });
}

async function renderReport() {
  const el = document.getElementById('status-report');
  if (!el) return;

  try {
    const md = await fetchMyNotesFile('reports.md');
    mentionItems = [];
    const bodyEl = document.createElement('div');
    bodyEl.className = 'mr-body';
    bodyEl.innerHTML = markdownToHtml(md);
    el.innerHTML = '';
    el.appendChild(bodyEl);
    // Pass null initially (expand all); applyLocationFilter will re-collapse as needed.
    wrapSections(bodyEl, null);
    window.mentionItems = mentionItems;
    attachMentionButtons(el);
    attachRoutineItems(el);
    attachBulletToggles(el);
    // Apply location-based collapse asynchronously after render.
    // Also register a callback so app.js can re-trigger after fresh GPS fix.
    applyLocationFilter(bodyEl);
    window.onLocationReady = () => applyLocationFilter(bodyEl);
  } catch (e) {
    el.innerHTML = `<p class="mr-error">report: ${e.message}</p>`;
  }
}

// ── Routine done state (localStorage, reset daily) ───────────────────────────

function routineDoneKey() {
  const today = new Date();
  const d = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return `routineDone_${d}`;
}

function loadRoutineDone() {
  try {
    return JSON.parse(localStorage.getItem(routineDoneKey()) || '{}');
  } catch { return {}; }
}

function saveRoutineDone(state) {
  localStorage.setItem(routineDoneKey(), JSON.stringify(state));
}

function markdownToHtml(md) {
  const lines = md.split('\n');

  // ── Pass 1: parse into token objects ──────────────────────────────────────
  const tokens = [];
  for (const line of lines) {
    if (line.startsWith('#### ')) {
      tokens.push({ type: 'h4', text: line.slice(5).trim() });
    } else if (line.startsWith('### ')) {
      tokens.push({ type: 'h3', text: line.slice(4).trim() });
    } else if (line.startsWith('## ')) {
      tokens.push({ type: 'h2', text: line.slice(3).trim() });
    } else if (line.startsWith('# ')) {
      tokens.push({ type: 'h1', text: line.slice(2).trim() });
    } else if (line.startsWith('> ')) {
      tokens.push({ type: 'summary', text: line.slice(2).trim() });
    } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      tokens.push({ type: 'check', text: line.slice(6).trim(), checked: line.startsWith('- [x] ') });
    } else if (line.startsWith('- ')) {
      tokens.push({ type: 'item', text: line.slice(2).trim() });
    } else if (line.startsWith('・')) {
      tokens.push({ type: 'item', text: line.slice(1).trim() });
    } else if (line.startsWith('**') && line.endsWith('**')) {
      tokens.push({ type: 'subhead', text: line.replace(/\*\*/g, '').trim() });
    } else if (line.startsWith('  *')) {
      tokens.push({ type: 'detail', text: line.trim().replace(/\*/g, '') });
    } else if (line.startsWith('  `')) {
      tokens.push({ type: 'since', text: line.trim().replace(/`/g, '') });
    } else {
      tokens.push({ type: 'blank' });
    }
  }

  // ── Pass 2: skip heading tokens whose section has no content ─────────────
  // A heading (h2/h3) is "empty" if the next non-blank token is another heading or end-of-stream.
  const HEADING_TYPES = new Set(['h1', 'h2', 'h3', 'h4']);
  const CONTENT_TYPES = new Set(['summary', 'check', 'item', 'subhead', 'detail', 'since']);
  const skipIdx = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'h3' && t.type !== 'h4') continue;
    // look ahead for content before the next heading
    let hasContent = false;
    for (let j = i + 1; j < tokens.length; j++) {
      if (HEADING_TYPES.has(tokens[j].type)) break;
      if (CONTENT_TYPES.has(tokens[j].type)) { hasContent = true; break; }
    }
    if (!hasContent) skipIdx.add(i);
  }

  // ── Pass 3: render ────────────────────────────────────────────────────────
  let html = '';
  let currentLabel = '';         // current h2 label (Research, Lions_IS, etc.)
  let currentSection = '';      // current h3 sub-section text (Phase:, Questions, etc.)
  let itemIndex = 0;
  let inRoutine = false;

  // Helper: flush a pending item-list run
  function flushList(listItems) {
    if (!listItems.length) return '';
    const liHtml = listItems.map(li => li).join('');
    return `<ul class="mr-list">${liHtml}</ul>`;
  }

  // Helper: render a single item/check token as <li>
  function renderLi(t, section, isRoutine) {
    // Match "(#NNN)" (solo) or "(#NNN, label_key)" (Others section format)
    const numMatch = t.text.match(/\(#(\d+)(?:,\s*([^)]+))?\)$/);
    const number = numMatch ? parseInt(numMatch[1]) : null;
    // sourceLabel: explicit label from "(#NNN, label)" takes priority over section
    const sourceLabel = (numMatch && numMatch[2]) ? numMatch[2].trim() : null;
    mentionItems.push({ title: t.text, section, number, sourceLabel });
    const idx = itemIndex++;
    if (t.type === 'check') {
      return `<li class="mr-item${t.checked ? ' mr-item-done' : ''}" data-mention-index="${idx}"><span class="mr-bullet" data-item-key="${esc(itemKey(t.text))}">-</span>${esc(t.text)}</li>`;
    }
    if (isRoutine) {
      return `<li class="mr-item mr-routine-item" data-mention-index="${idx}" data-routine-key="${esc(t.text)}"><span class="mr-bullet" data-item-key="${esc(itemKey(t.text))}">-</span>${esc(t.text)}</li>`;
    }
    return `<li class="mr-item" data-mention-index="${idx}"><span class="mr-bullet" data-item-key="${esc(itemKey(t.text))}">-</span>${esc(t.text)}</li>`;
  }

  let pendingList = [];  // accumulates <li> strings for the current run

  for (let i = 0; i < tokens.length; i++) {
    if (skipIdx.has(i)) continue;
    const t = tokens[i];

    const isListToken = (t.type === 'item' || t.type === 'check');

    if (isListToken) {
      pendingList.push(renderLi(t, currentLabel || currentSection, inRoutine));
      continue;
    }

    // Flush any accumulated list before rendering non-list token
    if (pendingList.length) {
      html += flushList(pendingList);
      pendingList = [];
    }

    if (t.type === 'h4') {
      inRoutine = false;
      html += `<h5 class="mr-subcat">${esc(t.text)}</h5>`;
    } else if (t.type === 'h3') {
      inRoutine = false;
      currentSection = t.text;
      const isPhase = t.text.startsWith('Phase:');
      html += `<h4 class="${isPhase ? 'mr-phase' : 'mr-subcat'}">${esc(t.text)}</h4>`;
    } else if (t.type === 'h2') {
      currentLabel = t.text;
      currentSection = '';
      inRoutine = t.text.includes('ルーティンタスク');
      html += `<h2 class="mr-cat">${esc(t.text)}</h2>`;
    } else if (t.type === 'h1') {
      inRoutine = false;
      html += `<h2 class="mr-title">${esc(t.text)}</h2>`;
    } else if (t.type === 'summary') {
      html += `<p class="mr-summary">${esc(t.text)}</p>`;
    } else if (t.type === 'subhead') {
      html += `<p class="mr-subhead">${esc(t.text)}</p>`;
    } else if (t.type === 'detail') {
      html += `<p class="mr-detail-text">${esc(t.text)}</p>`;
    } else if (t.type === 'since') {
      html += `<p class="mr-since">${esc(t.text)}</p>`;
    }
  }

  // Flush any remaining list at end
  if (pendingList.length) {
    html += flushList(pendingList);
  }

  return html;
}

function attachMentionButtons(el) {
  el.querySelectorAll('.mr-item[data-mention-index]').forEach(p => {
    const idx = Number(p.dataset.mentionIndex);

    // bullet span is already in DOM from renderLi; extract it before rewriting
    const bulletSpan = p.querySelector('.mr-bullet');

    // Wrap text in span so button sits right next to it
    const textSpan = document.createElement('span');
    textSpan.className = 'mr-item-text';
    // Text content = li text minus the bullet span text
    textSpan.textContent = p.textContent.replace(/^-\s*/, '').trim();
    p.textContent = '';
    if (bulletSpan) p.appendChild(bulletSpan);
    p.appendChild(textSpan);
    const btn = document.createElement('button');
    btn.className = 'mr-mention-btn';
    btn.textContent = '@';
    btn.title = 'メンションしてメモを書く';
    btn.addEventListener('click', () => {
      if (typeof window.setMention === 'function') {
        window.setMention(mentionItems[idx]);
      }
    });
    p.appendChild(btn);
  });
}

function attachRoutineItems(el) {
  const doneState = loadRoutineDone();
  el.querySelectorAll('.mr-routine-item').forEach(p => {
    const key = p.dataset.routineKey;
    if (!key) return;

    // Restore saved state
    const savedState = doneState[key] || 'none'; // 'none' | 'hidden'
    if (savedState === 'hidden') {
      p.style.display = 'none';
    }

    p.style.cursor = 'pointer';
    p.addEventListener('click', (e) => {
      // Ignore clicks on the @ mention button
      if (e.target.classList.contains('mr-mention-btn')) return;
      const state = loadRoutineDone();
      const cur = state[key] || 'none';
      if (cur === 'none') {
        // First click: hide immediately
        p.style.display = 'none';
        state[key] = 'hidden';
      } else {
        // Second click: restore
        p.classList.remove('mr-routine-struck');
        p.style.display = '';
        state[key] = 'none';
      }
      saveRoutineDone(state);
    });
  });
}

// ── Mark-as-active (red bullet) ───────────────────────────────────────────────

const MR_ACTIVE_KEY = 'mrActiveItems';

function loadActiveItems() {
  try {
    return JSON.parse(localStorage.getItem(MR_ACTIVE_KEY) || '[]');
  } catch { return []; }
}

function saveActiveItems(items) {
  localStorage.setItem(MR_ACTIVE_KEY, JSON.stringify(items));
}

function attachBulletToggles(el) {
  const activeItems = loadActiveItems();

  el.querySelectorAll('.mr-bullet').forEach(bullet => {
    const key = bullet.dataset.itemKey || '';
    const li = bullet.closest('li');

    // Restore saved state
    if (activeItems.includes(key)) {
      bullet.textContent = '🔴';
      if (li) li.classList.add('mr-item--active');
    }

    bullet.addEventListener('click', (e) => {
      e.stopPropagation();
      const state = loadActiveItems();
      const isActive = state.includes(key);
      if (isActive) {
        // Remove from active
        const idx = state.indexOf(key);
        state.splice(idx, 1);
        bullet.textContent = '-';
        if (li) li.classList.remove('mr-item--active');
      } else {
        // Add to active
        state.push(key);
        bullet.textContent = '🔴';
        if (li) li.classList.add('mr-item--active');
      }
      saveActiveItems(state);
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

renderCalWidget();
renderReport();
