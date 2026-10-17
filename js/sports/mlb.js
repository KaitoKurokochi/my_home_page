// ── MLB: Japanese Players Section ────────────────────────────────────────────

function makeMlbTeamBadge(teamId, teamName) {
  return makeTeamBadge(makeMlbTeamLogo(teamId, teamName), teamName);
}

// ── MLB: Stats columns ────────────────────────────────────────────────────────

function buildMlbBatterList(batters) {
  const ul = document.createElement('ul');
  ul.className = 'mlb-stats-list';
  for (const p of batters) {
    const li = document.createElement('li');
    li.className = 'mlb-stats-item';

    const logo = makeMlbTeamLogo(p.team_id, p.team);
    if (logo) li.appendChild(logo);

    const name = makeStatsName(p);

    const stat = document.createElement('span');
    stat.className = 'mlb-stats-line';
    let s = `${p.h}/${p.ab}`;
    if (p.hr)  s += ` ${p.hr}HR`;
    if (p.rbi) s += ` ${p.rbi}打点`;
    if (p.bb)  s += ` ${p.bb}四球`;
    stat.textContent = s;

    li.appendChild(name);
    li.appendChild(stat);
    ul.appendChild(li);
  }
  return ul;
}

function buildMlbPitcherList(pitchers) {
  const ul = document.createElement('ul');
  ul.className = 'mlb-stats-list';
  for (const p of pitchers) {
    const li = document.createElement('li');
    li.className = 'mlb-stats-item';

    const logo = makeMlbTeamLogo(p.team_id, p.team);
    if (logo) li.appendChild(logo);

    const name = makeStatsName(p);

    const stat = document.createElement('span');
    stat.className = 'mlb-stats-line';
    let s = `${p.ip}IP ${p.h}H ${p.er}ER ${p.k}K`;
    if (p.bb) s += ` ${p.bb}BB`;
    stat.textContent = s;

    li.appendChild(name);
    li.appendChild(stat);
    ul.appendChild(li);
  }
  return ul;
}

function renderMlb(data) {
  const container = document.getElementById('sports-mlb-content');
  if (!container || !data.mlb) return;
  container.innerHTML = '';

  const mlb = data.mlb;

  if (mlb.date_label) {
    const dh = document.createElement('div');
    dh.className = 'sports-results-date';
    dh.textContent = `▽${mlb.date_label}`;
    container.appendChild(dh);
  }

  const grid = document.createElement('div');
  grid.className = 'sports-three-col';

  const gamesCol = document.createElement('div');
  gamesCol.className = 'sports-col';
  gamesCol.appendChild(makeSublabel('試合結果'));
  const games = mlb.games || [];
  if (games.length) {
    const ul = document.createElement('ul');
    ul.className = 'sports-results-vlist';
    for (const g of games) ul.appendChild(buildForeignGameItem(g, makeMlbTeamBadge));
    gamesCol.appendChild(ul);
  } else {
    const p = document.createElement('p');
    p.className = 'sports-empty';
    p.textContent = '日本人選手の出場試合なし';
    gamesCol.appendChild(p);
  }
  grid.appendChild(gamesCol);

  const battersCol = document.createElement('div');
  battersCol.className = 'sports-col';
  battersCol.appendChild(makeSublabel('野手成績'));
  const batters = mlb.batters || [];
  if (batters.length) {
    battersCol.appendChild(buildMlbBatterList(batters));
  } else {
    const p = document.createElement('p');
    p.className = 'sports-empty';
    p.textContent = 'データなし';
    battersCol.appendChild(p);
  }
  grid.appendChild(battersCol);

  const pitchersCol = document.createElement('div');
  pitchersCol.className = 'sports-col';
  pitchersCol.appendChild(makeSublabel('投手成績'));
  const pitchers = mlb.pitchers || [];
  if (pitchers.length) {
    pitchersCol.appendChild(buildMlbPitcherList(pitchers));
  } else {
    const p = document.createElement('p');
    p.className = 'sports-empty';
    p.textContent = 'データなし';
    pitchersCol.appendChild(p);
  }
  grid.appendChild(pitchersCol);

  container.appendChild(grid);

  if (mlb.news && mlb.news.length) {
    const newsEl = renderNpbNews(mlb.news);
    if (newsEl) container.appendChild(newsEl);
  }

  if (mlb.highlights && mlb.highlights.length) {
    const hlEl = renderNpbHighlights(mlb.highlights);
    if (hlEl) container.appendChild(hlEl);
  }
}
