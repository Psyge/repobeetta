
// ===============================
// Aurora/RepoTracker main script
// ===============================

let map;
let auroraLayer = null;        // array of overlays
let userMarker = null;
let currentData = null;        // NOAA JSON

// ------------------------------
// Weather from Cloudflare Worker
// ------------------------------
async function getWeather(lat, lon) {
  const url = `https://repotracker.masto84.workers.dev/?lat=${lat}&lon=${lon}`;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      temp: Math.round(data.main.temp),
      feels: Math.round(data.main.feels_like),
      wind: data.wind.speed,
      desc: data.weather[0]?.description ?? '',
      icon: data.weather[0]?.icon ?? '01d',
      clouds: data.clouds?.all ?? 100
    };
  } catch (err) {
    console.error('Weather fetch error:', err);
    return null;
  }
}

// ----------------------------------------------
// Places loader (kohteet/index.json + per-kohde)
// ----------------------------------------------
async function loadPlaces() {
  try {
    const res = await fetch('kohteet/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('index.json ei löydy');
    const manifest = await res.json();
    const files = Array.isArray(manifest.files) ? manifest.files : [];

    const loaded = await Promise.all(
      files.map(async (file) => {
        const metaRes = await fetch(`kohteet/${file}`, { cache: 'no-cache' });
        if (!metaRes.ok) throw new Error(`Virhe ladattaessa ${file}`);
        const meta = await metaRes.json();

        // Tuki joko suoraan JSON "description" -kentälle tai erilliselle HTML-tiedostolle "descriptionFile"
        let description = meta.description || '';
        if (!description && meta.descriptionFile) {
          const htmlRes = await fetch(`kohteet/${meta.descriptionFile}`, { cache: 'no-cache' });
          description = htmlRes.ok ? await htmlRes.text() : '';
        }

        return {
          name: meta.name,
          lat: meta.lat,
          lon: meta.lon,
          url: meta.url || '',
          icon: meta.icon || 'images/iconi.png',
          short: meta.short || '',
          description: description || '',
          stream: meta.stream || '',
          streamWidth: meta.streamWidth || 320,
          streamHeight: meta.streamHeight || 180
        };
      })
    );

    return loaded;
  } catch (e) {
    console.error('Paikkojen lataus epäonnistui:', e);
    return [];
  }
}

// ------------------------------------
// "Read more" -paneeli (place-info DIV)
// ------------------------------------
function showPlaceInfo(place) {
  const defaultSection = document.getElementById('aurora-default');
  const infoSection = document.getElementById('place-info');

  if (defaultSection) defaultSection.style.display = 'none';
  if (infoSection) infoSection.style.display = 'block';

  const linkHtml = place.url
    ? `<p>${place.url}Visit website</a></p>`
    : '';

  const streamHtml = place.stream
    ? `${place.stream}</iframe>`
    : '';

  if (infoSection) {
    infoSection.innerHTML = `
      ${place.description || ''}
      ${linkHtml}
      ${streamHtml}
      <button id="back-to-default" style="margin-top:15px;">Back to instructions</button>
    `;
    infoSection.scrollIntoView({ behavior: 'smooth' });
  }

  const backBtn = document.getElementById('back-to-default');
  if (backBtn) {
    backBtn.onclick = () => {
      if (infoSection) infoSection.style.display = 'none';
      if (defaultSection) defaultSection.style.display = 'block';
      if (defaultSection) defaultSection.scrollIntoView({ behavior: 'smooth' });
    };
  }
}

// -------------------------
// Leaflet markerit + popup
// -------------------------

// ---------------------
// Karttaklikki → popup
// ---------------------
async function onMapClick(e) {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  await showAuroraPopup(lat, lon, null, true);
}

// ---------------------
// App init / Leaflet
// ---------------------
async function initApp() {
  if (typeof L === 'undefined') return console.error('Leaflet not loaded');

  map = L.map('map', { center: [65, 25], zoom: 4, minZoom: 2, maxZoom: 15 });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);
  map.setMaxBounds([[-90, -180], [90, 180]]);
  map.on('drag', () => map.panInsideBounds([[-90, -180], [90, 180]], { animate: false }));

  map.on('click', onMapClick);

  initButtons();

  // Lataa paikat ja luo markerit
  const places = await loadPlaces();
  if (places.length === 0) {
    console.warn('Ei kohteita manifestista: lisää /kohteet/index.json ja per-kohde tiedostot.');
  }
  initMarkers(map, getWeather, showPlaceInfo, places);

  // NOAA-data
  fetchAuroraData();
  setInterval(fetchAuroraData, 5 * 60 * 1000);
}

