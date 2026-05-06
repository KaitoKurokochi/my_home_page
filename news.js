// ── News ──────────────────────────────────────────────────────────────────────

const NEWS_CACHE_KEY = 'mypage_news';
const NEWS_TTL = 30 * 60 * 1000; // 30 min

const HN_BASE = 'https://hacker-news.firebaseio.com/v2';
const CORS_PROXY = 'https://api.allorigins.win/get?url=';
const NHK_RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat4.xml'; // politics

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function fetchTechNews() {
  const ids = await fetch(`${HN_BASE}/topstories.json`).then(r => r.json());
  const items = await Promise.all(
    ids.slice(0, 10).map(id => fetch(`${HN_BASE}/item/${id}.json`).then(r => r.json()))
  );
  return items
    .filter(item => item && item.title && item.url)
    .map(item => ({
      title: item.title,
      url: item.url,
      source: new URL(item.url).hostname.replace(/^www\./, ''),
      time: item.time * 1000,
    }));
}

async function fetchGovNews() {
  const proxyUrl = CORS_PROXY + encodeURIComponent(NHK_RSS_URL);
  const res = await fetch(proxyUrl);
  const { contents } = await res.json();
  const doc = new DOMParser().parseFromString(contents, 'text/xml');
  return [...doc.querySelectorAll('item')].slice(0, 10).map(item => ({
    title: item.querySelector('title')?.textContent ?? '',
    url: item.querySelector('link')?.textContent ?? '',
    source: 'NHK',
    time: new Date(item.querySelector('pubDate')?.textContent ?? 0).getTime(),
  }));
}

// ── Data loading ──────────────────────────────────────────────────────────────
//
// To migrate to GitHub Actions + Claude API, replace this function with:
//
//   async function loadNewsFromAPIs() {
//     const res = await fetch('news.json');
//     return res.json(); // { tech: [...], gov: [...], fetchedAt: ... }
//   }
//
// The render functions below stay unchanged.

async function loadNewsFromAPIs() {
  const [tech, gov] = await Promise.allSettled([fetchTechNews(), fetchGovNews()]);
  return {
    tech: tech.status === 'fulfilled' ? tech.value : [],
    gov:  gov.status  === 'fulfilled' ? gov.value  : [],
    fetchedAt: Date.now(),
  };
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderNewsList(containerId, items) {
  const el = document.getElementById(containerId);
  if (!items.length) {
    el.innerHTML = '<p class="news-error">Could not load news.</p>';
    return;
  }
  el.innerHTML = items.map(item => `
    <a class="news-card" href="${item.url}" target="_blank" rel="noopener noreferrer">
      <span class="news-source">${item.source}</span>
      <span class="news-title">${item.title}</span>
      <span class="news-time">${timeAgo(item.time)}</span>
    </a>
  `).join('');
}

function renderNewsSection(data) {
  renderNewsList('news-tech', data.tech);
  renderNewsList('news-gov', data.gov);
  if (data.fetchedAt) {
    document.getElementById('news-updated').textContent =
      `Updated ${timeAgo(data.fetchedAt)}`;
  }
}

// ── Init (called when News tab is opened) ─────────────────────────────────────

let newsLoaded = false;

async function initNews() {
  if (newsLoaded) return;

  ['news-tech', 'news-gov'].forEach(id => {
    document.getElementById(id).innerHTML = '<p class="news-loading">Loading...</p>';
  });

  const cached = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || 'null');
  if (cached && Date.now() - cached.fetchedAt < NEWS_TTL) {
    renderNewsSection(cached);
    newsLoaded = true;
    return;
  }

  try {
    const data = await loadNewsFromAPIs();
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(data));
    renderNewsSection(data);
    newsLoaded = true;
  } catch {
    ['news-tech', 'news-gov'].forEach(id => {
      document.getElementById(id).innerHTML = '<p class="news-error">Failed to load news.</p>';
    });
  }
}
