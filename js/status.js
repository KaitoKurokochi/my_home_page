// ── Status: report (left-col) ─────────────────────────────────────────────────
// Calendar widget is handled by js/calendar.js.
// Depends on: js/config.js (GITHUB_OWNER, NOTES_REPO, getToken, githubFetch, esc)
//             js/calendar.js (renderCalWidget — sets window.todayEvents)

// Thin wrappers kept for backward compatibility with callers inside this file.
function fetchMyNotesFile(path) { return githubFetch(path); }
function fetchAgentFile(path)   { return githubFetch(path); }

// Extracts the ## Status section from a note.md string.
// Returns lines from "## Status" up to (but not including) the next "## " heading,
// with the "## Status" line itself stripped.
function extractStatusSection(md) {
  const lines = md.split('\n');
  let inStatus = false;
  const result = [];
  for (const line of lines) {
    if (/^## Status\s*$/.test(line)) {
      inStatus = true;
      continue;
    }
    if (inStatus && /^## /.test(line)) break;
    if (inStatus) result.push(line);
  }
  // Trim leading/trailing blank lines
  while (result.length && result[0].trim() === '') result.shift();
  while (result.length && result[result.length - 1].trim() === '') result.pop();
  return result.join('\n');
}

// All available domains: [filePath, displayName, domainKey]
const AGENT_DOMAINS = [
  ['research/note.md',      'Research',     'research'],
  ['Lions_IS/note.md',      'Lions IS',     'Lions_IS'],
  ['baseball/note.md',      'Baseball',     'baseball'],
  ['my_home_page/note.md',  'My Home Page', 'my_home_page'],
  ['football/note.md',      'Football',     'football'],
  ['books/note.md',         'Books',        'books'],
  ['softball/note.md',      'Softball',     'softball'],
  ['univ/note.md',          'University',   'univ'],
  ['video_content/note.md', 'Video Content','video_content'],
  ['general/note.md',       'General',      'general'],
  ['living/note.md',        'Living',       'living'],
  ['agent_meta/note.md',    'Agent Meta',   'agent_meta'],
];

// Domains always shown regardless of selected_domains.json or context.
const ALWAYS_DOMAIN_KEYS = ['research', 'general', 'living'];

// Fetches selected_domains.json from GitHub (agent repo).
// Returns an array of domain keys, or [] on failure.
async function fetchSelectedDomains() {
  try {
    const text = await githubFetch('my_home_page/selected_domains.json');
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (_) {
    return [];
  }
}

// Computes the set of domain keys to display based on:
//   1. always set (ALWAYS_DOMAIN_KEYS)
//   2. selected_domains.json contents
//   3. context rules (window.currentZone, day of week)
// Also computes which domain keys should be auto-expanded.
// Returns { domainKeys: Set<string>, autoExpandKeys: Set<string> }
async function computeDomainSelection() {
  const domainKeys   = new Set(ALWAYS_DOMAIN_KEYS);
  const autoExpand   = new Set();

  // Merge selected_domains.json
  const selected = await fetchSelectedDomains();
  for (const k of selected) domainKeys.add(k);

  // Context-based rules — evaluated with current window.currentZone
  const zone = window.currentZone;  // may be undefined if GPS not yet ready
  const dow  = new Date().getDay(); // 0 = Sunday

  if (zone === 'home') {
    autoExpand.add('living');
  }
  if (zone === 'univ') {
    autoExpand.add('research');
  }
  if (zone === 'lions_is') {
    domainKeys.add('Lions_IS');
    autoExpand.add('Lions_IS');
  }
  if (dow === 0) {
    domainKeys.add('my_home_page');
    autoExpand.add('my_home_page');
  }

  return { domainKeys, autoExpand };
}

// Returns the display name for a domain key (looks up AGENT_DOMAINS).
function domainName(key) {
  const entry = AGENT_DOMAINS.find(([,, k]) => k === key);
  return entry ? entry[1] : key;
}

// Fetches domain note.md files for the resolved domain set and assembles a
// combined markdown string with # {DisplayName} headers.
// Returns { md: string, autoExpand: Set<string> (display names) }
async function fetchAgentStatusReport() {
  const { domainKeys, autoExpand } = await computeDomainSelection();

  // Resolve ordered list of [filePath, displayName, domainKey] tuples,
  // preserving the canonical order defined in AGENT_DOMAINS.
  const domains = AGENT_DOMAINS.filter(([,, k]) => domainKeys.has(k));

  const results = await Promise.all(
    domains.map(async ([path, name]) => {
      try {
        const md = await fetchAgentFile(path);
        const status = extractStatusSection(md);
        if (!status) return null;
        return `# ${name}\n\n${status}`;
      } catch (_) {
        return null;
      }
    })
  );

  // Convert autoExpand from domain keys to display names for section matching
  const autoExpandNames = new Set();
  for (const k of autoExpand) {
    autoExpandNames.add(domainName(k));
  }

  return { md: results.filter(Boolean).join('\n\n'), autoExpand: autoExpandNames };
}

// Returns a stable key for an item: issue number if present, otherwise full text.
function itemKey(text) {
  const m = text.match(/\(#(\d+)(?:,\s*[^)]+)?\)/);
  return m ? '#' + m[1] : text;
}

// ── Report (left-col, above news) ─────────────────────────────────────────────

let mentionItems = [];  // shared with note.js via window

// Wraps each ## section (h2.mr-cat + its following sibling nodes up to the
// next h2) in a <div class="sr-section" data-key="KEY">.
// Adds a toggle arrow to the h2 and wires click-to-collapse behaviour.
// autoExpandKeys: Set of display names to auto-expand on load.
//                 All other sections start collapsed.
//                 Pass an empty Set (not null) to collapse everything by default.
function wrapSections(bodyEl, autoExpandKeys) {
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

      // Default: collapsed. Expand only if key matches autoExpandKeys.
      const shouldExpand = autoExpandKeys !== null && autoExpandKeys.size > 0
        ? [...autoExpandKeys].some(k => key === k || key.includes(k) || k.includes(key))
        : false;
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

// Re-applies auto-expand state to already-rendered .sr-section wrappers
// based on the current window.currentZone and day of week.
// Called after initial render and again when GPS zone becomes available.
async function reapplyAutoExpand(bodyEl) {
  const { autoExpand } = await computeDomainSelection();
  const autoExpandNames = new Set();
  for (const k of autoExpand) autoExpandNames.add(domainName(k));

  bodyEl.querySelectorAll('.sr-section').forEach(wrapper => {
    const key = wrapper.dataset.key || '';
    const shouldExpand = autoExpandNames.size > 0
      ? [...autoExpandNames].some(k => key === k || key.includes(k) || k.includes(key))
      : false;
    if (shouldExpand) {
      wrapper.classList.remove('collapsed');
    }
    // Never auto-collapse a section that the user has manually expanded.
  });
}

async function renderReport() {
  const el = document.getElementById('status-report');
  if (!el) return;

  try {
    const { md, autoExpand } = await fetchAgentStatusReport();
    mentionItems = [];
    const bodyEl = document.createElement('div');
    bodyEl.className = 'mr-body';
    bodyEl.innerHTML = markdownToHtml(md);
    el.innerHTML = '';
    el.appendChild(bodyEl);
    // Pass autoExpand directly: sections not in the set start collapsed.
    wrapSections(bodyEl, autoExpand);
    window.mentionItems = mentionItems;
    attachMentionButtons(el);
    attachRoutineItems(el);
    attachBulletToggles(el);
    // When GPS zone becomes available later, re-evaluate auto-expand rules.
    // Chain with any previously registered onLocationReady callbacks.
    const _prevLocationReady = window.onLocationReady;
    window.onLocationReady = function () {
      reapplyAutoExpand(bodyEl);
      if (typeof _prevLocationReady === 'function') _prevLocationReady();
    };
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
    } else if (line.trim() === '') {
      tokens.push({ type: 'blank' });
    } else {
      tokens.push({ type: 'paragraph', text: line.trim() });
    }
  }

  // ── Pass 2: skip heading tokens whose section has no content ─────────────
  // A heading (h2/h3) is "empty" if the next non-blank token is another heading or end-of-stream.
  const HEADING_TYPES = new Set(['h1', 'h2', 'h3', 'h4']);
  const CONTENT_TYPES = new Set(['summary', 'check', 'item', 'subhead', 'detail', 'since', 'paragraph']);
  const skipIdx = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'h2' && t.type !== 'h3' && t.type !== 'h4') continue;
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
      html += `<h4>${esc(t.text)}</h4>`;
    } else if (t.type === 'h3') {
      inRoutine = false;
      html += `<h3>${esc(t.text)}</h3>`;
    } else if (t.type === 'h2') {
      inRoutine = false;
      currentSection = t.text;
      const isPhase = t.text.startsWith('Phase:');
      html += isPhase ? `<h2 class="mr-phase">${esc(t.text)}</h2>` : `<h2 class="mr-section">${esc(t.text)}</h2>`;
    } else if (t.type === 'h1') {
      currentLabel = t.text;
      currentSection = '';
      inRoutine = t.text.includes('ルーティンタスク');
      html += `<h2 class="mr-cat">${esc(t.text)}</h2>`;
    } else if (t.type === 'summary') {
      html += `<p class="mr-summary">${esc(t.text)}</p>`;
    } else if (t.type === 'subhead') {
      html += `<p class="mr-subhead">${esc(t.text)}</p>`;
    } else if (t.type === 'detail') {
      html += `<p class="mr-detail-text">${esc(t.text)}</p>`;
    } else if (t.type === 'since') {
      html += `<p class="mr-since">${esc(t.text)}</p>`;
    } else if (t.type === 'paragraph') {
      html += `<p class="mr-para">${esc(t.text)}</p>`;
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

// renderReport() depends on window.todayEvents which is populated by renderCalWidget(),
// so we must await the calendar before fetching domain files.
renderCalWidget().then(() => renderReport());
