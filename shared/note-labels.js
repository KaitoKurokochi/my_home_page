// ── Shared note label/template helpers ───────────────────────────────────────
// Used by both note.js (desktop) and app.js (mobile).
// Depends on: each side's own getLabels() — label lists/defaults differ
// intentionally between desktop and mobile, so that part stays local.

// Explicit overrides for cases where a mention's section name doesn't match
// the label name by norm() below.
const DOMAIN_LABEL_OVERRIDE = {};

// Match a section/domain name to an existing label (case-insensitive, ignoring
// emoji/symbols).
function guessLabel(section) {
  if (!section) return null;
  const labels = getLabels();
  if (DOMAIN_LABEL_OVERRIDE[section]) {
    const override = DOMAIN_LABEL_OVERRIDE[section];
    const found = labels.find(l => l === override);
    if (found) return found;
  }
  if (labels.includes(section)) return section;
  // Strip non-alphanumeric chars (emoji, spaces, underscores) and compare
  // case-insensitively, e.g. "🔬 Research"→"research", "Lions_IS"→"lionsis".
  const norm = s => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return labels.find(l => norm(l) === norm(section)) || null;
}

// Returns true when the given label name refers to the books domain.
function isBookLabel(label) {
  return !!(label && label.toLowerCase().includes('book'));
}

// Returns true when the given label name refers to the video content domain.
function isVideoLabel(label) {
  return !!(label && (label.toLowerCase().includes('video') || label.toLowerCase().includes('entertainment')));
}

// ── Label-specific templates ──────────────────────────────────────────────────

const BOOKS_DONE_TEMPLATE = 'タイトル: \n著者: \n評価: \nジャンル: \n感想: \n';
const BOOKS_TODO_TEMPLATE  = 'タイトル: \n著者: \nメモ: \n';
const BOOKS_TEMPLATES = [BOOKS_DONE_TEMPLATE, BOOKS_TODO_TEMPLATE];

const VIDEO_DONE_TEMPLATE = 'タイトル: \n制作/監督: \nジャンル: \n評価: \n感想: \n';
const VIDEO_TODO_TEMPLATE  = 'タイトル: \nメモ: \n';
const VIDEO_TEMPLATES = [VIDEO_DONE_TEMPLATE, VIDEO_TODO_TEMPLATE];

// All known templates (used to detect unmodified state across label switches)
const ALL_TEMPLATES = [...BOOKS_TEMPLATES, ...VIDEO_TEMPLATES];
