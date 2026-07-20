// ── Location zones — section expand/collapse control ─────────────────────────
//
// Config is fetched from agent/my_home_page/runtime/location_zones.json (pushed by assembler.py).
// Each zone entry supports two matching strategies (evaluated in order):
//
//   address_fields: { <field>: <value>, ... }
//     Exact match against Nominatim address fields (e.g. quarter, suburb).
//     A zone matches when ALL specified fields match exactly.
//     This is the preferred strategy — use it to avoid false positives.
//
//   place_names: [...]
//     Keyword substring match against display_name and address fields.
//     A zone matches when ANY keyword is found as a substring.
//     Use this only when exact field matching is not possible.
//
// Zones are evaluated in the order they appear in the JSON.
// The first matching zone wins — put more specific zones (e.g. home) first.
//
// sections: section keys to expand by default at this location.
// If location is unavailable or no zone matches, ALL sections are expanded (fallback).

// Depends on: js/config.js (githubFetch)

async function fetchLocationZones() {
  try {
    const text = await githubFetch('my_home_page/runtime/location_zones.json');
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// Returns true if the zone's address_fields all match the given addr object.
// Each field value can be a string (exact match) or an array (matches if any element equals the addr value).
function matchAddressFields(zone, addr) {
  const fields = zone.address_fields;
  if (!fields || Object.keys(fields).length === 0) return false;
  return Object.entries(fields).every(([key, val]) => {
    if (Array.isArray(val)) return val.includes(addr[key]);
    return addr[key] === val;
  });
}

// Returns true if any place_names keyword appears as a substring of matchText.
function matchPlaceNames(zone, matchText) {
  const keywords = zone.place_names || [];
  if (keywords.length === 0) return false;
  return keywords.some(kw => matchText.includes(kw));
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
  let addr, matchText;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json&accept-language=ja`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MyHomePage/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    addr = data.address || {};

    // Build matchText for keyword (place_names) matching.
    // data.name is often empty for Japanese addresses, so we join multiple fields.
    const parts = [
      data.name,
      data.display_name,
      addr.amenity,
      addr.tourism,
      addr.building,
      addr.road,
      addr.neighbourhood,
      addr.quarter,
      addr.suburb,
      addr.city_district,
      addr.town,
      addr.city,
    ].filter(Boolean);
    matchText = parts.join(' ');
  } catch {
    return null;
  }

  // 3. Load zones from my_notes and match.
  // Zones are evaluated in order; the first match wins.
  // Priority: address_fields (exact) > place_names (substring).
  const zones = await fetchLocationZones();
  for (const zone of zones) {
    const matched =
      matchAddressFields(zone, addr) ||
      matchPlaceNames(zone, matchText);

    if (matched) {
      const label = zone.label || zone.name;
      const locEl = document.getElementById('current-location');
      if (locEl) locEl.textContent = '📍 ' + label;
      // Expose the matched zone name globally so other modules can react.
      window.currentZone = zone.name;
      return new Set(zone.sections || []);
    }
  }

  return null;
}
