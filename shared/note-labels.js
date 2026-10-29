// ── Shared note label/template helpers ───────────────────────────────────────
// Used by both note.js (desktop) and app.js (mobile).
// Depends on: each side's own getLabels() — label lists/defaults differ
// intentionally between desktop and mobile, so that part stays local.

// Explicit overrides for cases where a mention's section name doesn't match
// the label name by norm() below.
const DEPARTMENT_LABEL_OVERRIDE = {};

function guessLabel(section) {
  if (!section) return null;
  const labels = getLabels();
  if (DEPARTMENT_LABEL_OVERRIDE[section]) {
    const override = DEPARTMENT_LABEL_OVERRIDE[section];
    const found = labels.find(l => l === override);
    if (found) return found;
  }
  if (labels.includes(section)) return section;
  // Label ↔ key link from departments.json (e.g. "University" ↔ "univ"), which norm() can't bridge.
  const sectionKey = departmentKeyForLabel(section);
  const byKey = labels.find(l => departmentKeyForLabel(l) === sectionKey);
  if (byKey) return byKey;
  const norm = s => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return labels.find(l => norm(l) === norm(section)) || null;
}

function isBookLabel(label) {
  return !!(label && label.toLowerCase().includes('book'));
}

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

const ALL_TEMPLATES = [...BOOKS_TEMPLATES, ...VIDEO_TEMPLATES];