// ---------------------------------------
// Auroran mahdollisuus -popup valitusta
// ---------------------------------------
async function showAuroraPopup(lat, lon, marker = null, showGoogleMapsLink = true) {
  let score = 0;
  let auroraIntensity = 0;

  // Lähin piste intensiteeteistä
  if (currentData && Array.isArray(currentData.coordinates)) {
    let nearest = null, minDist = Infinity;
    currentData.coordinates.forEach((p) => {
      let pointLon = p[0] < 0 ? p[0] + 360 : p[0];
      const pointLat = p[1], intensity = p[2];
      const dist = Math.hypot(pointLat - lat, Math.abs(pointLon - lon));
      if (dist < minDist) { minDist = dist; nearest = intensity; }
    });
    auroraIntensity = nearest || 0;
    if (auroraIntensity > 60) score += 2;
    else if (auroraIntensity > 30) score += 1;
  }

  // Sää (pilvisyys)
  const weather = await getWeather(lat, lon);
  const clouds = weather ? weather.clouds : 100;
  if (clouds < 30) score += 2;
  else if (clouds < 60) score += 1;

  // Liikennevalostatus
  let statusEmoji = '🔴', statusText = 'Low chance';
  if (score >= 3) { statusEmoji = '🟢'; statusText = 'High chance!'; }
  else if (score === 2) { statusEmoji = '🟡'; statusText = 'Moderate chance'; }

  let popupContent = `
    <strong>Your Northern Lights chance is now:</strong><br>
    ${statusEmoji} ${statusText}<br>
    Aurora intensity: ${auroraIntensity.toFixed(1)}<br>
    Clouds: ${clouds}%<br>
    Temp: ${weather ? weather.temp + '°C' : 'N/A'}
  `;

  if (showGoogleMapsLink) {
    popupContent += `<br><strong>Coordinates:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}<br>
      <a href="https://www.google.com/maps?q=${lat},${lon}">Open in Google Maps</a>`;
  }

  if (marker) {
    marker.setLatLng([lat, lon]).bindPopup(popupContent).openPopup();
  } else {
    L.popup().setLatLng([lat, lon]).setContent(popupContent).openOn(map);
  }
}

