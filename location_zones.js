// ── Location zones — section expand/collapse control ─────────────────────────
//
// Config is fetched from my_notes/location_zones.json (pushed by status_report.py).
// Each entry: { name, place_names: [...], sections: [...] }
//   place_names: exact match against Nominatim's "name" field
//   sections:    section keys to expand by default at this location
//
// If location is unavailable or no match, ALL sections are expanded (fallback).

async function fetchLocationZones() {
  try {
    const headers = { 'Accept': 'application/vnd.github+json' };
    const token = localStorage.getItem('NOTE_TOKEN') || '';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(
      `https://api.github.com/repos/KaitoKurokochi/my_notes/contents/location_zones.json`,
      { headers }
    );
    if (!res.ok) return [];
    const meta = await res.json();
    return JSON.parse(decodeURIComponent(escape(atob(meta.content.replace(/\n/g, '')))));
  } catch {
    return [];
  }
}

// Returns a Set of section keys to expand, or null (= expand all).
async function detectExpandedSections() {
  // 1. Get coordinates from localStorage (saved by app.js weather widget)
  let loc;
  try {
    const raw = localStorage.getItem('userLocation');
    if (!raw) return null;
    loc = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!loc?.lat || !loc?.lng) return null;

  // 2. Reverse geocode via Nominatim
  let placeName;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json&accept-language=ja`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MyHomePage/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    placeName = data.name || '';
    console.log('[location] Nominatim name:', placeName);
  } catch {
    return null;
  }

  // 3. Load zones from my_notes and match
  const zones = await fetchLocationZones();
  for (const zone of zones) {
    const names = zone.place_names || [];
    if (names.includes(placeName)) {
      const label = zone.label || zone.name;
      const locEl = document.getElementById('current-location');
      if (locEl) locEl.textContent = '📍 ' + label;
      const expanded = new Set(zone.sections || []);
      console.log('[location] matched:', zone.name, '/ expanded:', [...expanded]);
      return expanded;
    }
  }

  console.log('[location] no zone matched for:', placeName);
  return null;
}
