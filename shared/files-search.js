// ── Full-text search over the docs mirrored to vault ──
// Reads docs/search/<shard>.json (built by agent-scripts' lib/docs_vault_sync.py), one shard per department.
// Depends on: shared/github-client.js (GITHUB_OWNER, NOTES_REPO, githubFetch, githubHeaders, esc)

const SEARCH_MANIFEST_PATH = 'docs/search/index.json';
const MAX_SEARCH_RESULTS = 50;
const MAX_SNIPPETS = 3;
const SNIPPET_WIDTH = 140;
const SNIPPET_LEAD = 40;  // characters of context kept before the first match when a line is cut

let _searchDocs = null;

// Raw media type: the JSON Contents API inlines no content above 1MB, a shard may grow past that.
async function fetchVaultRaw(path) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${NOTES_REPO}/contents/${path}`,
    { headers: { ...githubHeaders(), Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' }
  );
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${path}`), { status: res.status });
  return res.text();
}

// A shard that fails to load is skipped; the load fails only when no shard could be read.
async function loadSearchDocs() {
  if (_searchDocs) return _searchDocs;
  const shardFiles = JSON.parse(await githubFetch(SEARCH_MANIFEST_PATH));
  const settled = await Promise.allSettled(shardFiles.map(f => fetchVaultRaw(`docs/search/${f}`).then(JSON.parse)));
  const docs = settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
  if (!docs.length) throw new Error('検索用の索引を読み込めませんでした');
  _searchDocs = docs.map(d => ({ ...d, lowerPath: d.path.toLowerCase(), lowerText: d.text.toLowerCase() }));
  return _searchDocs;
}

function parseSearchTerms(query) {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function countOccurrences(haystack, term) {
  let count = 0;
  for (let i = haystack.indexOf(term); i !== -1; i = haystack.indexOf(term, i + term.length)) count++;
  return count;
}

function firstMatchIndex(lowerText, terms) {
  const found = terms.map(t => lowerText.indexOf(t)).filter(i => i !== -1);
  return found.length ? Math.min(...found) : -1;
}

function snippetAround(line, terms) {
  const text = line.trim();
  if (text.length <= SNIPPET_WIDTH) return text;
  const start = Math.max(0, firstMatchIndex(text.toLowerCase(), terms) - SNIPPET_LEAD);
  const end = start + SNIPPET_WIDTH;
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

// Up to MAX_SNIPPETS lines containing a term, each cut to SNIPPET_WIDTH around its first match.
function matchingSnippets(text, terms) {
  const snippets = [];
  for (const line of text.split('\n')) {
    if (firstMatchIndex(line.toLowerCase(), terms) === -1) continue;
    snippets.push(snippetAround(line, terms));
    if (snippets.length >= MAX_SNIPPETS) break;
  }
  return snippets;
}

// Files containing every term (in the path or the text); path matches first, then by number of hits.
function searchDocs(docs, terms) {
  if (!terms.length) return { results: [], total: 0 };
  const hits = [];
  for (const d of docs) {
    if (!terms.every(t => d.lowerPath.includes(t) || d.lowerText.includes(t))) continue;
    hits.push({
      doc: d,
      nameMatch: terms.some(t => d.lowerPath.includes(t)),
      count: terms.reduce((n, t) => n + countOccurrences(d.lowerText, t), 0),
    });
  }
  hits.sort((a, b) => b.nameMatch - a.nameMatch || b.count - a.count);
  const results = hits.slice(0, MAX_SEARCH_RESULTS).map(h => ({
    path: h.doc.path,
    count: h.count,
    snippets: matchingSnippets(h.doc.text, terms),
  }));
  return { results, total: hits.length };
}

// text as HTML with every term wrapped in <mark>.
function highlightHtml(text, terms) {
  const lower = text.toLowerCase();
  const ranges = [];
  for (const t of terms) {
    for (let i = lower.indexOf(t); i !== -1; i = lower.indexOf(t, i + t.length)) ranges.push([i, i + t.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let html = '';
  let pos = 0;
  for (const [start, end] of ranges) {
    if (end <= pos) continue;
    const from = Math.max(start, pos);
    html += esc(text.slice(pos, from)) + '<mark>' + esc(text.slice(from, end)) + '</mark>';
    pos = end;
  }
  return html + esc(text.slice(pos));
}

function renderSearchResults({ results, total }, terms) {
  if (!results.length) return '<p class="placeholder">見つかりませんでした</p>';
  const items = results.map(r => {
    const slash = r.path.lastIndexOf('/');
    const dir = slash >= 0 ? `<span class="files-result-dir">${esc(r.path.slice(0, slash))}</span>` : '';
    const snippets = r.snippets.map(s => `<span class="files-snippet">${highlightHtml(s, terms)}</span>`).join('');
    return `<button type="button" class="files-result" data-path="${esc(r.path)}">`
      + `<span class="files-result-name">${highlightHtml(r.path.slice(slash + 1), terms)}</span>${dir}`
      + `<span class="files-count">${r.count}</span>${snippets}</button>`;
  }).join('');
  const more = total > results.length ? `<p class="md-detail">… 他${total - results.length}件</p>` : '';
  return `<p class="md-detail">${total}件</p>${items}${more}`;
}