// ------------------------
// UI-painikkeiden init
// ------------------------
function initButtons() {
  const helpPopup = document.getElementById('help-popup');
  const closePopupBtn = document.getElementById('close-popup');
  const dontShowAgainCheckbox = document.getElementById('dont-show-again');
  const showHelpLink = document.getElementById('show-help');

  if (helpPopup && !localStorage.getItem('hideHelpPopup')) {
    helpPopup.style.display = 'flex';
  }
  if (closePopupBtn) {
    closePopupBtn.addEventListener('click', () => {
      if (dontShowAgainCheckbox && dontShowAgainCheckbox.checked) {
        localStorage.setItem('hideHelpPopup', 'true');
      }
      if (helpPopup) helpPopup.style.display = 'none';
    });
  }
  if (showHelpLink && helpPopup) {
    showHelpLink.addEventListener('click', (e) => {
      e.preventDefault();
      helpPopup.style.display = 'flex';
    });
  }

  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => {
      menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
    });
  }

  const forecastBtn = document.getElementById('forecast-btn');
  const forecastPopup = document.getElementById('forecast-popup');
  const closeForecast = document.getElementById('close-forecast');
  if (forecastBtn && forecastPopup) {
    forecastBtn.addEventListener('click', async () => {
      forecastPopup.style.display = 'flex';
      await ensureChartJs();
      fetchAuroraForecast();
    });
  }
  if (closeForecast && forecastPopup) {
    closeForecast.addEventListener('click', () => {
      forecastPopup.style.display = 'none';
    });
  }

  const locateBtn = document.getElementById('locate-btn');
  if (locateBtn) {
    locateBtn.addEventListener('click', async () => {
      if (!navigator.geolocation) {
        alert('Geolocation not supported in this browser.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          map.setView([lat, lon], 6);
          if (!userMarker) userMarker = L.marker([lat, lon]).addTo(map);
          await showAuroraPopup(lat, lon, userMarker, false);
        },
        (err) => alert('Location failed: ' + err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }
}

// ------------------------
// NOAA (Ovation) overlay
// ------------------------
async function fetchAuroraData() {
  const info = document.getElementById('info');
  if (!info) return;
  info.className = 'loading';
  info.innerHTML = '⏳ Loading northern lights forecast...';

  const directUrl = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
  const proxyUrl = 'https://corsproxy.io/?' + directUrl;

  try {
    const res = await fetch(directUrl, { cache: 'no-cache' }).catch(() => fetch(proxyUrl, { cache: 'no-cache' }));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.coordinates || !Array.isArray(data.coordinates)) throw new Error('Invalid data format.');
    currentData = data;

    const obsTime = new Date(data['Observation Time']).toLocaleString();
    const forecastTime = new Date(data['Forecast Time']).toLocaleString();
    info.className = '';
    info.innerHTML = `<strong>📡 Northern Lights forecast</strong><br><small>Observation: ${obsTime}<br>Forecast: ${forecastTime}<br>Points: ${data.coordinates.length}</small>`;

    drawAuroraOverlay(data.coordinates);
  } catch (err) {
    console.error('Aurora data error', err);
    info.className = 'error';
    info.innerHTML = `<strong>❌ Error</strong><br><small>No northern lights forecast available.<br>${err.message}</small>`;
  }
}

function drawAuroraOverlay(points) {
  if (!map) return;

  // Poista vanhat overlayt
  if (auroraLayer) auroraLayer.forEach((l) => map.removeLayer(l));
  auroraLayer = [];

  const canvasWidth = 3600, canvasHeight = 500;

  const createCanvasOverlay = (xOffset = 0) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth; canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    points.forEach((p) => {
      let lon = p[0]; if (lon < 0) lon += 360;
      const lat = p[1], intensity = p[2]; if (intensity < 1) return;
      const x = ((lon + 180) / 360) * canvasWidth + xOffset;
      const y = ((90 - lat) / 50) * canvasHeight;
      const radius = Math.min(60, Math.max(10, intensity * 3));
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(50,255,100,${Math.min(0.3, intensity / 10)})`);
      grad.addColorStop(0.5, `rgba(0,200,100,${Math.min(0.1, intensity / 15)})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    });

    const bounds = [[40, -180], [90, 180]];
    const overlay = L.imageOverlay(canvas.toDataURL(), bounds, { opacity: 0.75 }).addTo(map);
    auroraLayer.push(overlay); // tallenna overlay arrayhin
  };

  // Wrap-around kolmella kopioinnilla
  createCanvasOverlay(0);
  createCanvasOverlay(-canvasWidth);
  createCanvasOverlay(canvasWidth);
}

// ------------------------
// Chart.js latausvarmistus
// ------------------------
function ensureChartJs() {
  return new Promise((resolve) => {
    if (window.Chart) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => resolve();
    script.onerror = () => {
      console.error('Chart.js load failed');
      resolve(); // ei estä UI:ta, mutta kaavio ei piirry
    };
    document.head.appendChild(script);
  });
}

// ------------------------
// Forecast (3-day) kaavio
// ------------------------
async function fetchAuroraForecast() {
  try {
    const response = await fetch('https://services.swpc.noaa.gov/text/3-day-forecast.txt', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Verkkovirhe: ${response.status}`);
    const text = await response.text();

    const today = new Date();
    const dayLabels = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dayLabels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    }

    const kpRegex = /[ \t]*(\d{2}-\d{2}UT)[ \t]+([\d\.\(\)G \t]+)/g;
    const times = [], day1 = [], day2 = [], day3 = [];
    let match;
    while ((match = kpRegex.exec(text)) !== null) {
      const time = match[1].trim();
      const clean = match[2].replace(/\(G\d\)/g, '').replace(/[ \t]+/g, ' ').trim();
      const values = clean.split(' ').map(Number);
      if (values.length === 3 && values.every((v) => !isNaN(v))) {
        times.push(time); day1.push(values[0]); day2.push(values[1]); day3.push(values[2]);
      }
    }
    if (times.length === 0) throw new Error('Kp values not found.');

    const ctxElement = document.getElementById('kpChart');
    if (!ctxElement || !window.Chart) return; // Chart.js ei käytettävissä

    const ctx = ctxElement.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: times,
        datasets: [
          { label: dayLabels[0], data: day1, borderColor: '#007bff', pointBackgroundColor: day1.map(kp => kp < 3 ? 'green' : kp < 5 ? 'orange' : 'red'), pointRadius: 6, tension: 0.3 },
          { label: dayLabels[1], data: day2, borderColor: '#6f42c1', pointBackgroundColor: day2.map(kp => kp < 3 ? 'green' : kp < 5 ? 'orange' : 'red'), pointRadius: 6, tension: 0.3 },
          { label: dayLabels[2], data: day3, borderColor: '#20c997', pointBackgroundColor: day3.map(kp => kp < 3 ? 'green' : kp < 5 ? 'orange' : 'red'), pointRadius: 6, tension: 0.3 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Northern Lights forecast (NOAA)' },
          tooltip: {
            callbacks: {
              label: function (context) {
                const kp = context.parsed.y;
                if (kp >= 5) return `Kp ${kp} - High chance`;
                if (kp >= 3) return `Kp ${kp} - Moderate chance`;
                return `Kp ${kp} - Low chance`;
              }
            }
          }
        },
        scales: {
          y: { min: 0, max: 9, title: { display: true, text: 'Kp Index' } },
          x: { title: { display: true, text: 'UT Time (3h intervals)' } }
        }
      }
    });

  } catch (error) {
    console.error('Error fetching NOAA forecast:', error);
    const container = document.getElementById('errorMessage');
    if (container) {
      container.textContent = '⚠️ Error downloading NOAA data: ' + error.message;
      container.style.color = 'red';
      container.style.fontWeight = 'bold';
    }
  }
}

// ------------------------
// Käynnistys
// ------------------------
document.addEventListener('DOMContentLoaded', initApp);
