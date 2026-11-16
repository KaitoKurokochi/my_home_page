// Open/close toggle for the news and sports sections; the closed ones are remembered per browser.

const COLLAPSED_SECTIONS_KEY = 'collapsedSections';

const COLLAPSIBLE_SECTIONS = [
  { id: 'news',       headerSelector: '.news-header' },
  { id: 'sports-npb', headerSelector: '.sports-section-header' },
  { id: 'sports-mlb', headerSelector: '.sports-section-header' },
  { id: 'sports-pl',  headerSelector: '.sports-section-header' },
  { id: 'sports-f1',  headerSelector: '.sports-section-header' },
  { id: 'sports-other', headerSelector: '.sports-section-header' },
];

function loadCollapsedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_SECTIONS_KEY)) || []);
  } catch (e) {
    return new Set();
  }
}

function saveCollapsedIds(ids) {
  try {
    localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...ids]));
  } catch (e) { /* storage blocked: the section just reopens next load */ }
}

function setSectionCollapsed(section, button, collapsed) {
  section.classList.toggle('collapsed', collapsed);
  button.setAttribute('aria-expanded', String(!collapsed));
  button.title = collapsed ? '開く' : '閉じる';
}

function initCollapsibleSections() {
  const collapsedIds = loadCollapsedIds();

  for (const { id, headerSelector } of COLLAPSIBLE_SECTIONS) {
    const section = document.getElementById(id);
    const header = section && section.querySelector(headerSelector);
    if (!header) continue;

    section.classList.add('collapsible');
    header.classList.add('collapse-head');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'collapse-toggle';
    setSectionCollapsed(section, button, collapsedIds.has(id));
    button.addEventListener('click', () => {
      const collapsed = !section.classList.contains('collapsed');
      setSectionCollapsed(section, button, collapsed);
      if (collapsed) collapsedIds.add(id); else collapsedIds.delete(id);
      saveCollapsedIds(collapsedIds);
    });
    header.prepend(button);
  }
}

document.addEventListener('DOMContentLoaded', initCollapsibleSections);
