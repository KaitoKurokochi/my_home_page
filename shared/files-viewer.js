// ── Files viewer: popup over the markdown that agent-scripts mirrors to vault's docs/ ──
// Used by desktop and mobile. Depends on: shared/github-client.js (githubFetch, esc), shared/markdown-tokens.js (tokenizeMarkdown)

const DOCS_INDEX_PATH = 'docs/index.json';
const MAX_RENDERED_TOKENS = 2000;  // history.md files run to 400KB, newest entry first

let _docsIndex = null;

async function loadDocsIndex() {
  if (_docsIndex) return _docsIndex;
  _docsIndex = JSON.parse(await githubFetch(DOCS_INDEX_PATH));
  return _docsIndex;
}

// Entries directly under dir: sub-folders (with the number of files below) and files.
function listDirectory(entries, dir) {
  const prefix = dir ? `${dir}/` : '';
  const folders = new Map();
  const files = [];
  for (const e of entries) {
    if (!e.path.startsWith(prefix)) continue;
    const rest = e.path.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash < 0) files.push(e);
    else {
      const name = rest.slice(0, slash);
      folders.set(name, (folders.get(name) || 0) + 1);
    }
  }
  return { folders: [...folders].sort(([a], [b]) => a.localeCompare(b)), files };
}

function renderDirectory(entries, dir) {
  const prefix = dir ? `${dir}/` : '';
  const { folders, files } = listDirectory(entries, dir);
  const folderHtml = folders.map(([name, count]) =>
    `<button type="button" class="files-folder" data-dir="${esc(prefix + name)}">📁 ${esc(name)}<span class="files-count">${count}</span></button>`);
  const fileHtml = files.map(f =>
    `<button type="button" class="files-item" data-path="${esc(f.path)}">${esc(f.path.split('/').pop())}</button>`);
  return [...folderHtml, ...fileHtml].join('');
}

function renderMarkdownTokens(tokens) {
  const shown = tokens.slice(0, MAX_RENDERED_TOKENS);
  const html = shown.map(t => {
    switch (t.type) {
      case 'h1': return `<h1 class="md-h1">${esc(t.text)}</h1>`;
      case 'h2': return `<h2 class="md-h2">${esc(t.text)}</h2>`;
      case 'h3': return `<h3 class="md-h3">${esc(t.text)}</h3>`;
      case 'h4': return `<h4 class="md-h4">${esc(t.text)}</h4>`;
      case 'summary': return `<blockquote class="md-quote">${esc(t.text)}</blockquote>`;
      case 'check': return `<div class="md-item">${t.checked ? '☑' : '☐'} ${esc(t.text)}</div>`;
      case 'item': return `<div class="md-item">• ${esc(t.text)}</div>`;
      case 'subhead': return `<p class="md-subhead">${esc(t.text)}</p>`;
      case 'detail':
      case 'since': return `<p class="md-detail">${esc(t.text)}</p>`;
      case 'blank': return '<div class="md-gap"></div>';
      default: return `<p class="md-text">${esc(t.text)}</p>`;
    }
  }).join('');
  const omitted = tokens.length - shown.length;
  return omitted > 0 ? `${html}<p class="md-detail">… 残り${omitted}行は省略</p>` : html;
}

function createFilesModal() {
  const modal = document.createElement('div');
  modal.className = 'files-modal hidden';
  modal.innerHTML = `
    <div class="files-sheet">
      <header class="files-header">
        <button type="button" class="files-back-btn hidden" aria-label="Back">←</button>
        <span class="files-title">Files</span>
        <button type="button" class="files-close-btn" aria-label="Close">✕</button>
      </header>
      <div class="files-search-row">
        <input type="search" class="files-search" placeholder="ファイル名・本文を検索" autocomplete="off">
      </div>
      <div class="files-body"></div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

// Adds the popup to the page and opens it when openBtn is clicked.
function initFilesViewer(openBtn) {
  const modal = createFilesModal();
  const title = modal.querySelector('.files-title');
  const body = modal.querySelector('.files-body');
  const backBtn = modal.querySelector('.files-back-btn');
  const closeBtn = modal.querySelector('.files-close-btn');
  const searchInput = modal.querySelector('.files-search');

  let currentDir = '';
  let viewingFile = false;
  let searchQuery = '';  // non-empty while the body shows search results (or a file opened from them)
  let searchSeq = 0;     // drops the answer of a search that a newer keystroke has superseded
  let searchTimer = null;

  async function showDirectory(dir) {
    currentDir = dir;
    viewingFile = false;
    title.textContent = dir || 'Files';
    backBtn.classList.toggle('hidden', !dir);
    body.innerHTML = '<p class="placeholder">Loading...</p>';
    try {
      const entries = await loadDocsIndex();
      body.innerHTML = entries.length ? renderDirectory(entries, dir) : '<p class="placeholder">ファイルがまだありません</p>';
    } catch (err) {
      body.innerHTML = `<p class="placeholder">一覧を取得できませんでした (${esc(err.message)})</p>`;
    }
    body.scrollTop = 0;
  }

  async function showFile(path) {
    title.textContent = path.split('/').pop();
    backBtn.classList.remove('hidden');
    viewingFile = true;
    body.innerHTML = '<p class="placeholder">Loading...</p>';
    try {
      const md = await githubFetch(`docs/${path}`);
      body.innerHTML = `<div class="md-body">${renderMarkdownTokens(tokenizeMarkdown(md))}</div>`;
    } catch (err) {
      body.innerHTML = `<p class="placeholder">開けませんでした (${esc(err.message)})</p>`;
    }
    body.scrollTop = 0;
  }

  async function showSearchResults(query) {
    const seq = ++searchSeq;
    searchQuery = query;
    viewingFile = false;
    title.textContent = 'Files';
    backBtn.classList.add('hidden');
    body.innerHTML = '<p class="placeholder">検索中...</p>';
    let html;
    try {
      const terms = parseSearchTerms(query);
      html = renderSearchResults(searchDocs(await loadSearchDocs(), terms), terms);
    } catch (err) {
      html = `<p class="placeholder">検索できませんでした (${esc(err.message)})</p>`;
    }
    if (seq !== searchSeq) return;
    body.innerHTML = html;
    body.scrollTop = 0;
  }

  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = searchInput.value.trim();
      if (query) { showSearchResults(query); return; }
      searchSeq++;
      searchQuery = '';
      showDirectory(currentDir);
    }, 200);
  }

  function goBack() {
    if (viewingFile) {
      viewingFile = false;
      if (searchQuery) showSearchResults(searchQuery); else showDirectory(currentDir);
      return;
    }
    showDirectory(currentDir.split('/').slice(0, -1).join('/'));
  }

  function openModal() {
    modal.classList.remove('hidden');
    document.body.classList.add('files-open');
    searchInput.value = '';
    searchQuery = '';
    searchSeq++;
    showDirectory('');
  }

  function closeModal() {
    modal.classList.add('hidden');
    document.body.classList.remove('files-open');
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backBtn.addEventListener('click', goBack);
  searchInput.addEventListener('input', onSearchInput);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  body.addEventListener('click', e => {
    const folder = e.target.closest('.files-folder');
    if (folder) { showDirectory(folder.dataset.dir); return; }
    const item = e.target.closest('.files-item, .files-result');
    if (item) showFile(item.dataset.path);
  });
}
