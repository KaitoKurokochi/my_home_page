// Shortcuts
const SHORTCUTS_KEY = 'mypage_shortcuts';

function loadShortcuts() {
  return JSON.parse(localStorage.getItem(SHORTCUTS_KEY) || '[]');
}

function saveShortcuts(shortcuts) {
  localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));
}

function faviconUrl(url) {
  try {
    const origin = new URL(url).origin;
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=64`;
  } catch {
    return '';
  }
}

function renderShortcuts() {
  const grid = document.getElementById('shortcuts-grid');
  const shortcuts = loadShortcuts();
  grid.innerHTML = '';
  shortcuts.forEach((s, i) => {
    const a = document.createElement('a');
    a.className = 'shortcut-item';
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `
      <div class="shortcut-icon"><img src="${faviconUrl(s.url)}" alt="" /></div>
      <span class="shortcut-label">${s.name}</span>
      <span class="shortcut-remove" data-index="${i}">✕</span>
    `;
    a.querySelector('.shortcut-remove').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const list = loadShortcuts();
      list.splice(i, 1);
      saveShortcuts(list);
      renderShortcuts();
    });
    grid.appendChild(a);
  });
}

const modal = document.getElementById('shortcut-modal');
const nameInput = document.getElementById('shortcut-name');
const urlInput = document.getElementById('shortcut-url');

document.getElementById('shortcut-add-btn').addEventListener('click', () => {
  nameInput.value = '';
  urlInput.value = '';
  modal.classList.remove('hidden');
  nameInput.focus();
});

document.getElementById('shortcut-cancel').addEventListener('click', () => {
  modal.classList.add('hidden');
});

document.getElementById('shortcut-save').addEventListener('click', () => {
  const name = nameInput.value.trim();
  let url = urlInput.value.trim();
  if (!name || !url) return;
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;
  const list = loadShortcuts();
  list.push({ name, url });
  saveShortcuts(list);
  renderShortcuts();
  modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

renderShortcuts();

// Search suggestions
const searchInput = document.querySelector('.search-input');
const suggestions = document.querySelector('.search-suggestions');
let activeIndex = -1;

async function fetchSuggestions(query) {
  if (!query) { closeSuggestions(); return; }
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    showSuggestions(data[1]);
  } catch {
    closeSuggestions();
  }
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

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(target).classList.add('active');
  });
});
