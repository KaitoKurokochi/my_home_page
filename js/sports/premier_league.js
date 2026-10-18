// ── Premier League: Japanese Players Section ──────────────────────────────────
// Same shape as the MLB section above, but with one flat "出場選手成績" list
// instead of a batter/pitcher split (soccer has no equivalent role division).

function makePlTeamLogo(teamId, teamName) {
  // Crests come from ESPN's static CDN by team_id; no local asset needed.
  if (!teamId) return null;
  const img = document.createElement('img');
  img.src = `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`;
  img.alt = teamName || '';
  img.className = 'pl-team-logo';
  return img;
}

function makePlTeamBadge(teamId, teamName) {
  return makeTeamBadge(makePlTeamLogo(teamId, teamName), teamName);
}

function buildPlStatLine(p) {
  const parts = [p.starter ? '先発' : '途中出場'];
  if (p.goals)        parts.push(`${p.goals}G`);
  if (p.assists)       parts.push(`${p.assists}A`);
  if (p.yellow_cards)  parts.push('警告');
  if (p.red_cards)     parts.push('退場');
  return parts.join(' ');
}

function buildPlStatsList(players) {
  const ul = document.createElement('ul');
  ul.className = 'mlb-stats-list';
  for (const p of players) {
    const li = document.createElement('li');
    li.className = 'mlb-stats-item';

    const logo = makePlTeamLogo(p.team_id, p.team);
    if (logo) li.appendChild(logo);

    const name = makeStatsName(p);

    const stat = document.createElement('span');
    stat.className = 'mlb-stats-line';
    stat.textContent = buildPlStatLine(p);

    li.appendChild(name);
    li.appendChild(stat);
    ul.appendChild(li);
  }
  return ul;
}

function renderPremierLeague(data) {
  const container = document.getElementById('sports-pl-content');
  if (!container || !data.pl) return;
  container.innerHTML = '';

  const pl = data.pl;

  if (pl.date_label) {
    const dh = document.createElement('div');
    dh.className = 'sports-results-date';
    dh.textContent = `▽${pl.date_label}`;
    container.appendChild(dh);
  }

  const grid = document.createElement('div');
  grid.className = 'sports-two-col';

  const gamesCol = document.createElement('div');
  gamesCol.className = 'sports-col';
  gamesCol.appendChild(makeSublabel('試合結果'));
  const games = pl.games || [];
  if (games.length) {
    const ul = document.createElement('ul');
    ul.className = 'sports-results-vlist';
    for (const g of games) ul.appendChild(buildForeignGameItem(g, makePlTeamBadge));
    gamesCol.appendChild(ul);
  } else {
    const p = document.createElement('p');
    p.className = 'sports-empty';
    p.textContent = '日本人選手の出場試合なし';
    gamesCol.appendChild(p);
  }
  grid.appendChild(gamesCol);

  const playersCol = document.createElement('div');
  playersCol.className = 'sports-col';
  playersCol.appendChild(makeSublabel('出場選手成績'));
  const players = pl.players || [];
  if (players.length) {
    playersCol.appendChild(buildPlStatsList(players));
  } else {
    const p = document.createElement('p');
    p.className = 'sports-empty';
    p.textContent = 'データなし';
    playersCol.appendChild(p);
  }
  grid.appendChild(playersCol);

  container.appendChild(grid);

  if (pl.highlights && pl.highlights.length) {
    const hlEl = renderNpbHighlights(pl.highlights);
    if (hlEl) container.appendChild(hlEl);
  }
}
