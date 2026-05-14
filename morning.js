// ── Morning Panel: schedule + task report from my_notes ───────────────────────

const MORNING_OWNER = 'KaitoKurokochi';
const MORNING_REPO  = 'my_notes';

function morningToken() {
  return localStorage.getItem('NOTE_TOKEN') || '';
}

function morningHeaders() {
  const token = morningToken();
  return token
    ? { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
    : { 'Accept': 'application/vnd.github+json' };
}

async function fetchMyNotesFile(path) {
  const res = await fetch(
    `https://api.github.com/repos/${MORNING_OWNER}/${MORNING_REPO}/contents/${path}`,
    { headers: morningHeaders() }
  );
  if (!res.ok) throw new Error(`${res.status}`);
  const meta = await res.json();
  return decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))));
}

// ── Schedule ──────────────────────────────────────────────────────────────────

async function renderSchedule() {
  const el = document.getElementById('morning-schedule');
  if (!el) return;

  try {
    const raw  = await fetchMyNotesFile('schedule.json');
    const data = JSON.parse(raw);
    const events = data.events || [];

    if (!events.length) {
      el.innerHTML = '<p class="ms-empty">今日の予定はありません</p>';
      return;
    }

    el.innerHTML = events.map(ev => {
      const time = ev.allDay ? '終日' : `${ev.start} – ${ev.end}`;
      return `<div class="ms-event">
        <span class="ms-time">${time}</span>
        <span class="ms-title">${escapeMs(ev.title)}</span>
        ${ev.location ? `<span class="ms-loc">${escapeMs(ev.location)}</span>` : ''}
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<p class="ms-error">schedule: ${e.message}</p>`;
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

async function renderReport() {
  const el = document.getElementById('morning-report');
  if (!el) return;

  try {
    const md = await fetchMyNotesFile('reports.md');
    el.innerHTML = markdownToHtml(md);
  } catch (e) {
    el.innerHTML = `<p class="ms-error">report: ${e.message}</p>`;
  }
}

// ── Minimal markdown → HTML (headings, bold, list items) ─────────────────────

function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  for (const line of lines) {
    if (line.startsWith('## '))      html += `<h3 class="mr-cat">${escapeMs(line.slice(3))}</h3>`;
    else if (line.startsWith('# '))  html += `<h2 class="mr-title">${escapeMs(line.slice(2))}</h2>`;
    else if (line.startsWith('> '))  html += `<p class="mr-summary">${escapeMs(line.slice(2))}</p>`;
    else if (line.startsWith('- '))  html += `<p class="mr-item">${escapeMs(line.slice(2))}</p>`;
    else if (line.trim() === '')     html += '';
    else                             html += `<p class="mr-text">${escapeMs(line)}</p>`;
  }
  return html;
}

function escapeMs(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Init ──────────────────────────────────────────────────────────────────────

renderSchedule();
renderReport();
