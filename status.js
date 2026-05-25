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
      return;
    }
    events = sched.events || [];
  } catch (e) {
    widget.innerHTML = `<button class="cal-summary">📅 ${dateLabel} <span class="cal-err">–</span></button>`;
    return;
  }

  // ── Summary (pill) ──────────────────────────────────────────────────────────
  const shown = events.slice(0, 2);
  const previewRows = shown.length
    ? shown.map(ev =>
        `<span class="cal-preview-row"><span class="cal-preview-time">${esc(ev.allDay ? '終日' : ev.start)}</span><span class="cal-preview-title">${esc(ev.title)}</span></span>`
      ).join('')
    : `<span class="cal-preview-empty">予定なし</span>`;
  const more = events.length > 2 ? `<span class="cal-more">+${events.length - 2}</span>` : '';

  // ── Detail panel ────────────────────────────────────────────────────────────
  const detailRows = events.map(ev => {
    const timeRange = ev.allDay ? '終日' : `${ev.start} – ${ev.end}`;
    return `<div class="cal-panel-event">
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
    </div>`;

  // toggle panel on click
  const btn   = document.getElementById('cal-summary');
  const panel = document.getElementById('cal-panel');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
  });
  document.addEventListener('click', () => panel.classList.add('hidden'));
}

// ── Report (left-col, above news) ─────────────────────────────────────────────

let mentionItems = [];  // shared with note.js via window

async function renderReport() {
  const el = document.getElementById('status-report');
  if (!el) return;

  try {
    const md = await fetchMyNotesFile('reports.md');
    mentionItems = [];
    el.innerHTML = `<div class="mr-body">${markdownToHtml(md)}</div>`;
    window.mentionItems = mentionItems;
    attachMentionButtons(el);
    attachRoutineItems(el);
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
    if (line.startsWith('### ')) {
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
  const HEADING_TYPES = new Set(['h1', 'h2', 'h3']);
  const CONTENT_TYPES = new Set(['summary', 'check', 'item', 'subhead', 'detail', 'since']);
  const skipIdx = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'h2' && t.type !== 'h3') continue;
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
  let currentSection = '';
  let itemIndex = 0;
  let inRoutine = false;

  for (let i = 0; i < tokens.length; i++) {
    if (skipIdx.has(i)) continue;
    const t = tokens[i];

    if (t.type === 'h3') {
      inRoutine = false;
      html += `<h4 class="mr-subcat">${esc(t.text)}</h4>`;
    } else if (t.type === 'h2') {
      currentSection = t.text;
      inRoutine = t.text.includes('ルーティンタスク');
      const isPhase = currentSection.startsWith('Phase:');
      html += `<h3 class="${isPhase ? 'mr-phase' : 'mr-cat'}">${esc(currentSection)}</h3>`;
    } else if (t.type === 'h1') {
      inRoutine = false;
      html += `<h2 class="mr-title">${esc(t.text)}</h2>`;
    } else if (t.type === 'summary') {
      html += `<p class="mr-summary">${esc(t.text)}</p>`;
    } else if (t.type === 'check') {
      const numMatch = t.text.match(/\(#(\d+)\)$/);
      const number = numMatch ? parseInt(numMatch[1]) : null;
      mentionItems.push({ title: t.text, section: currentSection, number });
      html += `<p class="mr-item${t.checked ? ' mr-item-done' : ''}" data-mention-index="${itemIndex++}">・${esc(t.text)}</p>`;
    } else if (t.type === 'item') {
      const numMatch = t.text.match(/\(#(\d+)\)$/);
      const number = numMatch ? parseInt(numMatch[1]) : null;
      mentionItems.push({ title: t.text, section: currentSection, number });
      if (inRoutine) {
        html += `<p class="mr-item mr-routine-item" data-mention-index="${itemIndex++}" data-routine-key="${esc(t.text)}">・${esc(t.text)}</p>`;
      } else {
        html += `<p class="mr-item" data-mention-index="${itemIndex++}">・${esc(t.text)}</p>`;
      }
    } else if (t.type === 'subhead') {
      html += `<p class="mr-subhead">${esc(t.text)}</p>`;
    } else if (t.type === 'detail') {
      html += `<p class="mr-detail-text">${esc(t.text)}</p>`;
    } else if (t.type === 'since') {
      html += `<p class="mr-since">${esc(t.text)}</p>`;
    }
  }
  return html;
}

function attachMentionButtons(el) {
  el.querySelectorAll('.mr-item[data-mention-index]').forEach(p => {
    const idx = Number(p.dataset.mentionIndex);
    // Wrap text in span so button sits right next to it
    const textSpan = document.createElement('span');
    textSpan.className = 'mr-item-text';
    textSpan.textContent = p.textContent.trim();
    p.textContent = '';
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

// ── Init ──────────────────────────────────────────────────────────────────────

renderCalWidget();
renderReport();
