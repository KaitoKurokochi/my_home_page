const AUTO_RELOAD_INTERVAL_MS = 5 * 60 * 1000;

// Unsent note text must survive a reload, so any focused or non-empty field blocks it.
function hasUnsavedInput() {
  const fields = document.querySelectorAll('textarea, input[type="text"], input:not([type])');
  return Array.from(fields).some(el => el === document.activeElement || el.value.trim() !== '');
}

(function startAutoReload() {
  const loadedAt = Date.now();
  setInterval(() => {
    if (document.hidden || hasUnsavedInput()) return;
    if (Date.now() - loadedAt >= AUTO_RELOAD_INTERVAL_MS) location.reload();
  }, 30 * 1000);
})();
