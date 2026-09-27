// ── Location-based default label ──────────────────────────────────────────────
//
// Detects the current location zone using Nominatim reverse geocoding and the
// same zone config as the desktop (agent/my_home_page/location_zones.json).
// Sets window.defaultLabelForZone before renderForm() is called so that the
// form can pre-select the appropriate label.
//
// Zone → default label mapping:
//   univ      → Research
//   home      → living
//   lions_is  → Lions IS
//   (other)   → general

(function () {
  const ZONE_LABEL_MAP = {
    univ:     'Research',
    home:     'living',
    lions_is: 'Lions IS',
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
      const res = await fetch(
        `https://api.github.com/repos/KaitoKurokochi/vault/contents/my_home_page/runtime/location_zones.json`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            ...(localStorage.getItem('NOTE_TOKEN')
              ? { 'Authorization': `Bearer ${localStorage.getItem('NOTE_TOKEN')}` }
              : {}),
          },
        }
      );
      if (!res.ok) return [];
      const meta = await res.json();
      const text = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))));
      return JSON.parse(text);
    } catch (_) {
      return [];
    }
  }

  async function detectZone() {
    // 1. Get current GPS position
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      });
    });
    const { latitude: lat, longitude: lng } = pos.coords;

    // 2. Reverse geocode via Nominatim
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

    // 3. Match against zone config
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
      const label = (zoneName && ZONE_LABEL_MAP[zoneName]) || DEFAULT_LABEL;
      window.defaultLabelForZone = label;
      // Expose zone name for other modules (e.g. report.js auto-expand logic).
      window.currentZone = zoneName || null;
      // If the form is already rendered, update the pill selection.
      // selectLabelPill is defined in app.js and only changes the UI highlight.
      if (typeof selectLabelPill === 'function') {
        selectLabelPill(label);
      }
      // If report is already rendered, re-apply domain auto-expand.
      if (typeof reapplyReportAutoExpand === 'function') {
        reapplyReportAutoExpand();
      }
    } catch (_) {
      // Location unavailable — leave window.defaultLabelForZone undefined
    }
  }

  init();
})();
