// ── Edit dropdown ─────────────────────────────────────────────────────────────

let _activeDropdown = null;

function closeDropdown() {
  if (_activeDropdown) { _activeDropdown.remove(); _activeDropdown = null; }
}

document.addEventListener('click', closeDropdown);

function showDropdown(anchor, items, onSelect) {
  closeDropdown();
  const rect = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'note-edit-dropdown';
  el.style.top = `${rect.bottom + window.scrollY + 4}px`;
  el.addEventListener('click', e => e.stopPropagation());
  items.forEach(({ label, value, danger }) => {
    const row = document.createElement('div');
    row.className = 'note-edit-dropdown-item' + (danger ? ' note-edit-dropdown-item--danger' : '');
    row.textContent = label;
    row.addEventListener('click', () => { closeDropdown(); onSelect(value); });
    el.appendChild(row);
  });
  document.body.appendChild(el);
  // Adjust horizontal position: align left edge to anchor, but clamp so the
  // dropdown does not overflow the right edge of the viewport.
  const elWidth = el.getBoundingClientRect().width;
  const viewportWidth = document.documentElement.clientWidth;
  const preferredLeft = rect.left + window.scrollX;
  const maxLeft = viewportWidth + window.scrollX - elWidth - 4;
  el.style.left = `${Math.min(preferredLeft, maxLeft)}px`;
  _activeDropdown = el;
}
