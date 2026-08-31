// ── Monthly Report button ─────────────────────────────────────────────────────
// Shows a "Monthly Report" button only on the last day of each month.
// Clicking it opens pages/monthly.html in a new tab.

(function () {
  function isLastDayOfMonth(date) {
    // Day 0 of next month = last day of this month
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === lastDay;
  }

  function init() {
    const wrap = document.getElementById('monthly-report-wrap');
    const btn  = document.getElementById('monthly-report-btn');
    if (!wrap || !btn) return;

    // Show only on the last day of each month
    const today = new Date();
    if (!isLastDayOfMonth(today)) return;

    wrap.style.display = '';
    document.getElementById('report-btns-row').style.display = 'flex';

    btn.addEventListener('click', () => {
      window.open('pages/monthly.html', '_blank');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
