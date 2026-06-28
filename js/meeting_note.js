// ── Meeting Note: Research Meeting detection ──────────────────────────────────
// When today's calendar events include a title containing "Research Meeting"
// (case-insensitive), show a button in .meeting-note-wrap.
// Clicking the button opens pages/meeting_note.html if the note exists in agent repo,
// or shows a message if it has not been created yet.
// Depends on: js/config.js (GITHUB_OWNER, NOTES_REPO, getToken)

(function () {
  // ── Research Meeting detection ────────────────────────────────────────────

  function isResearchMeeting(title) {
    return title.toLowerCase().includes('research meeting');
  }

  // ── GitHub Contents API helpers ───────────────────────────────────────────

  async function getFileMeta(path) {
    const token = getToken();
    const headers = { 'Accept': 'application/vnd.github+json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${NOTES_REPO}/contents/${path}`,
      { headers }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return res.json();
  }

  // ── Button click handler ──────────────────────────────────────────────────

  async function handleOpen(btn, dateCompact, filePath) {
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const existing = await getFileMeta(filePath);

      if (!existing) {
        alert('まだ作成されていません。Morning routine の実行後に再度お試しください。');
        return;
      }

      // Open pages/meeting_note.html passing the compact date as query param
      const url = `pages/meeting_note.html?date=${encodeURIComponent(dateCompact)}`;
      window.open(url, '_blank');
    } catch (e) {
      alert(`meeting note error: ${e.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Research meeting noteを開く →';
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    const wrap = document.getElementById('meeting-note-wrap');
    if (!wrap) return;

    // Compute today's date strings
    const today = new Date();
    const dateCompact = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');

    // Remote path: research/meetings/YYYYMMDD.md
    const filePath = `research/meetings/${dateCompact}.md`;

    // Wait for schedule.json to be loaded (renderCalWidget sets window.todayEvents)
    let events = [];
    for (let i = 0; i < 20; i++) {
      if (window.todayEvents !== undefined) {
        events = window.todayEvents;
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    const hasResearchMeeting = events.some(ev => isResearchMeeting(ev.title || ''));

    if (!hasResearchMeeting) return;

    wrap.style.display = '';
    document.getElementById('report-btns-row').style.display = 'flex';

    const btn = document.getElementById('meeting-note-btn');
    if (!btn) return;

    btn.addEventListener('click', () => handleOpen(btn, dateCompact, filePath));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
