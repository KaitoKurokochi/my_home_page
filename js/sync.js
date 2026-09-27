// ── Sync trigger ──────────────────────────────────────────────────────────────
// pullSync()/pushSync() themselves now live in shared/sync-api.js. This file
// only triggers the initial pull, and does so from here (rather than from
// shared/sync-api.js itself) specifically because this script loads after
// note.js — so renderLabelBar/renderRoleBar are already defined by the time
// pullSync()'s post-pull re-render runs.
pullSync();
