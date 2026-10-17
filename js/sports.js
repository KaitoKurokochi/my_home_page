// ── Sports Section ────────────────────────────────────────────────────────────
// Reads sports.json and renders each sub-section (js/sports/*.js).
// Depends on: shared/github-client.js (githubFetch)


// ── Other sports (Japanese athletes' achievements, news only) ──────────────────

function renderOtherSports(data) {
  const container = document.getElementById('sports-other-content');
  if (!container) return;
  container.innerHTML = '';

  const newsEl = renderNpbNews(data.other && data.other.news);
  if (newsEl) {
    container.appendChild(newsEl);
  } else {
    container.innerHTML = '<p class="sports-empty">該当するニュースはありません</p>';
  }
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

  const npbContainer = document.getElementById('sports-npb-content');
  const mlbContainer = document.getElementById('sports-mlb-content');
  const plContainer  = document.getElementById('sports-pl-content');
  const otherContainer = document.getElementById('sports-other-content');
  if (!npbContainer) return;

  try {
    const text = await githubFetch(SPORTS_FILE);
    const data = JSON.parse(text);
    renderNpb(data);
    if (mlbContainer) renderMlb(data);
    if (plContainer) renderPremierLeague(data);
    if (otherContainer) renderOtherSports(data);
    sportsLoaded = true;
  } catch (e) {
    const errMsg404 = '<p class="sports-empty">データ未取得（main_routine 待ち）</p>';
    const errMsgGen = `<p class="sports-empty">Could not load sports data.<br><small>${e}</small></p>`;
    if (/^404 /.test(e.message)) {
      npbContainer.innerHTML = errMsg404;
      if (mlbContainer) mlbContainer.innerHTML = errMsg404;
      if (plContainer) plContainer.innerHTML = errMsg404;
      if (otherContainer) otherContainer.innerHTML = errMsg404;
    } else {
      npbContainer.innerHTML = errMsgGen;
      if (mlbContainer) mlbContainer.innerHTML = '';
      if (plContainer) plContainer.innerHTML = '';
      if (otherContainer) otherContainer.innerHTML = '';
    }
  }
}

document.addEventListener('DOMContentLoaded', initSports);

