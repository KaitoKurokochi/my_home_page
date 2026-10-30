// ── Location ──────────────────────────────────────────────────────────────────

const LOCATION_TTL = 60 * 60 * 1000;

async function runLocationDetect() {
  if (typeof detectExpandedSections === 'function') {
    await detectExpandedSections();
  }
  if (typeof window.onLocationReady === 'function') window.onLocationReady();
}

async function initLocation() {
  const cachedLoc = JSON.parse(localStorage.getItem('userLocation') || 'null');
  if (cachedLoc && cachedLoc.lat && cachedLoc.lng && Date.now() - cachedLoc.ts < LOCATION_TTL) {
    await runLocationDetect();
    return;
  }

  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    const { latitude: lat, longitude: lng } = coords;
    localStorage.setItem('userLocation', JSON.stringify({ lat, lng, ts: Date.now() }));
    await runLocationDetect();
  });
}

initLocation();

// ── Init news on page load ────────────────────────────────────────────────────

initNews();
