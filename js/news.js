// ── News Card Grid ─────────────────────────────────────────────────────────────
// Reads news.json (articles) and renders curated article cards in a 4-column grid.

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Morning paper link ────────────────────────────────────────────────────────

function morningPaperUrl() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  if (jst.getUTCHours() < 4) jst.setUTCDate(jst.getUTCDate() - 1);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `https://www.nikkei.com/paper-viewer?TYPE=VIEWERBYPAGE&editionID=${y}${m}${d}M101`;
}

// ── Card grid render ──────────────────────────────────────────────────────────

function renderNewsGrid(data) {
  const container = document.getElementById('news-graph');
  container.innerHTML = '';

  const articles = data.articles || [];

  if (!articles.length) {
    container.innerHTML = '<p class="news-error">No recent articles (within 36h).</p>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'news-grid';

  for (const article of articles) {
    const card = document.createElement('a');
    card.className = 'news-card';
    card.href = article.url || '#';
    card.target = '_blank';
    card.rel = 'noopener';

    const topic = document.createElement('div');
    topic.className = 'news-card-topic';
    topic.textContent = article.topic || '';

    const title = document.createElement('div');
    title.className = 'news-card-title';
    title.textContent = article.headline || '';

    const desc = document.createElement('div');
    desc.className = 'news-card-desc';
    desc.textContent = article.description || '';

    card.appendChild(topic);
    card.appendChild(title);
    if (desc.textContent) card.appendChild(desc);
    grid.appendChild(card);
  }

  container.appendChild(grid);

  if (data.fetchedAt) {
    document.getElementById('news-meta').textContent =
      `Updated ${timeAgo(data.fetchedAt)}`;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
// Depends on: js/config.js (githubFetch)

let newsLoaded = false;

const NEWS_FILE = 'my_home_page/runtime/news.json';

async function fetchNewsFromMyNotes() {
  try {
    const text = await githubFetch(NEWS_FILE);
    return JSON.parse(text);
  } catch (e) {
    if (/^404 /.test(e.message)) throw Object.assign(new Error('not_found'), { status: 404 });
    throw e;
  }
}

async function initNews() {
  if (newsLoaded) return;

  const graphEl = document.getElementById('news-graph');
  const paperEl = document.getElementById('nikkei-paper-link');
  if (!graphEl) return;

  if (paperEl) paperEl.href = morningPaperUrl();
  graphEl.innerHTML = '<p class="news-loading">Loading...</p>';

  try {
    const data = await fetchNewsFromMyNotes();

    if (!data.articles && !data.nodes) {
      graphEl.innerHTML = '<p class="news-error">news.json is outdated.</p>';
      return;
    }
    // Fallback: convert old graph format (nodes) to articles list
    if (!data.articles && data.nodes) {
      data.articles = data.nodes
        .filter(n => n.type === 'article')
        .map(n => ({ headline: n.headline, description: n.description, url: n.url, pub: n.pub, topic: '' }));
    }

    renderNewsGrid(data);
    newsLoaded = true;
  } catch (e) {
    const el = document.getElementById('news-graph');
    if (!el) return;
    if (e.status === 404) {
      el.innerHTML = '<p class="news-error">ニュースはまだ取得されていません（main_routine待ち）</p>';
    } else {
      el.innerHTML = `<p class="news-error">Could not load news.<br><small>${e}</small></p>`;
    }
  }
}

// initNews() is called from app.js to avoid double-invocation.
