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
  renderShortcutsPanel();
}

function renderPills() {
  const container = document.getElementById('group-pills');
  const groups = loadGroups();
  container.innerHTML = '';

  // Clamp active index
  if (activeGroupIndex >= groups.length) {
    setActiveGroup(Math.max(0, groups.length - 1));
  }

  groups.forEach((group, gi) => {
    const btn = document.createElement('button');
    btn.className = 'group-pill' + (gi === activeGroupIndex ? ' active' : '');
    btn.style.setProperty('--color', group.color);
    btn.dataset.gi = gi;
    btn.innerHTML = `${group.name}<span class="pill-remove" data-gi="${gi}" title="Delete group">✕</span>`;

    btn.addEventListener('click', (e) => {
      if (e.target.classList.contains('pill-remove')) return;
      // Toggle: clicking the active group closes it
      setActiveGroup(gi === activeGroupIndex ? -1 : gi);
      render();
    });

    btn.querySelector('.pill-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      const gs = loadGroups();
      if (!confirm(`Delete group "${gs[gi].name}"?`)) return;
      gs.splice(gi, 1);
      saveGroups(gs);
      if (activeGroupIndex >= gs.length) setActiveGroup(Math.max(0, gs.length - 1));
      render();
    });

    container.appendChild(btn);
  });

  // Add group pill
  const addBtn = document.createElement('button');
  addBtn.className = 'add-group-pill';
  addBtn.textContent = '+ New group';
  addBtn.addEventListener('click', openGroupModal);
  container.appendChild(addBtn);
}

function renderShortcutsPanel() {
  const panel = document.getElementById('shortcuts-panel');
  const groups = loadGroups();
  panel.innerHTML = '';
  panel.classList.remove('empty');

  // Hide panel when no group is selected
  if (activeGroupIndex === -1 || !groups.length) {
    panel.style.display = 'none';
    if (!groups.length) {
      panel.style.display = '';
      panel.classList.add('empty');
      panel.textContent = 'Add a group to get started.';
    }
    return;
  }
  panel.style.display = '';

  const group = groups[activeGroupIndex];
  if (!group) return;

  let dragSrcIndex = null;

  group.shortcuts.forEach((s, si) => {
    const a = document.createElement('a');
    a.className = 'shortcut-item';
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.draggable = true;
    a.dataset.si = si;
    a.innerHTML = `
      <div class="shortcut-icon"><img src="${faviconUrl(s.url)}" alt="" /></div>
      <span class="shortcut-label">${s.name}</span>
      <span class="shortcut-remove" data-si="${si}">✕</span>
    `;

    // Remove
    a.querySelector('.shortcut-remove').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const gs = loadGroups();
      gs[activeGroupIndex].shortcuts.splice(si, 1);
      saveGroups(gs);
      render();
    });

    // Drag & drop
    a.addEventListener('dragstart', (e) => {
      dragSrcIndex = si;
      a.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    a.addEventListener('dragend', () => {
      a.classList.remove('dragging');
      panel.querySelectorAll('.shortcut-item').forEach(el => el.classList.remove('drag-over'));
    });
    a.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      panel.querySelectorAll('.shortcut-item').forEach(el => el.classList.remove('drag-over'));
      a.classList.add('drag-over');
    });
    a.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === si) return;
      const gs = loadGroups();
      const shots = gs[activeGroupIndex].shortcuts;
      const [moved] = shots.splice(dragSrcIndex, 1);
      shots.splice(si, 0, moved);
      saveGroups(gs);
      dragSrcIndex = null;
      render();
    });

    panel.appendChild(a);
  });

  // Add shortcut button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-shortcut-btn';
  addBtn.innerHTML = `
    <div class="add-shortcut-icon">+</div>
    <span class="add-shortcut-label">Add</span>
  `;
  addBtn.addEventListener('click', openShortcutModal);
  panel.appendChild(addBtn);
}

// ── Shortcut modal ────────────────────────────────────────────────────────────

const shortcutModal = document.getElementById('shortcut-modal');
const shortcutNameInput = document.getElementById('shortcut-name');
const shortcutUrlInput = document.getElementById('shortcut-url');

function openShortcutModal() {
  shortcutNameInput.value = '';
  shortcutUrlInput.value = '';
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
  gs[activeGroupIndex].shortcuts.push({ name, url });
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
      try {
        const data = await fetchWeatherData(coords.latitude, coords.longitude);
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

// ── Tab switching ─────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});
