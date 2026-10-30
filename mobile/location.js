// ── Location-based default label ──────────────────────────────────────────────
//
// Detects the location zone (Nominatim reverse geocoding + the desktop's zone config) and sets
// window.defaultLabelForZone before renderForm(), so the form can pre-select a label.
// Zone → label: univ → Research, home → living, lions_is → Lions_IS, other zone → general;
// unknown zone → no pre-selection (as desktop).

(function () {
  const ZONE_LABEL_MAP = {
    univ:     'Research',
    home:     'living',
    lions_is: 'Lions_IS',
  };
  const DEFAULT_LABEL = 'General';

  function matchAddressFields(zone, addr) {
    const fields = zone.address_fields;
    if (!fields || Object.keys(fields).length === 0) return false;
    return Object.entries(fields).every(([key, val]) => {
      if (Array.isArray(val)) return val.includes(addr[key]);
      return addr[key] === val;
    });
  }

  function matchPlaceNames(zone, matchText) {
    const keywords = zone.place_names || [];
    if (keywords.length === 0) return false;
    return keywords.some(kw => matchText.includes(kw));
  }

  async function fetchLocationZones() {
    try {
      const text = await githubFetch('my_home_page/runtime/location_zones.json');
      return JSON.parse(text);
    } catch (_) {
      return [];
    }
  }

  // Same cache the desktop page's initLocation() uses (same origin → shared localStorage):
  // reuse coordinates younger than LOCATION_TTL so the GPS permission prompt
  // is not shown on every load.
  const LOCATION_TTL = 60 * 60 * 1000;

  async function getCoords() {
    try {
      const cached = JSON.parse(localStorage.getItem('userLocation') || 'null');
      if (cached && cached.lat && cached.lng && Date.now() - cached.ts < LOCATION_TTL) {
        return { lat: cached.lat, lng: cached.lng };
      }
    } catch (_) { /* fall through to a fresh fix */ }
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      });
    });
    const { latitude: lat, longitude: lng } = pos.coords;
    try {
      localStorage.setItem('userLocation', JSON.stringify({ lat, lng, ts: Date.now() }));
    } catch (_) { /* storage unavailable — still usable this load */ }
    return { lat, lng };
  }

  async function detectZone() {
    const { lat, lng } = await getCoords();

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`;
    const geoRes = await fetch(url, { headers: { 'User-Agent': 'MobileNote/1.0' } });
    if (!geoRes.ok) return null;
    const data = await geoRes.json();
    const addr = data.address || {};

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
    const matchText = parts.join(' ');

    const zones = await fetchLocationZones();
    for (const zone of zones) {
      if (matchAddressFields(zone, addr) || matchPlaceNames(zone, matchText)) {
        return zone.name;
      }
    }
    return null;
  }

  async function init() {
    try {
      const zoneName = await detectZone();
      // Like desktop: no pre-selection while the zone is unknown; a known zone
      // maps to its department label, falling back to General when unmapped.
      let label = null;
      if (zoneName) {
        const labels = await fetchDepartmentLabels();
        const want = ZONE_LABEL_MAP[zoneName] || DEFAULT_LABEL;
        label = labels.find(l => l.toLowerCase() === want.toLowerCase())
          || labels.find(l => l.toLowerCase() === DEFAULT_LABEL.toLowerCase())
          || null;
      }
      // Never override a label the user (or an @ mention) already chose.
      const applyLabel = label && !window.labelTouchedByUser;
      if (applyLabel) window.defaultLabelForZone = label;
      window.currentZone = zoneName || null;
      if (applyLabel && typeof selectLabelPill === 'function') {
        selectLabelPill(label);
      }
      if (typeof reapplyReportAutoExpand === 'function') {
        reapplyReportAutoExpand();
      }
    } catch (_) {
      // Location unavailable — leave window.defaultLabelForZone undefined
    }
  }

  init();
})();
