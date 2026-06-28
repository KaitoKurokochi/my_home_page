// ── News Knowledge Graph ───────────────────────────────────────────────────────
// Reads news.json (nodes + edges) and renders a D3 force-directed graph.

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

// ── Graph render ──────────────────────────────────────────────────────────────

function renderGraph(data) {
  const container = document.getElementById('news-graph');
  container.innerHTML = '';

  const nodes = data.nodes.map(d => ({ ...d }));
  const edges = data.edges.map(d => ({ ...d }));

  if (!nodes.length) {
    container.innerHTML = '<p class="news-error">No recent articles (within 24h).</p>';
    return;
  }

  const width  = container.clientWidth || 800;
  const height = Math.max(520, Math.min(window.innerHeight - 220, 680));

  // ── Tooltip ────────────────────────────────────────────────────────────────

  const tooltip = document.getElementById('graph-tooltip');

  function showTooltip(event, d) {
    if (d.type !== 'article') return;
    tooltip.innerHTML = `
      <div class="gt-headline">${d.headline}</div>
      <div class="gt-desc">${d.description}</div>
      <div class="gt-time">${timeAgo(d.pub)}</div>
    `;
    tooltip.classList.add('visible');
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const x = event.clientX + 14;
    const y = event.clientY - 10;
    const tw = tooltip.offsetWidth;
    tooltip.style.left = (x + tw > window.innerWidth ? x - tw - 28 : x) + 'px';
    tooltip.style.top  = y + 'px';
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
  }

  // ── SVG setup ─────────────────────────────────────────────────────────────

  const svg = d3.select('#news-graph')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g');

  svg.call(
    d3.zoom()
      .scaleExtent([0.25, 4])
      .on('zoom', e => g.attr('transform', e.transform))
  );

  // ── Force simulation ───────────────────────────────────────────────────────

  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges)
      .id(d => d.id)
      .distance(d => {
        const s = nodeById[d.source?.id ?? d.source];
        const t = nodeById[d.target?.id ?? d.target];
        if (s?.type === 'topic' || t?.type === 'topic') return 110;
        return 80;
      })
      .strength(0.6)
    )
    .force('charge', d3.forceManyBody().strength(d => d.type === 'topic' ? -500 : -180))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.type === 'topic' ? 46 : 22));

  // ── Edges ──────────────────────────────────────────────────────────────────

  const link = g.append('g').attr('class', 'graph-links')
    .selectAll('line')
    .data(edges)
    .join('line')
    .attr('class', d => {
      const s = nodeById[d.source?.id ?? d.source];
      const t = nodeById[d.target?.id ?? d.target];
      return (s?.type === 'topic' || t?.type === 'topic') ? 'graph-link topic-link' : 'graph-link article-link';
    });

  // ── Nodes ──────────────────────────────────────────────────────────────────

  const node = g.append('g').attr('class', 'graph-nodes')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', d => `graph-node graph-node--${d.type}`)
    .call(
      d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    )
    .on('click', (e, d) => {
      if (d.type === 'article' && d.url) {
        window.location.href = d.url;
      }
    })
    .on('mouseover', (e, d) => {
      showTooltip(e, d);
      // Highlight connected nodes, dim others
      const connected = new Set([d.id]);
      edges.forEach(l => {
        const sid = l.source?.id ?? l.source;
        const tid = l.target?.id ?? l.target;
        if (sid === d.id) connected.add(tid);
        if (tid === d.id) connected.add(sid);
      });
      node.classed('dimmed', n => !connected.has(n.id));
      link.classed('dimmed', l => {
        const sid = l.source?.id ?? l.source;
        const tid = l.target?.id ?? l.target;
        return !connected.has(sid) || !connected.has(tid);
      });
    })
    .on('mousemove', moveTooltip)
    .on('mouseout', () => {
      hideTooltip();
      node.classed('dimmed', false);
      link.classed('dimmed', false);
    });

  // Circle
  node.append('circle')
    .attr('r', d => d.type === 'topic' ? 28 : 10);

  // Label for topic nodes (inside circle)
  node.filter(d => d.type === 'topic')
    .append('text')
    .attr('class', 'topic-label')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .each(function(d) {
      const words = d.title.split(/(?<=.)(?=[A-Z])|[\s・]/);
      const el = d3.select(this);
      // Simple line wrap: split at ~6 chars
      const t = d.title;
      if (t.length <= 6) {
        el.append('tspan').attr('x', 0).attr('dy', 0).text(t);
      } else {
        const mid = Math.ceil(t.length / 2);
        el.append('tspan').attr('x', 0).attr('dy', '-0.6em').text(t.slice(0, mid));
        el.append('tspan').attr('x', 0).attr('dy', '1.2em').text(t.slice(mid));
      }
    });

  // ── Tick ───────────────────────────────────────────────────────────────────

  sim.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // Update meta
  if (data.fetchedAt) {
    document.getElementById('news-meta').textContent =
      `Updated ${timeAgo(data.fetchedAt)}`;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
// Depends on: js/config.js (githubFetch)

let newsLoaded = false;

const NEWS_FILE = 'my_home_page/news.json';

async function fetchNewsFromMyNotes() {
  // githubFetch throws on error; we need to distinguish 404 specially.
  try {
    const text = await githubFetch(NEWS_FILE);
    return JSON.parse(text);
  } catch (e) {
    // Re-throw with status property so initNews can detect 404
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

    if (!data.nodes) {
      graphEl.innerHTML = '<p class="news-error">news.json is outdated.</p>';
      return;
    }

    renderGraph(data);
    newsLoaded = true;
  } catch (e) {
    const el = document.getElementById('news-graph');
    if (!el) return;
    if (e.status === 404) {
      el.innerHTML = '<p class="news-error">ニュースはまだ取得されていません（朝のルーティン待ち）</p>';
    } else {
      el.innerHTML = `<p class="news-error">Could not load news.<br><small>${e}</small></p>`;
    }
  }
}

// initNews() is called from app.js to avoid double-invocation.
