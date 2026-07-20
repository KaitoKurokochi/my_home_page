// ── Calendar widget (top-bar) ─────────────────────────────────────────────────
// Fetches today's schedule from agent/my_home_page/runtime/schedule.json and renders
// the mini calendar widget in #cal-widget.
// Sets window.todayEvents for use by status.js, meeting_note.js, etc.
// Depends on: js/config.js (githubFetch, esc)

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
    const raw = await githubFetch('my_home_page/runtime/schedule.json');
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
