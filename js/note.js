// ── Note section entry point ──────────────────────────────────────────────────
// The pieces live in js/note/ (config, compose, dropdown, list); this file loads
// last and starts the section.

// ── Location-based default label ─────────────────────────────────────────────

// Maps location zone name → default note label.
// Zone names come from location_zones.json (zone.name field).
const ZONE_DEFAULT_LABEL = {
  univ:     'Research',
  home:     'living',
  lions_is: 'Lions_IS',
};

// Returns the default label for the given zone name.
// Returns null when zoneName is unknown (location not yet resolved) so no label
// is pre-selected until GPS zone is confirmed via window.onLocationReady().
function defaultLabelForZone(zoneName) {
  if (!zoneName) return null;
  const labels = getLabels();
  const candidate = ZONE_DEFAULT_LABEL[zoneName];
  if (!candidate) return null;
  const matched = labels.find(l => l.toLowerCase() === candidate.toLowerCase());
  if (matched) return matched;
  const general = labels.find(l => l.toLowerCase() === 'general');
  return general || null;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function initNote() {
  // Initialize note_roles in localStorage if not yet set, so pushSync includes it
  if (localStorage.getItem(NOTE_ROLES_KEY) === null) {
    localStorage.setItem(NOTE_ROLES_KEY, JSON.stringify(DEFAULT_ROLES));
  }
  if (getToken()) {
    await fetchDepartmentLabels();  // populate getLabels()'s cache before any render
    renderNoteUI();
    loadNotes();
  } else {
    renderTokenSetup();
  }
}

initNote();

// Register location-ready hook to update default label when GPS zone is confirmed.
// Wraps any previously registered window.onLocationReady (e.g. from status.js)
// so both callbacks fire.
(function registerLocationHook() {
  const prev = window.onLocationReady;
  window.onLocationReady = function () {
    // Update default label only if user has not manually selected one this session.
    // selectedLabel may already be set by user interaction; we only override the
    // initial default (i.e. when it equals the old fallback or a previous zone default).
    const autoDefaults = new Set(Object.values(ZONE_DEFAULT_LABEL).concat(['general']));
    if (selectedLabel === null || autoDefaults.has(selectedLabel)) {
      const newDefault = defaultLabelForZone(window.currentZone);
      if (newDefault && newDefault !== selectedLabel) {
        selectedLabel = newDefault;
        renderLabelBar();
      }
    }
    if (typeof prev === 'function') prev();
  };
})();

setInterval(() => { if (getToken()) loadNotes(); }, 10 * 60 * 1000);
