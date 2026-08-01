// ── Weather ───────────────────────────────────────────────────────────────────

const WEATHER_CACHE_KEY = 'mypage_weather';
const WEATHER_TTL = 30 * 60 * 1000;
const LOCATION_TTL = 60 * 60 * 1000;

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
    `&daily=precipitation_probability_max` +
    `&forecast_days=2&timezone=auto`;
  const res = await fetch(url);
  return res.json();
}

function renderWeather(data) {
  const cw = data.current_weather;
  const hourly = data.hourly;
  const daily = data.daily;

  const now = new Date();
  const localStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-') + 'T' + String(now.getHours()).padStart(2, '0');
  let idx = hourly.time.findIndex(t => t.startsWith(localStr));
  if (idx < 0) idx = 0;

  const offsets = [0, 6, 12, 18, 24];
  const points = offsets.map(h => {
    const i = idx + h;
    const hour = parseInt((hourly.time[i] ?? hourly.time[idx]).slice(11, 13));
    return {
      label: `${hour}:00`,
      emoji: wmoEmoji(h === 0 ? cw.weathercode : (hourly.weathercode[i] ?? cw.weathercode)),
      temp: Math.round(h === 0 ? cw.temperature : (hourly.temperature_2m[i] ?? cw.temperature)),
      precip: h === 0 ? (hourly.precipitation_probability[idx] ?? 0) : (hourly.precipitation_probability[i] ?? 0),
    };
  });

  const tomorrowRain = daily && daily.precipitation_probability_max
    ? (daily.precipitation_probability_max[1] ?? 0) >= 40
    : false;

  const p24 = points[4];
  const tomorrowRainStr = tomorrowRain ? ' ☂☂☂' : '';
  document.getElementById('weather-text').innerHTML =
    `${points[0].emoji} ${points[0].temp}°C → ${p24.emoji} ${p24.temp}°C<br>💧${p24.precip}%${tomorrowRainStr}`;

  document.getElementById('weather-panel').innerHTML = points.map(p => `
    <div class="forecast-col">
      <span class="forecast-label">${p.label}</span>
      <span class="forecast-emoji">${p.emoji}</span>
      <span class="forecast-temp">${p.temp}°C</span>
      <span class="forecast-precip">💧${p.precip}%</span>
    </div>
  `).join('');
}

async function runLocationDetect() {
  if (typeof detectExpandedSections === 'function') {
    await detectExpandedSections();
  }
  if (typeof window.onLocationReady === 'function') window.onLocationReady();
}

async function initWeather() {
  const textEl = document.getElementById('weather-text');

  const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
  if (cached && Date.now() - cached.ts < WEATHER_TTL && cached.data.daily) {
    renderWeather(cached.data);
    runLocationDetect();
    return;
  }

  const cachedLoc = JSON.parse(localStorage.getItem('userLocation') || 'null');
  if (cachedLoc && cachedLoc.lat && cachedLoc.lng && Date.now() - cachedLoc.ts < LOCATION_TTL) {
    textEl.textContent = 'loading...';
    await runLocationDetect();
    try {
      const data = await fetchWeatherData(cachedLoc.lat, cachedLoc.lng);
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      renderWeather(data);
    } catch {
      textEl.textContent = 'unavailable';
    }
    return;
  }

  textEl.textContent = 'loading...';

  if (!navigator.geolocation) {
    textEl.textContent = 'unavailable';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const { latitude: lat, longitude: lng } = coords;
      localStorage.setItem('userLocation', JSON.stringify({ lat, lng, ts: Date.now() }));
      await runLocationDetect();
      try {
        const data = await fetchWeatherData(lat, lng);
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

// ── Init news on page load ────────────────────────────────────────────────────

initNews();
