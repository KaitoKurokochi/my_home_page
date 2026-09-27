// ── Report: fetch Due Today and Status Report from agent repo ─────────────────

const REPORT_OWNER = 'KaitoKurokochi';
const REPORT_REPO  = 'vault';


let reportMentionItems = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Fetch a file from the agent repository via GitHub Contents API.
async function fetchAgentFile(path) {
  const res = await fetch(
    `https://api.github.com/repos/${REPORT_OWNER}/${REPORT_REPO}/contents/${path}`,
    { headers: syncHeaders() }
  );
  if (!res.ok) throw Object.assign(new Error(`${res.status}`), { status: res.status });
  const meta = await res.json();
  return decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))));
}

// Extracts the ## Status section from a note.md string.
function extractStatusSection(md) {
  const lines = md.split('\n');
  let inStatus = false;
  const result = [];
  for (const line of lines) {
    if (/^## Status\s*$/.test(line)) { inStatus = true; continue; }
    if (inStatus && /^## /.test(line)) break;
    if (inStatus) result.push(line);
  }
  while (result.length && result[0].trim() === '') result.shift();
  while (result.length && result[result.length - 1].trim() === '') result.pop();
  return result.join('\n');
}

// ── Tasks Due Today ───────────────────────────────────────────────────────────

async function renderDueToday(container) {
  const section = document.createElement('div');
  section.className = 'report-section';

  const heading = document.createElement('h2');
  heading.className = 'report-section-heading';
  heading.textContent = 'Tasks Due Today';
  section.appendChild(heading);

  try {
    const text = await fetchAgentFile('my_home_page/runtime/due_today.json');
    const data = JSON.parse(text);

    const today = new Date().toISOString().slice(0, 10);
    const tasks = (data.tasks || []).filter(() => !data.date || data.date === today);

    if (tasks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'placeholder';
      empty.textContent = 'No tasks due today';
      section.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'report-list';
      tasks.forEach(t => {
        const li = document.createElement('li');
        li.className = 'report-list-item' + (t.overdue ? ' report-item--overdue' : '');
        const labelSpan = document.createElement('span');
        labelSpan.className = 'report-label-badge';
        labelSpan.textContent = (t.label || t.key || '').replace(/_/g, ' ');
        const textSpan = document.createElement('span');
        textSpan.textContent = t.task
          .replace(/^\d{4}-\d{2}-\d{2}\s+/, '')
          .replace(/\[[\w\s]+\]\s*/g, '')
          .replace(/\s*\(#\d+\)\s*$/, '')
          .trim();
        li.appendChild(labelSpan);
        li.appendChild(textSpan);
        ul.appendChild(li);
      });
      section.appendChild(ul);
    }
  } catch (_) {
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = 'Due today unavailable';
    section.appendChild(p);
  }

  container.appendChild(section);
}

// ── Status Report ─────────────────────────────────────────────────────────────

// All agent domains: [filePath, displayName]
const REPORT_DOMAINS = [
  ['research/note.md',      'Research'],
  ['Lions_IS/note.md',      'Lions IS'],
  ['baseball/note.md',      'Baseball'],
  ['my_home_page/note.md',  'My Home Page'],
  ['football/note.md',      'Football'],
  ['books/note.md',         'Books'],
  ['softball/note.md',      'Softball'],
  ['univ/note.md',          'University'],
  ['video_content/note.md', 'Video Content'],
  ['general/note.md',       'General'],
  ['living/note.md',        'Living'],
  ['HQ/note.md',            'HQ'],
];

async function fetchSelectedDomains() {
  try {
    const text = await fetchAgentFile('my_home_page/runtime/selected_domains.json');
    const data = JSON.parse(text);
    // Format: { date: "YYYY-MM-DD", domains: ["research", "general", ...] }
    return Array.isArray(data.domains) ? data.domains : null;
  } catch (_) {
    return null;
  }
}

// Compute which domain display names should be auto-expanded.
// Logic mirrors status.js computeDomainSelection() but for mobile.
// Zone info from window.currentZone (set by location.js after GPS resolves).
function computeAutoExpandNames() {
  const autoExpand = new Set();
  const zone = window.currentZone;
  const dow  = new Date().getDay(); // 0 = Sunday

  if (zone === 'home') {
    autoExpand.add('Living');
  }
  if (zone === 'univ') {
    autoExpand.add('Research');
  }
  if (zone === 'lions_is') {
    autoExpand.add('Lions IS');
  }
  if (dow === 0) {
    autoExpand.add('My Home Page');
  }

  return autoExpand;
}

// Re-applies auto-expand to already-rendered mobile-rd-section wrappers.
// Called by location.js when GPS zone becomes available after initial render.
// Never auto-collapses manually expanded sections.
function reapplyReportAutoExpand() {
  const section = document.querySelector('.report-section[data-report="status"]');
  if (!section) return;
  const autoExpandNames = computeAutoExpandNames();
  section.querySelectorAll('.mobile-rd-section').forEach(wrapper => {
    const name = wrapper.dataset.name || '';
    const shouldExpand = [...autoExpandNames].some(n =>
      name === n || name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(name.toLowerCase())
    );
    if (shouldExpand) {
      wrapper.classList.remove('mobile-rd-collapsed');
    }
  });
}

// Build one collapsible domain card inside the Status Report section.
function buildDomainCard(name, status, autoExpandNames) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mobile-rd-section';
  wrapper.dataset.name = name;

  // Heading row (clickable)
  const headingRow = document.createElement('div');
  headingRow.className = 'mobile-rd-heading';

  const arrow = document.createElement('span');
  arrow.className = 'mobile-rd-arrow';
  arrow.textContent = '▼';

  const title = document.createElement('span');
  title.className = 'mobile-rd-title';
  title.textContent = name;

  headingRow.appendChild(arrow);
  headingRow.appendChild(title);
  wrapper.appendChild(headingRow);

  // Body
  const body = document.createElement('div');
  body.className = 'mobile-rd-body';
  wrapper.appendChild(body);

  // Determine initial collapsed state
  const shouldExpand = [...autoExpandNames].some(n =>
    name === n || name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(name.toLowerCase())
  );
  if (!shouldExpand) {
    wrapper.classList.add('mobile-rd-collapsed');
  }

  // Click handler
  headingRow.addEventListener('click', () => {
    wrapper.classList.toggle('mobile-rd-collapsed');
  });

  return { wrapper, body };
}

async function renderStatusReport(container) {
  const section = document.createElement('div');
  section.className = 'report-section';
  section.dataset.report = 'status';

  const heading = document.createElement('h2');
  heading.className = 'report-section-heading';
  heading.textContent = 'Status Report';
  section.appendChild(heading);

  try {
    // Determine which domains to show
    const selectedKeys = await fetchSelectedDomains();
    window._reportSelectedKeys = selectedKeys;
    const ALWAYS_KEYS = ['research', 'general', 'living'];
    const activeKeys = (selectedKeys && selectedKeys.length > 0) ? selectedKeys : ALWAYS_KEYS;
    const domains = REPORT_DOMAINS.filter(([path]) => {
      const key = path.split('/')[0];
      return activeKeys.includes(key);
    });

    // Compute auto-expand set now (GPS may not be ready yet)
    const autoExpandNames = computeAutoExpandNames();

    // Fetch all note.md files in parallel
    const results = await Promise.all(
      domains.map(async ([path, name]) => {
        try {
          const md = await fetchAgentFile(path);
          const status = extractStatusSection(md);
          if (!status) return null;
          return { name, status, domainKey: path.split('/')[0] };
        } catch (_) {
          return null;
        }
      })
    );

    const valid = results.filter(Boolean);
    if (valid.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'placeholder';
      empty.textContent = 'No status report available';
      section.appendChild(empty);
    } else {
      valid.forEach(({ name, status, domainKey }) => {
        const { wrapper, body } = buildDomainCard(name, status, autoExpandNames);

        const idxOffset = reportMentionItems.length;
        const { html, items } = markdownToHtml(status, domainKey);
        reportMentionItems = reportMentionItems.concat(items);

        body.innerHTML = html;

        // Attach @ buttons
        body.querySelectorAll('.mr-item[data-idx]').forEach(el => {
          const idx = idxOffset + Number(el.dataset.idx);
          const btn = document.createElement('button');
          btn.className = 'mr-mention-btn';
          btn.textContent = '@';
          btn.addEventListener('click', () => {
            setMention(reportMentionItems[idx]);
            switchTab('form');
          });
          el.querySelector('.mr-item-header').appendChild(btn);
        });

        section.appendChild(wrapper);
      });
    }
  } catch (e) {
    const p = document.createElement('p');
    p.className = 'error-msg';
    p.textContent = `Status report error: ${e.message}`;
    section.appendChild(p);
  }

  container.appendChild(section);
}

// ── Main loadReport ───────────────────────────────────────────────────────────

async function loadReport() {
  const container = document.getElementById('report-container');

  if (!getToken()) {
    container.innerHTML = '<p class="placeholder">Token not set. Please set your token in the Form tab.</p>';
    return;
  }

  container.innerHTML = '<p class="placeholder">Loading...</p>';
  reportMentionItems = [];
  container.innerHTML = '';

  await renderDueToday(container);
  await renderStatusReport(container);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Extract label_key from "(#NNN, label_key)" suffix, e.g. "Task text (#42, my_home_page)" → "my_home_page"
function extractSourceLabel(text) {
  const m = text.match(/\(#\d+,\s*([^)]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

function markdownToHtml(md, domainKey) {
  const lines = md.split('\n');

  // ── Pass 1: parse into token objects ───────────────────────────────────────
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
    } else if (line.startsWith('  *')) {
      tokens.push({ type: 'detail', text: line.trim().replace(/\*/g, '') });
    } else if (line.startsWith('  `')) {
      tokens.push({ type: 'since', text: line.trim().replace(/`/g, '') });
    } else {
      tokens.push({ type: 'blank' });
    }
  }

  // ── Pass 2: skip h2/h3 headings whose section has no content ──────────────
  const HEADING_TYPES = new Set(['h1', 'h2', 'h3']);
  const CONTENT_TYPES = new Set(['summary', 'check', 'item', 'detail', 'since']);
  const skipIdx = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'h2' && t.type !== 'h3') continue;
    let hasContent = false;
    for (let j = i + 1; j < tokens.length; j++) {
      if (HEADING_TYPES.has(tokens[j].type)) break;
      if (CONTENT_TYPES.has(tokens[j].type)) { hasContent = true; break; }
    }
    if (!hasContent) skipIdx.add(i);
  }

  // ── Pass 3: render ─────────────────────────────────────────────────────────
  let html = '';
  let currentSection = '';      // current h2 text (may be "Phase: ..." subheading)
  let currentTopSection = '';   // last h2 text that is NOT a Phase: subheading
                                // used as the label hint for items inside Phase: blocks
  let idx = 0;
  const items = [];
  let openItem = false;

  function closeItem() {
    if (openItem) { html += '</div>'; openItem = false; }
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Always update section tracking for h2, even when skipped for rendering,
    // so that items inside Phase: blocks inherit the correct parent section
    // (e.g. "🔬 Research" which is itself an empty wrapper heading).
    if (t.type === 'h2') {
      const isPhase = t.text.startsWith('Phase:');
      currentSection = t.text;
      if (!isPhase) currentTopSection = t.text;
    }

    if (skipIdx.has(i)) continue;

    if (t.type === 'h1') {
      closeItem();
      html += `<h2 class="mr-title">${esc(t.text)}</h2>`;
    } else if (t.type === 'h2') {
      closeItem();
      const isPhase = currentSection.startsWith('Phase:');
      html += `<h3 class="${isPhase ? 'mr-phase' : 'mr-cat'}">${esc(currentSection)}</h3>`;
    } else if (t.type === 'h3') {
      closeItem();
      html += `<h4 class="mr-subcat">${esc(t.text)}</h4>`;
    } else if (t.type === 'summary') {
      closeItem();
      html += `<p class="mr-summary">${esc(t.text)}</p>`;
    } else if (t.type === 'check') {
      closeItem();
      const checkSourceLabel = extractSourceLabel(t.text);
      // Use top-level section for label guessing so Phase: items map back to their parent label
      const itemSection = currentSection.startsWith('Phase:') ? currentTopSection : currentSection;
      items.push({ title: t.text, section: itemSection, sourceLabel: checkSourceLabel, domainKey });
      console.debug('[mobile-note] item pushed:', { title: t.text, section: itemSection, sourceLabel: checkSourceLabel, domainKey });
      const doneClass = t.checked ? ' mr-item-done' : '';
      html += `<div class="mr-item${doneClass}" data-idx="${idx++}"><div class="mr-item-header"><span class="mr-item-text">${esc(t.text)}</span></div>`;
      openItem = true;
    } else if (t.type === 'item') {
      closeItem();
      const itemSourceLabel = extractSourceLabel(t.text);
      const itemSection = currentSection.startsWith('Phase:') ? currentTopSection : currentSection;
      items.push({ title: t.text, section: itemSection, sourceLabel: itemSourceLabel, domainKey });
      console.debug('[mobile-note] item pushed:', { title: t.text, section: itemSection, sourceLabel: itemSourceLabel, domainKey });
      html += `<div class="mr-item" data-idx="${idx++}"><div class="mr-item-header"><span class="mr-item-text">${esc(t.text)}</span></div>`;
      openItem = true;
    } else if (t.type === 'detail' && openItem) {
      html += `<span class="mr-detail-text">${esc(t.text)}</span>`;
    } else if (t.type === 'since' && openItem) {
      html += `<span class="mr-since">${esc(t.text)}</span>`;
    } else {
      closeItem();
    }
  }
  closeItem();

  return { html, items };
}
