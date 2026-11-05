const AUTO_RELOAD_KEY = 'AUTO_RELOAD_MIN';
const AUTO_RELOAD_DEFAULT_MIN = 10;
const AUTO_RELOAD_OPTIONS_MIN = [0, 5, 10, 30];

function getAutoReloadMin() {
  const raw = localStorage.getItem(AUTO_RELOAD_KEY);
  const stored = Number(raw);
  return raw !== null && AUTO_RELOAD_OPTIONS_MIN.includes(stored) ? stored : AUTO_RELOAD_DEFAULT_MIN;
}

// Unsent note text must survive a reload, so any focused or non-empty field blocks it.
function hasUnsavedInput() {
  const fields = document.querySelectorAll('textarea, input[type="text"], input:not([type])');
  return Array.from(fields).some(el => el === document.activeElement || el.value.trim() !== '');
}

function startAutoReload() {
  let lastLoad = Date.now();
  setInterval(() => {
    const min = getAutoReloadMin();
    if (!min || document.hidden || hasUnsavedInput()) return;
    if (Date.now() - lastLoad >= min * 60 * 1000) location.reload();
  }, 30 * 1000);
}

function renderAutoReloadSelect() {
  const select = document.getElementById('auto-reload-select');
  if (!select) return;
  select.innerHTML = AUTO_RELOAD_OPTIONS_MIN
    .map(m => `<option value="${m}">${m ? `${m}分ごと` : 'オフ'}</option>`)
    .join('');
  select.value = String(getAutoReloadMin());
  select.addEventListener('change', () => localStorage.setItem(AUTO_RELOAD_KEY, select.value));
}

renderAutoReloadSelect();
startAutoReload();
