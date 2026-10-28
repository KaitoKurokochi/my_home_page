// ── F1 Section ────────────────────────────────────────────────────────────────
// Reads sports.json's `f1` key: four panels (last race, drivers, constructors, next race)
// and a highlight row that reuses renderNpbHighlights().

const F1_JST_FORMAT = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

// Logos from formula1.com's team pages, saved under images/f1_teams/. A team without an entry gets a colour badge.
const F1_TEAM_LOGOS = {
  mercedes:     'mercedes.webp',
  ferrari:      'ferrari.webp',
  mclaren:      'mclaren.webp',
  red_bull:     'red_bull.webp',
  rb:           'rb.webp',
  alpine:       'alpine.webp',
  haas:         'haas.webp',
  audi:         'audi.webp',
  williams:     'williams.webp',
  aston_martin: 'aston_martin.webp',
  cadillac:     'cadillac.webp',
};

const F1_TEAM_COLORS = {
  mercedes:     '#27f4d2',
  ferrari:      '#e8002d',
  mclaren:      '#ff8000',
  red_bull:     '#3671c6',
  rb:           '#6692ff',
  alpine:       '#ff87bc',
  haas:         '#b6babd',
  audi:         '#f50537',
  williams:     '#64c4ff',
  aston_martin: '#229971',
  cadillac:     '#2b2b2b',
};

function makeF1TeamMark(teamId) {
  const slot = document.createElement('span');
  slot.className = 'f1-team-slot';
  if (F1_TEAM_LOGOS[teamId]) {
    const img = document.createElement('img');
    img.src = `images/f1_teams/${F1_TEAM_LOGOS[teamId]}`;
    img.alt = teamId;
    img.className = 'f1-team-logo';
    slot.appendChild(img);
  } else {
    const badge = document.createElement('span');
    badge.className = 'f1-team-badge';
    badge.style.background = F1_TEAM_COLORS[teamId] || '#9aa0a6';
    badge.title = teamId;
    slot.appendChild(badge);
  }
  return slot;
}

// For a constructor row the logo stands for the team, so the name is shown only while there is no logo.
function buildF1Rows(rows, { isTeamRow = false } = {}) {
  const ul = document.createElement('ul');
  ul.className = 'mlb-stats-list';
  for (const r of rows) {
    const li = document.createElement('li');
    li.className = 'mlb-stats-item';

    const pos = document.createElement('span');
    pos.className = 'f1-pos';
    pos.textContent = r.position;
    li.appendChild(pos);

    if (r.team) li.appendChild(makeF1TeamMark(r.team));

    if (!(isTeamRow && F1_TEAM_LOGOS[r.team])) {
      const name = document.createElement('span');
      name.className = 'mlb-stats-name';
      name.textContent = r.name;
      li.appendChild(name);
    }

    if (r.points != null) {
      const points = document.createElement('span');
      points.className = 'mlb-stats-line';
      points.textContent = r.points;
      li.appendChild(points);
    }
    ul.appendChild(li);
  }
  return ul;
}

function makeF1Col(title) {
  const col = document.createElement('div');
  col.className = 'sports-col';
  col.appendChild(makeSublabel(title));
  return col;
}

function appendF1Empty(col) {
  const p = document.createElement('p');
  p.className = 'sports-empty';
  p.textContent = 'データなし';
  col.appendChild(p);
}

function buildF1LastRaceCol(last) {
  const col = makeF1Col(last ? `前のレース R${last.round} ${last.name}` : '前のレース');
  if (!last) {
    appendF1Empty(col);
    return col;
  }
  col.classList.add('f1-last-col');

  const grid = document.createElement('div');
  grid.className = 'f1-last-grid';
  grid.appendChild(buildF1SessionStack([['Sprint', last.sprint], ['Qualifying', last.qualifying]]));
  grid.appendChild(buildF1SessionStack([['Race', last.race]]));
  col.appendChild(grid);
  return col;
}

function buildF1SessionStack(sessions) {
  const stack = document.createElement('div');
  stack.className = 'f1-session-stack';
  for (const [label, rows] of sessions) {
    if (!rows || !rows.length) continue;
    const heading = document.createElement('div');
    heading.className = 'f1-session-label';
    heading.textContent = label;
    stack.appendChild(heading);
    stack.appendChild(buildF1Rows(rows.map(r => ({ position: r.position, name: r.code, team: r.team }))));
  }
  return stack;
}

const F1_STANDINGS_PER_COLUMN = 5;

function buildF1StandingsCol(title, rows, options) {
  const col = makeF1Col(title);
  col.classList.add('f1-standings-col');
  if (rows && rows.length) {
    const subcols = document.createElement('div');
    subcols.className = 'sports-subcols';
    for (let i = 0; i < rows.length; i += F1_STANDINGS_PER_COLUMN) {
      subcols.appendChild(buildF1Rows(rows.slice(i, i + F1_STANDINGS_PER_COLUMN), options));
    }
    col.appendChild(subcols);
  } else {
    appendF1Empty(col);
  }
  return col;
}

function buildF1NextRaceCol(next) {
  const col = makeF1Col('次のレース');
  if (!next) {
    appendF1Empty(col);
    return col;
  }

  const title = document.createElement('div');
  title.className = 'f1-next-title';
  title.textContent = `R${next.round} ${next.name}`;
  col.appendChild(title);

  const circuit = document.createElement('div');
  circuit.className = 'f1-next-circuit';
  circuit.textContent = `${next.circuit}（${next.locality}）`;
  col.appendChild(circuit);

  const ul = document.createElement('ul');
  ul.className = 'mlb-stats-list';
  for (const s of next.sessions) {
    const li = document.createElement('li');
    li.className = 'mlb-stats-item';
    const name = document.createElement('span');
    name.className = 'mlb-stats-name';
    name.textContent = s.name;
    const time = document.createElement('span');
    time.className = 'mlb-stats-line';
    time.textContent = F1_JST_FORMAT.format(new Date(s.utc));
    li.appendChild(name);
    li.appendChild(time);
    ul.appendChild(li);
  }
  col.appendChild(ul);

  const raceUtc = next.sessions[next.sessions.length - 1].utc;
  const daysLeft = Math.ceil((new Date(raceUtc) - Date.now()) / 86400000);
  if (daysLeft > 0) {
    const countdown = document.createElement('div');
    countdown.className = 'f1-countdown';
    countdown.textContent = `あと ${daysLeft}日`;
    col.appendChild(countdown);
  }
  return col;
}

function renderF1(data) {
  const container = document.getElementById('sports-f1-content');
  if (!container || !data.f1) return;
  container.innerHTML = '';

  const f1 = data.f1;

  if (f1.season && f1.round && f1.total_rounds) {
    const header = document.createElement('div');
    header.className = 'sports-results-date';
    header.textContent = `▽${f1.season} Season · Round ${f1.round} / ${f1.total_rounds} 終了`;
    container.appendChild(header);
  }

  const grid = document.createElement('div');
  grid.className = 'sports-two-col';
  grid.appendChild(buildF1LastRaceCol(f1.last_race));
  grid.appendChild(buildF1StandingsCol('Drivers順位', f1.drivers));
  grid.appendChild(buildF1StandingsCol('Constructors順位', f1.constructors, { isTeamRow: true }));
  grid.appendChild(buildF1NextRaceCol(f1.next_race));
  container.appendChild(grid);

  const hlEl = renderNpbHighlights(f1.videos);
  if (hlEl) {
    hlEl.classList.add('sports-highlights--scroll');
    container.appendChild(hlEl);
  }
}
