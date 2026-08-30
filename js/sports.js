// ── Sports Section ────────────────────────────────────────────────────────────
// Reads sports.json and renders NPB results, standings, and news.
// Depends on: js/config.js (githubFetch)

const SPORTS_FILE = 'my_home_page/runtime/sports.json';

// ── Team logos (TheSportsDB) ──────────────────────────────────────────────────

const TEAM_LOGO = {
  H:  'images/teams/H.png',
  M:  'images/teams/M.png',
  L:  'images/teams/L.png',
  E:  'images/teams/E.png',
  F:  'images/teams/F.png',
  B:  'images/teams/B.png',
  T:  'images/teams/T.png',
  C:  'images/teams/C.png',
  DB: 'images/teams/DB.png',
  G:  'images/teams/G.png',
  D:  'images/teams/D.png',
  S:  'images/teams/S.png',
  HY: 'images/teams/HY.png',
  OI: 'images/teams/OI.png',
};

function makeTeamLogo(initial) {
  const url = TEAM_LOGO[initial];
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = initial;
    img.className = 'sports-team-logo';
    return img;
  }
  const span = document.createElement('span');
  span.className = 'sports-team-initial';
  span.textContent = initial;
  return span;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sportsTimeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Results (vertical list) ───────────────────────────────────────────────────
// games: [{ home_initial, away_initial, home_score, away_score, status }]

function buildGameLine(g) {
  let score = '';
  if (g.status === 'final') {
    score = `${g.home_score}-${g.away_score}`;
  } else if (g.status === 'canceled' || g.status === 'postponed') {
    score = '中止';
  } else {
    score = g.time ? g.time : '予定';
  }
  return { homeInitial: g.home_initial, awayInitial: g.away_initial, score, lions: g.home_initial === 'L' || g.away_initial === 'L' };
}

function makeSublabel(text) {
  const el = document.createElement('div');
  el.className = 'sports-sublabel';
  el.textContent = text;
  return el;
}

const CE_TEAMS = new Set(['阪神', '広島', 'DeNA', '巨人', '中日', 'ヤクルト']);
const PA_TEAMS = new Set(['ソフトバンク', 'ロッテ', '西武', '日本ハム', '楽天', 'オリックス']);

function makeGameList(games) {
  const ul = document.createElement('ul');
  ul.className = 'sports-results-vlist';
  for (const g of games) {
    const { homeInitial, awayInitial, score, lions } = buildGameLine(g);
    const li = document.createElement('li');
    li.className = lions ? 'sports-result-chip sports-result-chip--highlight' : 'sports-result-chip';
    li.appendChild(makeTeamLogo(homeInitial));
    if (g.game_url) {
      const a = document.createElement('a');
      a.href = g.game_url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'sports-result-score sports-result-score--link';
      a.textContent = score;
      li.appendChild(a);
    } else {
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'sports-result-score';
      scoreSpan.textContent = score;
      li.appendChild(scoreSpan);
    }
    li.appendChild(makeTeamLogo(awayInitial));
    ul.appendChild(li);
  }
  return ul;
}

function makeSubCols(groupA, groupB) {
  const wrap = document.createElement('div');
  wrap.className = 'sports-subcols';
  wrap.appendChild(makeGameList(groupA));
  wrap.appendChild(makeGameList(groupB));
  return wrap;
}

function renderResultsGrid(results, dateLabel) {
  const wrap = document.createElement('div');
  wrap.className = 'sports-section-block';

  if (dateLabel) {
    const dh = document.createElement('div');
    dh.className = 'sports-results-date';
    dh.textContent = `▽${dateLabel}`;
    wrap.appendChild(dh);
  }

  const grid = document.createElement('div');
  grid.className = 'sports-two-col';

  // 1軍: セリーグ列 | パリーグ列
  const firstGames = results?.first || [];
  const ceGames = firstGames.filter(g => CE_TEAMS.has(g.home) || CE_TEAMS.has(g.away));
  const paGames = firstGames.filter(g => PA_TEAMS.has(g.home) || PA_TEAMS.has(g.away));

  const firstCol = document.createElement('div');
  firstCol.className = 'sports-col';
  firstCol.appendChild(makeSublabel('1軍'));
  if (firstGames.length) {
    firstCol.appendChild(makeSubCols(ceGames, paGames));
  } else {
    const p = document.createElement('p'); p.className = 'sports-empty'; p.textContent = '試合なし';
    firstCol.appendChild(p);
  }
  grid.appendChild(firstCol);

  // 2軍: 前半列 | 後半列
  const secondGames = results?.second || [];
  const half = Math.ceil(secondGames.length / 2);
  const secondCol = document.createElement('div');
  secondCol.className = 'sports-col';
  secondCol.appendChild(makeSublabel('2軍'));
  if (secondGames.length) {
    secondCol.appendChild(makeSubCols(secondGames.slice(0, half), secondGames.slice(half)));
  } else {
    const p = document.createElement('p'); p.className = 'sports-empty'; p.textContent = '試合なし';
    secondCol.appendChild(p);
  }
  grid.appendChild(secondCol);

  wrap.appendChild(grid);
  return wrap;
}

