// ── Sports section: constants and helpers shared by the sub-sections ───────────
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

// MLB crests come from MLB's static CDN by team_id; no local asset needed.
function makeMlbTeamLogo(teamId, teamName) {
  if (!teamId) return null;
  const img = document.createElement('img');
  img.src = `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
  img.alt = teamName || '';
  img.className = 'mlb-team-logo';
  return img;
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

// A team logo, or the team name as text when the logo is unavailable (team_id missing).
function makeTeamBadge(logo, teamName) {
  if (logo) return logo;
  const span = document.createElement('span');
  span.className = 'mlb-team-name';
  span.textContent = teamName;
  return span;
}

// [home badge] [score / LIVE / 予定] [away badge]; the score links to the game page when game_url is set.
// makeBadge(teamId, teamName) supplies each league's own logo CDN.
function buildForeignGameItem(g, makeBadge) {
  const li = document.createElement('li');
  li.className = 'sports-result-chip';

  li.appendChild(makeBadge(g.home_id, g.home));

  if (g.status === 'final' && g.away_score != null) {
    const scoreText = `${g.home_score}-${g.away_score}`;
    if (g.game_url) {
      const a = document.createElement('a');
      a.href = g.game_url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'sports-result-score sports-result-score--link';
      a.textContent = scoreText;
      li.appendChild(a);
    } else {
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'sports-result-score';
      scoreSpan.textContent = scoreText;
      li.appendChild(scoreSpan);
    }
  } else {
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'sports-result-score';
    scoreSpan.textContent = g.status === 'live' ? 'LIVE' : '予定';
    li.appendChild(scoreSpan);
  }

  li.appendChild(makeBadge(g.away_id, g.away));
  return li;
}

// A link to the player's game page when game_url is set, a plain span otherwise.
function makeStatsName(p) {
  const el = document.createElement(p.game_url ? 'a' : 'span');
  el.className = 'mlb-stats-name';
  el.textContent = p.name;
  if (p.game_url) {
    el.href = p.game_url;
    el.target = '_blank';
    el.rel = 'noopener';
  }
  return el;
}
