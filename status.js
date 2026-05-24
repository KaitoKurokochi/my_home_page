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
  } catch (e) {
    el.innerHTML = `<p class="mr-error">report: ${e.message}</p>`;
  }
}

function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let currentSection = '';
  let itemIndex = 0;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim();
      html += `<h3 class="mr-cat">${esc(currentSection)}</h3>`;
    } else if (line.startsWith('# ')) {
      html += `<h2 class="mr-title">${esc(line.slice(2))}</h2>`;
    } else if (line.startsWith('> ')) {
      html += `<p class="mr-summary">${esc(line.slice(2))}</p>`;
    } else if (line.startsWith('- ')) {
      const title = line.slice(2).trim();
      mentionItems.push({ title, section: currentSection });
      html += `<p class="mr-item" data-mention-index="${itemIndex++}">${esc(title)}</p>`;
    } else if (line.startsWith('  *')) {
      html += `<p class="mr-detail-text">${esc(line.trim().replace(/\*/g, ''))}</p>`;
    } else if (line.startsWith('  `')) {
      html += `<p class="mr-since">${esc(line.trim().replace(/`/g, ''))}</p>`;
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

// ── Init ──────────────────────────────────────────────────────────────────────

renderCalWidget();
renderReport();