// ── Standings (compact, pa+ce stacked) ───────────────────────────────────────
// rows: [{ rank, initial, win, lose, pct, gb, highlight }]

function renderStandingsTable(rows) {
  const table = document.createElement('table');
  table.className = 'sports-standings-table';

  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>#</th><th></th><th>W-L</th><th>PCT</th><th>GB</th></tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    if (r.highlight) tr.classList.add('sports-standings-highlight');
    const wl = `${r.win}-${r.lose}`;
    const gb = r.gb ?? '-';
    tr.innerHTML = `<td>${r.rank}</td><td class="sports-standings-team"></td><td>${wl}</td><td>${r.pct}</td><td>${gb}</td>`;
    tr.querySelector('.sports-standings-team').appendChild(makeTeamLogo(r.initial));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function renderStandingsGrid(standings) {
  const wrap = document.createElement('div');
  wrap.className = 'sports-section-block';

  const grid = document.createElement('div');
  grid.className = 'sports-two-col';

  for (const [key, label] of [['pa', 'パリーグ'], ['ce', 'セリーグ']]) {
    const col = document.createElement('div');
    col.className = 'sports-col';
    col.appendChild(makeSublabel(label));

    const rows = standings[key] || [];
    if (rows.length) {
      col.appendChild(renderStandingsTable(rows));
    } else {
      const p = document.createElement('p');
      p.className = 'sports-empty';
      p.textContent = 'データなし';
      col.appendChild(p);
    }
    grid.appendChild(col);
  }

  wrap.appendChild(grid);
  return wrap;
}

// ── News ─────────────────────────────────────────────────────────────────────

function renderNpbNews(articles) {
  if (!articles || !articles.length) return null;

  const wrap = document.createElement('div');

  const label = document.createElement('div');
  label.className = 'sports-section-label';
  label.textContent = '重要ニュース';
  wrap.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'news-grid sports-news-grid';

  for (const a of articles) {
    const card = document.createElement('a');
    card.className = 'news-card';
    card.href = a.url || '#';
    card.target = '_blank';
    card.rel = 'noopener';

    const topic = document.createElement('div');
    topic.className = 'news-card-topic';
    topic.textContent = a.topic || '';

    const title = document.createElement('div');
    title.className = 'news-card-title';
    title.textContent = a.headline || '';

    card.appendChild(topic);
    card.appendChild(title);
    grid.appendChild(card);
  }

  wrap.appendChild(grid);
  return wrap;
}

// ── Highlights (YouTube embeds) ───────────────────────────────────────────────

function renderNpbHighlights(highlights) {
  if (!highlights || !highlights.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'sports-highlights';

  const label = document.createElement('div');
  label.className = 'sports-section-label';
  label.textContent = '試合ハイライト';
  wrap.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'sports-highlights-grid';

  for (const h of highlights) {
    const iframe = document.createElement('iframe');
    iframe.className = 'sports-highlight-iframe';
    iframe.src = `https://www.youtube.com/embed/${h.video_id}`;
    iframe.title = h.title;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.loading = 'lazy';
    grid.appendChild(iframe);
  }

  wrap.appendChild(grid);
  return wrap;
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderNpb(data) {
  const container = document.getElementById('sports-npb-content');
  if (!container) return;
  container.innerHTML = '';

  const dateLabel = data.results?.date_label || '';

  // [試合結果] | [順位表] 横並び、それぞれ内部も横並び
  const mainRow = document.createElement('div');
  mainRow.className = 'sports-main-row';

  if (data.results) {
    mainRow.appendChild(renderResultsGrid(data.results, dateLabel));
  }
  if (data.standings) {
    mainRow.appendChild(renderStandingsGrid(data.standings));
  }

  container.appendChild(mainRow);

  // 3. News
  if (data.news && data.news.length) {
    const newsEl = renderNpbNews(data.news);
    if (newsEl) container.appendChild(newsEl);
  }

  // 4. Highlights
  if (data.highlights && data.highlights.length) {
    const hlEl = renderNpbHighlights(data.highlights);
    if (hlEl) container.appendChild(hlEl);
  }

  // Updated timestamp
  if (data.fetchedAt) {
    const meta = document.createElement('p');
    meta.className = 'news-meta';
    meta.textContent = `Updated ${sportsTimeAgo(data.fetchedAt)}`;
    container.appendChild(meta);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

let sportsLoaded = false;

async function initSports() {
  if (sportsLoaded) return;

  const container = document.getElementById('sports-npb-content');
  if (!container) return;

  try {
    const text = await githubFetch(SPORTS_FILE);
    const data = JSON.parse(text);
    renderNpb(data);
    sportsLoaded = true;
  } catch (e) {
    if (!container) return;
    if (/^404 /.test(e.message)) {
      container.innerHTML = '<p class="sports-empty">データ未取得（main_routine 待ち）</p>';
    } else {
      container.innerHTML = `<p class="sports-empty">Could not load sports data.<br><small>${e}</small></p>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', initSports);
