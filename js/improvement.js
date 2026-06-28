// ── Improvement Report button ──────────────────────────────────────────────
// Shows an "Improvement Report" button only on Sundays.
// Clicking it opens pages/improvement.html in a new tab.

(function () {
  function init() {
    const wrap = document.getElementById('improvement-report-wrap');
    const btn  = document.getElementById('improvement-report-btn');
    if (!wrap || !btn) return;

    // Show only on Sunday (getDay() === 0)
    const today = new Date();
    if (today.getDay() !== 0) return;

    wrap.style.display = '';
    document.getElementById('report-btns-row').style.display = 'flex';

    btn.addEventListener('click', () => {
      window.open('pages/improvement.html', '_blank');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
