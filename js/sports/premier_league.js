// ── Premier League: results, standings, and Japanese players' appearances (flag tooltips) ──

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

// ESPN's country-flag image (square canvas, flag centred), served from the same CDN as the crests.
const PL_JAPAN_FLAG_URL = 'https://a.espncdn.com/i/teamlogos/countries/500/jpn.png';

// A small Japan flag at the crest's bottom-right; hovering (or focusing) it lists the players' appearances.
function makeJapanFlagWithTooltip(players) {
  const flag = document.createElement('span');
  flag.className = 'pl-jp-flag';
  flag.tabIndex = 0;

  const img = document.createElement('img');
  img.src = PL_JAPAN_FLAG_URL;
  img.alt = '日本人選手';
  img.className = 'pl-jp-flag-img';
  flag.appendChild(img);

  const tip = document.createElement('span');
  tip.className = 'pl-jp-tip';
  for (const p of players) {
    const row = document.createElement('span');
    row.className = 'pl-jp-tip-row';
    row.textContent = `${p.name}  ${buildPlStatLine(p)}`;
    tip.appendChild(row);
  }
  flag.appendChild(tip);
  return flag;
}

function makePlGameBadgeFactory(game) {
  return (teamId, teamName) => {
    const badge = makePlTeamBadge(teamId, teamName);
    const players = (game.players || []).filter(p => p.team_id === teamId);
    if (!players.length) return badge;

    const wrap = document.createElement('span');
    wrap.className = 'pl-badge-with-flag';
    wrap.appendChild(badge);
    wrap.appendChild(makeJapanFlagWithTooltip(players));
    return wrap;
  };
}

const PL_GAMES_PER_COLUMN = 5;

function buildPlGameList(games) {
  const ul = document.createElement('ul');
  ul.className = 'sports-results-vlist';
  for (const g of games) ul.appendChild(buildForeignGameItem(g, makePlGameBadgeFactory(g)));
  return ul;
}

const PL_STANDINGS_PER_COLUMN = 10;

// rows: [{ rank, team, team_id, gd, points }]
function renderPlStandingsTable(rows) {
  const table = document.createElement('table');
  table.className = 'sports-standings-table sports-standings-table--compact';
  table.innerHTML = '<thead><tr><th>#</th><th></th><th>GD</th><th>Pts</th></tr></thead>';

  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.rank}</td><td class="sports-standings-team"></td><td>${r.gd}</td><td>${r.points}</td>`;
    const logo = makePlTeamLogo(r.team_id, r.team);
    if (logo) tr.querySelector('.sports-standings-team').appendChild(logo);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function buildPlResultsBlock(games) {
  const block = document.createElement('div');
  block.className = 'sports-section-block';
  block.appendChild(makeSublabel('試合結果'));
  if (!games.length) {
    block.appendChild(makeEmptyNote('試合なし'));
    return block;
  }
  const subcols = document.createElement('div');
  subcols.className = 'sports-subcols';
  for (let i = 0; i < games.length; i += PL_GAMES_PER_COLUMN) {
    subcols.appendChild(buildPlGameList(games.slice(i, i + PL_GAMES_PER_COLUMN)));
  }
  block.appendChild(subcols);
  return block;
}

function buildPlStandingsBlock(rows) {
  const block = document.createElement('div');
  block.className = 'sports-section-block';
  block.appendChild(makeSublabel('順位'));
  if (!rows.length) {
    block.appendChild(makeEmptyNote('データなし'));
    return block;
  }
  const subcols = document.createElement('div');
  subcols.className = 'sports-subcols sports-subcols--table';
  for (let i = 0; i < rows.length; i += PL_STANDINGS_PER_COLUMN) {
    subcols.appendChild(renderPlStandingsTable(rows.slice(i, i + PL_STANDINGS_PER_COLUMN)));
  }
  block.appendChild(subcols);
  return block;
}

function makeEmptyNote(text) {
  const p = document.createElement('p');
  p.className = 'sports-empty';
  p.textContent = text;
  return p;
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

  const mainRow = document.createElement('div');
  mainRow.className = 'sports-main-row';
  mainRow.appendChild(buildPlResultsBlock(pl.games || []));
  mainRow.appendChild(buildPlStandingsBlock(pl.standings || []));
  container.appendChild(mainRow);

  if (pl.highlights && pl.highlights.length) {
    const hlEl = renderNpbHighlights(pl.highlights);
    if (hlEl) container.appendChild(hlEl);
  }
}
