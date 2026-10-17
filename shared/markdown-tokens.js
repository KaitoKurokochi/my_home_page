// ── Shared markdown tokenizer for the status report renderers ─────────────────
// Used by js/status.js (desktop) and mobile/report.js. Only the tokenizing and
// the empty-heading detection are shared; each page renders the tokens into
// its own markup.

function tokenizeMarkdown(md) {
  const tokens = [];
  for (const line of md.split('\n')) {
    if (line.startsWith('#### ')) {
      tokens.push({ type: 'h4', text: line.slice(5).trim() });
    } else if (line.startsWith('### ')) {
      tokens.push({ type: 'h3', text: line.slice(4).trim() });
    } else if (line.startsWith('## ')) {
      tokens.push({ type: 'h2', text: line.slice(3).trim() });
    } else if (line.startsWith('# ')) {
      tokens.push({ type: 'h1', text: line.slice(2).trim() });
    } else if (line.startsWith('> ')) {
      tokens.push({ type: 'summary', text: line.slice(2).trim() });
    } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      tokens.push({ type: 'check', text: line.slice(6).trim(), checked: line.startsWith('- [x] ') });
    } else if (line.startsWith('- ')) {
      tokens.push({ type: 'item', text: line.slice(2).trim() });
    } else if (line.startsWith('・')) {
      tokens.push({ type: 'item', text: line.slice(1).trim() });
    } else if (line.startsWith('**') && line.endsWith('**')) {
      tokens.push({ type: 'subhead', text: line.replace(/\*\*/g, '').trim() });
    } else if (line.startsWith('  *')) {
      tokens.push({ type: 'detail', text: line.trim().replace(/\*/g, '') });
    } else if (line.startsWith('  `')) {
      tokens.push({ type: 'since', text: line.trim().replace(/`/g, '') });
    } else if (line.trim() === '') {
      tokens.push({ type: 'blank' });
    } else {
      tokens.push({ type: 'paragraph', text: line.trim() });
    }
  }
  return tokens;
}

// Indices of the checkable heading tokens (checkedTypes, e.g. ['h2','h3','h4'])
// with no content before the next heading of the same or shallower level.
// A deeper heading nested inside is a content-bearing container, not a
// boundary, so the scan skips over it.
function findEmptyHeadingIndices(tokens, checkedTypes) {
  const HEADING_LEVEL = { h1: 1, h2: 2, h3: 3, h4: 4 };
  const CONTENT_TYPES = new Set(['summary', 'check', 'item', 'subhead', 'detail', 'since', 'paragraph']);
  const skipIdx = new Set();
  for (let i = 0; i < tokens.length; i++) {
    if (!checkedTypes.includes(tokens[i].type)) continue;
    const level = HEADING_LEVEL[tokens[i].type];
    let hasContent = false;
    for (let j = i + 1; j < tokens.length; j++) {
      const tj = tokens[j];
      if (HEADING_LEVEL[tj.type] <= level) break;
      if (CONTENT_TYPES.has(tj.type)) { hasContent = true; break; }
    }
    if (!hasContent) skipIdx.add(i);
  }
  return skipIdx;
}
