// ── Report: fetch Due Today and Status Report from agent repo ─────────────────
// Depends on: ../shared/github-client.js (githubFetch),
//             ../shared/status-report-data.js (computeDepartmentSelection,
//             departmentName, fetchStatusReportData)

let reportMentionItems = [];

// ── Tasks Due Today ───────────────────────────────────────────────────────────

async function renderDueToday(container) {
  const section = document.createElement('div');
  section.className = 'report-section';

  const heading = document.createElement('h2');
  heading.className = 'report-section-heading';
  heading.textContent = 'Tasks Due Today';
  section.appendChild(heading);

  try {
    const text = await githubFetch('my_home_page/runtime/due_today.json');
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

// Re-applies auto-expand to already-rendered mobile-rd-section wrappers.
// Called by location.js when GPS zone becomes available after initial render.
// Never auto-collapses manually expanded sections.
async function reapplyReportAutoExpand() {
  const section = document.querySelector('.report-section[data-report="status"]');
  if (!section) return;
  const { autoExpand } = await computeDepartmentSelection();
  const autoExpandNames = new Set([...autoExpand].map(departmentName));
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

// Build one collapsible department card inside the Status Report section.
function buildDepartmentCard(name, status, autoExpandNames) {
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
    const { departments, autoExpandNames } = await fetchStatusReportData();

    if (departments.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'placeholder';
      empty.textContent = 'No status report available';
      section.appendChild(empty);
    } else {
      departments.forEach(({ name, status, departmentKey }) => {
        const { wrapper, body } = buildDepartmentCard(name, status, autoExpandNames);

        const idxOffset = reportMentionItems.length;
        const { html, items } = markdownToHtml(status, departmentKey);
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
  // Zone detection may have finished while the report was still rendering (as desktop).
  if (window.currentZone) reapplyReportAutoExpand();
}

// esc() comes from ../shared/github-client.js

// Extract label_key from "(#NNN, label_key)" suffix, e.g. "Task text (#42, my_home_page)" → "my_home_page"
function extractSourceLabel(text) {
  const m = text.match(/\(#\d+,\s*([^)]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

function markdownToHtml(md, departmentKey) {
  const lines = md.split('\n');

  // ── Pass 1: parse into token objects ───────────────────────────────────────
  // Mirrors js/status.js's tokenizer (desktop) — kept in sync by hand since
  // the two renderers map onto genuinely different heading levels/markup.
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
    } else if (line.trim() === '') {
      tokens.push({ type: 'blank' });
    } else {
      tokens.push({ type: 'paragraph', text: line.trim() });
    }
  }

  // ── Pass 2: skip headings whose section has no content ────────────────────
  // A heading is "empty" if there's no content token before the next heading
  // of the same or shallower level — a deeper heading nested inside it (e.g.
  // "#### " under "## ") is a content-bearing container, not a section
  // boundary, so it's skipped over rather than stopping the scan.
  const HEADING_TYPES = new Set(['h1', 'h2', 'h3', 'h4']);
  const HEADING_LEVEL = { h1: 1, h2: 2, h3: 3, h4: 4 };
  const CONTENT_TYPES = new Set(['summary', 'check', 'item', 'subhead', 'detail', 'since', 'paragraph']);
  const skipIdx = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!HEADING_TYPES.has(t.type)) continue;
    const level = HEADING_LEVEL[t.type];
    let hasContent = false;
    for (let j = i + 1; j < tokens.length; j++) {
      const tj = tokens[j];
      if (HEADING_TYPES.has(tj.type) && HEADING_LEVEL[tj.type] <= level) break;
      if (CONTENT_TYPES.has(tj.type)) { hasContent = true; break; }
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
    } else if (t.type === 'h4') {
      closeItem();
      html += `<h5 class="mr-subsubcat">${esc(t.text)}</h5>`;
    } else if (t.type === 'summary') {
      closeItem();
      html += `<p class="mr-summary">${esc(t.text)}</p>`;
    } else if (t.type === 'subhead') {
      closeItem();
      html += `<p class="mr-subhead">${esc(t.text)}</p>`;
    } else if (t.type === 'paragraph') {
      closeItem();
      html += `<p class="mr-para">${esc(t.text)}</p>`;
    } else if (t.type === 'check') {
      closeItem();
      const checkSourceLabel = extractSourceLabel(t.text);
      // Use top-level section for label guessing so Phase: items map back to their parent label
      const itemSection = currentSection.startsWith('Phase:') ? currentTopSection : currentSection;
      items.push({ title: t.text, section: itemSection, sourceLabel: checkSourceLabel, departmentKey });
      console.debug('[mobile-note] item pushed:', { title: t.text, section: itemSection, sourceLabel: checkSourceLabel, departmentKey });
      const doneClass = t.checked ? ' mr-item-done' : '';
      html += `<div class="mr-item${doneClass}" data-idx="${idx++}"><div class="mr-item-header"><span class="mr-item-text">${esc(t.text)}</span></div>`;
      openItem = true;
    } else if (t.type === 'item') {
      closeItem();
      const itemSourceLabel = extractSourceLabel(t.text);
      const itemSection = currentSection.startsWith('Phase:') ? currentTopSection : currentSection;
      items.push({ title: t.text, section: itemSection, sourceLabel: itemSourceLabel, departmentKey });
      console.debug('[mobile-note] item pushed:', { title: t.text, section: itemSection, sourceLabel: itemSourceLabel, departmentKey });
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
