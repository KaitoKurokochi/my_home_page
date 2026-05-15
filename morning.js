// ── Morning: calendar widget (top-bar) + report (left-col) ───────────────────

const MORNING_OWNER = 'KaitoKurokochi';
const MORNING_REPO  = 'my_notes';

function morningToken() {
  return localStorage.getItem('NOTE_TOKEN') || '';
}

async function fetchMyNotesFile(path) {
  const token = morningToken();
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(
    `https://api.github.com/repos/${MORNING_OWNER}/${MORNING_REPO}/contents/${path}`,
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

  let events = [];
  try {
    const raw = await fetchMyNotesFile('schedule.json');
    events = JSON.parse(raw).events || [];
  } catch (e) {
    widget.innerHTML = `<button class="cal-summary">📅 ${dateLabel} <span class="cal-err">–</span></button>`;
    return;
  }

  // ── Summary (pill) ──────────────────────────────────────────────────────────
  const preview = events.slice(0, 3).map(ev => {
    const time = ev.allDay ? '終日' : ev.start;
    return `<span class="cal-preview-row"><span class="cal-preview-time">${esc(time)}</span><span class="cal-preview-title">${esc(ev.title)}</span></span>`;
  }).join('');
  const more = events.length > 3 ? `<span class="cal-more">+${events.length - 3}</span>` : '';

  // ── Detail panel ────────────────────────────────────────────────────────────
  const detailRows = events.map(ev => {
    const timeRange = ev.allDay ? '終日' : `${ev.start} – ${ev.end}`;
    const extras = [ev.location, ev.notes].filter(Boolean)
      .map(s => `<div class="cal-panel-extra">${esc(s)}</div>`).join('');
    return `<div class="cal-panel-event">
      <div class="cal-panel-time">${esc(timeRange)}</div>
      <div class="cal-panel-title">${esc(ev.title)}</div>
      ${extras}
    </div>`;
  }).join('');

  const noEvents = !events.length ? '<div class="cal-panel-empty">今日の予定はありません</div>' : '';

  widget.innerHTML = `
    <button class="cal-summary" id="cal-summary">
      <span class="cal-date-label">${dateLabel}</span>
      <span class="cal-previews">${preview}${more}</span>
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

async function renderReport() {
  const el = document.getElementById('morning-report');
  if (!el) return;

  try {
    const md   = await fetchMyNotesFile('reports.md');
    el.innerHTML = `<div class="mr-body">${markdownToHtml(md)}</div>`;
  } catch (e) {
    el.innerHTML = `<p class="mr-error">report: ${e.message}</p>`;
  }
}

function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  for (const line of lines) {
    if (line.startsWith('## '))      html += `<h3 class="mr-cat">${esc(line.slice(3))}</h3>`;
    else if (line.startsWith('# '))  html += `<h2 class="mr-title">${esc(line.slice(2))}</h2>`;
    else if (line.startsWith('> '))  html += `<p class="mr-summary">${esc(line.slice(2))}</p>`;
    else if (line.startsWith('- '))  html += `<p class="mr-item">${esc(line.slice(2))}</p>`;
    else if (line.startsWith('  *')) html += `<p class="mr-detail-text">${esc(line.trim().replace(/\*/g, ''))}</p>`;
    else if (line.startsWith('  `')) html += `<p class="mr-since">${esc(line.trim().replace(/`/g, ''))}</p>`;
  }
  return html;
}

// ── Init ──────────────────────────────────────────────────────────────────────

renderCalWidget();
renderReport();
