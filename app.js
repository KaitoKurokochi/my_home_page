// ── Data ──────────────────────────────────────────────────────────────────────

const GROUPS_KEY = 'mypage_groups';
const ACTIVE_KEY = 'mypage_active_group';

const GROUP_COLORS = [
  '#1a73e8', '#12b5cb', '#33b679', '#f29900',
  '#e37400', '#e52592', '#8430ce', '#c5221f',
];

function loadGroups() {
  return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]');
}

function saveGroups(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  if (typeof pushSync === 'function') pushSync();
}

// Migrate old flat shortcuts to a default group
(function migrate() {
  const old = JSON.parse(localStorage.getItem('mypage_shortcuts') || 'null');
  if (!old || !old.length) return;
  const gs = loadGroups();
  if (gs.length === 0) {
    gs.push({ id: Date.now(), name: 'Shortcuts', color: GROUP_COLORS[0], shortcuts: old });
    saveGroups(gs);
  }
  localStorage.removeItem('mypage_shortcuts');
})();

function faviconUrl(url) {
  try {
    const origin = new URL(url).origin;
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=64`;
  } catch {
    return '';
  }
}

// ── Active group ──────────────────────────────────────────────────────────────

let activeGroupIndex = parseInt(localStorage.getItem(ACTIVE_KEY) ?? '-1');

function setActiveGroup(i) {
  activeGroupIndex = i;
  localStorage.setItem(ACTIVE_KEY, i);
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  renderPills();
  document.getElementById('shortcuts-panel').style.display = 'none';
}

function renderPills() {
  const container = document.getElementById('group-pills');
  const groups = loadGroups();
  container.innerHTML = '';

  groups.forEach((group, gi) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'pill-wrapper';

    // Pill button (label only — + moved into dropdown footer)
    const btn = document.createElement('button');
    btn.className = 'group-pill';
    btn.style.setProperty('--color', group.color);
    btn.innerHTML = `<span class="group-pill-label">${group.name}</span>`;

    // Hover dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'pill-dropdown';

    if (group.shortcuts.length) {
      group.shortcuts.forEach((s, si) => {
        const a = document.createElement('a');
        a.className = 'shortcut-item';
        a.href = s.url;
        a.innerHTML = `
          <div class="shortcut-icon"><img src="${faviconUrl(s.url)}" alt="" /></div>
          <span class="shortcut-label">${s.name}</span>
          <span class="shortcut-edit" title="Edit">✏</span>
          <span class="shortcut-remove">✕</span>
        `;
        a.querySelector('.shortcut-edit').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openShortcutModal(gi, si);
        });
        a.querySelector('.shortcut-remove').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const gs = loadGroups();
          gs[gi].shortcuts.splice(si, 1);
          saveGroups(gs);
          render();
        });
        dropdown.appendChild(a);
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'pill-dropdown-empty';
      empty.textContent = 'No shortcuts yet.';
      dropdown.appendChild(empty);
    }

    // Footer: + Add shortcut (left) | Delete group (right)
    const footer = document.createElement('div');
    footer.className = 'pill-dropdown-footer';

    const addShortcutBtn = document.createElement('button');
    addShortcutBtn.className = 'pill-dropdown-add';
    addShortcutBtn.textContent = '+ Add shortcut';
    addShortcutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setActiveGroup(gi);
      openShortcutModal();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'pill-dropdown-delete';
    deleteBtn.textContent = 'Delete group';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`Delete group "${group.name}"?`)) return;
      const gs = loadGroups();
      gs.splice(gi, 1);
      saveGroups(gs);
      if (activeGroupIndex >= gs.length) setActiveGroup(Math.max(0, gs.length - 1));
      render();
    });

    footer.appendChild(addShortcutBtn);
    footer.appendChild(deleteBtn);
    dropdown.appendChild(footer);

    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);
    container.appendChild(wrapper);
  });

  // New group button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-group-pill';
  addBtn.textContent = '+ New group';
  addBtn.addEventListener('click', openGroupModal);
  container.appendChild(addBtn);
}

// ── Shortcut modal ────────────────────────────────────────────────────────────

const shortcutModal = document.getElementById('shortcut-modal');
const shortcutNameInput = document.getElementById('shortcut-name');
const shortcutUrlInput = document.getElementById('shortcut-url');

let editGroupIndex = -1;
let editShortcutIndex = -1;

function openShortcutModal(editGi = -1, editSi = -1) {
  editGroupIndex = editGi;
  editShortcutIndex = editSi;
  if (editGi >= 0 && editSi >= 0) {
    const gs = loadGroups();
    const s = gs[editGi].shortcuts[editSi];
    shortcutNameInput.value = s.name;
    shortcutUrlInput.value = s.url;
    shortcutModal.querySelector('h3').textContent = 'Edit shortcut';
  } else {
    shortcutNameInput.value = '';
    shortcutUrlInput.value = '';
    shortcutModal.querySelector('h3').textContent = 'Add shortcut';
  }
  shortcutModal.classList.remove('hidden');
  shortcutNameInput.focus();
}

document.getElementById('shortcut-cancel').addEventListener('click', () => {
  shortcutModal.classList.add('hidden');
});

document.getElementById('shortcut-save').addEventListener('click', () => {
  const name = shortcutNameInput.value.trim();
  let url = shortcutUrlInput.value.trim();
  if (!name || !url) return;
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;
  const gs = loadGroups();
  if (editShortcutIndex >= 0) {
    gs[editGroupIndex].shortcuts[editShortcutIndex] = { name, url };
  } else {
    gs[activeGroupIndex].shortcuts.push({ name, url });
  }
  saveGroups(gs);
  render();
  shortcutModal.classList.add('hidden');
});

shortcutModal.addEventListener('click', (e) => {
  if (e.target === shortcutModal) shortcutModal.classList.add('hidden');
});

// ── Group modal ───────────────────────────────────────────────────────────────

const groupModal = document.getElementById('group-modal');
const groupNameInput = document.getElementById('group-name');

function openGroupModal() {
  groupNameInput.value = '';
  groupModal.classList.remove('hidden');
  groupNameInput.focus();
}

document.getElementById('group-cancel').addEventListener('click', () => {
  groupModal.classList.add('hidden');
});

document.getElementById('group-save').addEventListener('click', () => {
  const name = groupNameInput.value.trim();
  if (!name) return;
  const gs = loadGroups();
  const color = GROUP_COLORS[gs.length % GROUP_COLORS.length];
  gs.push({ id: Date.now(), name, color, shortcuts: [] });
  saveGroups(gs);
  setActiveGroup(gs.length - 1);
  render();
  groupModal.classList.add('hidden');
});

groupModal.addEventListener('click', (e) => {
  if (e.target === groupModal) groupModal.classList.add('hidden');
});

render();

// ── Weather ───────────────────────────────────────────────────────────────────

const WEATHER_CACHE_KEY = 'mypage_weather';
const WEATHER_TTL = 30 * 60 * 1000; // 30 min

function wmoEmoji(code) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}

async function fetchWeatherData(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current_weather=true&hourly=temperature_2m,precipitation_probability,weathercode` +
    `&forecast_days=2&timezone=auto`;
  const res = await fetch(url);
  return res.json();
}

function renderWeather(data) {
  const cw = data.current_weather;
  const hourly = data.hourly;

  // Find the index for the current hour using local time
  const now = new Date();
  const localStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-') + 'T' + String(now.getHours()).padStart(2, '0');
  let idx = hourly.time.findIndex(t => t.startsWith(localStr));
  if (idx < 0) idx = 0;

  // Build forecast points: Now, +6h, +12h, +18h, +24h
  const offsets = [0, 6, 12, 18, 24];
  const points = offsets.map(h => {
    const i = idx + h;
    const hour = parseInt((hourly.time[i] ?? hourly.time[idx]).slice(11, 13));
    return {
      label: `${hour}時`,
      emoji: wmoEmoji(h === 0 ? cw.weathercode : (hourly.weathercode[i] ?? cw.weathercode)),
      temp: Math.round(h === 0 ? cw.temperature : (hourly.temperature_2m[i] ?? cw.temperature)),
      precip: h === 0 ? (hourly.precipitation_probability[idx] ?? 0) : (hourly.precipitation_probability[i] ?? 0),
    };
  });

  // Summary: current + 24h
  const p24 = points[4];
  document.getElementById('weather-text').textContent =
    `${points[0].emoji} ${points[0].temp}°C → ${p24.emoji} ${p24.temp}°C 💧${p24.precip}%`;

  // Detail panel
  document.getElementById('weather-panel').innerHTML = points.map(p => `
    <div class="forecast-col">
      <span class="forecast-label">${p.label}</span>
      <span class="forecast-emoji">${p.emoji}</span>
      <span class="forecast-temp">${p.temp}°C</span>
      <span class="forecast-precip">💧${p.precip}%</span>
    </div>
  `).join('');
}

async function initWeather() {
  const textEl = document.getElementById('weather-text');

  // Use cache if fresh
  const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
  if (cached && Date.now() - cached.ts < WEATHER_TTL) {
    renderWeather(cached.data);
    return;
  }

  textEl.textContent = 'loading...';

  if (!navigator.geolocation) {
    textEl.textContent = 'unavailable';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const { latitude: lat, longitude: lng } = coords;
      console.log('[location] current:', lat, lng);
      localStorage.setItem('userLocation', JSON.stringify({ lat, lng, ts: Date.now() }));
      // Notify status.js that fresh location is now available
      if (typeof window.onLocationReady === 'function') window.onLocationReady();
      try {
        const data = await fetchWeatherData(lat, lng);
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        renderWeather(data);
      } catch {
        textEl.textContent = 'unavailable';
      }
    },
    () => { textEl.textContent = 'location denied'; }
  );
}

