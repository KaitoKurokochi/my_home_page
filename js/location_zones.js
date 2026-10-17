// ── Location zones — GPS-to-zone-name detection ───────────────────────────────
//
// Zones come from agent/my_home_page/runtime/location_zones.json (static, maintained by hand).
// A zone matches by one of two strategies, evaluated in order:
//   address_fields: { <field>: <value>, ... } — exact match on Nominatim address fields (e.g.
//     quarter, suburb); ALL fields must match. Preferred, to avoid false positives.
//   place_names: [...] — keyword substring match against display_name and address fields; ANY
//     keyword matches. Use only when exact field matching is not possible.
// Zones are evaluated in JSON order and the first match wins: put specific zones (e.g. home) first.
//
// This file only resolves GPS coordinates to a zone NAME (window.currentZone). Which departments a
// zone covers comes from zone_departments.json (see shared/status-report-data.js's
// computeDepartmentSelection()).

// Depends on: shared/github-client.js (githubFetch)

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

// Resolves GPS coordinates to a zone name, exposing it as window.currentZone
// for computeDepartmentSelection() to react to. Returns the matched zone
// name, or null if location is unavailable or no zone matches.
async function detectExpandedSections() {
  let loc;
  try {
    const raw = localStorage.getItem('userLocation');
    if (!raw) return null;
    loc = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!loc?.lat || !loc?.lng) return null;

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

  const zones = await fetchLocationZones();
  for (const zone of zones) {
    const matched =
      matchAddressFields(zone, addr) ||
      matchPlaceNames(zone, matchText);

    if (matched) {
      const label = zone.label || zone.name;
      const locEl = document.getElementById('current-location');
      if (locEl) locEl.textContent = '📍 ' + label;
      window.currentZone = zone.name;
      return zone.name;
    }
  }

  return null;
}