document.getElementById('weather-summary').addEventListener('click', () => {
  document.getElementById('weather-panel').classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!document.getElementById('weather-widget').contains(e.target)) {
    document.getElementById('weather-panel').classList.add('hidden');
  }
});

initWeather();

// ── Search suggestions ────────────────────────────────────────────────────────

const searchInput = document.querySelector('.search-input');
const suggestions = document.querySelector('.search-suggestions');
let activeIndex = -1;

function fetchSuggestions(query) {
  if (!query) { closeSuggestions(); return; }

  // Clean up any previous JSONP script/callback
  const prev = document.getElementById('__suggest_script');
  if (prev) prev.remove();
  if (window.__suggestCallback) delete window.__suggestCallback;

  window.__suggestCallback = (data) => {
    delete window.__suggestCallback;
    showSuggestions(data[1] || []);
  };

  const script = document.createElement('script');
  script.id = '__suggest_script';
  script.src = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}&callback=__suggestCallback`;
  script.onerror = () => { closeSuggestions(); };
  document.head.appendChild(script);
}

function showSuggestions(items) {
  suggestions.innerHTML = '';
  activeIndex = -1;
  if (!items.length) { closeSuggestions(); return; }
  items.slice(0, 6).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    li.addEventListener('mousedown', () => {
      searchInput.value = item;
      searchInput.form.submit();
    });
    suggestions.appendChild(li);
  });
  suggestions.classList.add('open');
}

function closeSuggestions() {
  suggestions.classList.remove('open');
  activeIndex = -1;
}

let debounceTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchSuggestions(searchInput.value.trim()), 200);
});

searchInput.addEventListener('keydown', (e) => {
  const items = suggestions.querySelectorAll('li');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[activeIndex]?.classList.remove('active');
    activeIndex = (activeIndex + 1) % items.length;
    items[activeIndex].classList.add('active');
    searchInput.value = items[activeIndex].textContent;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    items[activeIndex]?.classList.remove('active');
    activeIndex = (activeIndex - 1 + items.length) % items.length;
    items[activeIndex].classList.add('active');
    searchInput.value = items[activeIndex].textContent;
  } else if (e.key === 'Escape') {
    closeSuggestions();
  }
});

searchInput.addEventListener('blur', () => setTimeout(closeSuggestions, 150));

// ── Init news on page load ────────────────────────────────────────────────────

initNews();

// ── Claude bar ────────────────────────────────────────────────────────────────

document.getElementById('claude-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('claude-input');
  const q = input.value.trim();
  if (!q) return;
  window.location.href = `https://claude.ai/new?q=${encodeURIComponent(q)}`;
  input.value = '';
});
