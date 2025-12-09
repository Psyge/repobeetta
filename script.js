
let map;
let auroraLayer = null;
let userMarker = null;
let currentData = null;

// --- Get weather function ---
async function getWeather(lat, lon) {
  const url = `https://repotracker.masto84.workers.dev/?lat=${lat}&lon=${lon}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      temp: Math.round(data.main.temp),
      feels: Math.round(data.main.feels_like),
      wind: data.wind.speed,
      desc: data.weather[0].description,
      icon: data.weather[0].icon,
      clouds: data.clouds.all
    };
  } catch {
    return null;
  }
}

// --- Show place info ---

function showPlaceInfo(place) {
  const defaultSection = document.getElementById("aurora-default");
  const infoSection = document.getElementById("place-info");
  defaultSection.style.display = "none";
  infoSection.style.display = "block";

  infoSection.innerHTML = `
    ${place.description || ''}  <!-- suora HTML -->
    ${place.url ? `<p>${place.url}Visit website</a></p>` : ''}
    ${place.stream ? `${place.stream}</iframe>` : ''}
    <button id="back-to-default" style="margin-top:15px;">Back to instructions</button>
  `;

  infoSection.scrollIntoView({ behavior: "smooth" });
  document.getElementById("back-to-default").onclick = () => {
    infoSection.style.display = "none";
    defaultSection.style.display = "block";
    defaultSection.scrollIntoView({ behavior: "smooth" });
  };

}

// --- Handle map clicks ---
async function onMapClick(e) {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  await showAuroraPopup(lat, lon, null, true);
}

// --- Init map ---

async function initApp() {
  if (typeof L === 'undefined') return console.error("Leaflet not loaded");

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


  // Initialize markers if available
  
const places = await loadPlaces();
  if (places.length === 0) {
    console.warn('Ei kohteita manifestista: käytä tarvittaessa vanhaa places-taulukkoa.');
  }
  initMarkers(map, getWeather, showPlaceInfo, places);

  // --- NOAA-data ---
  fetchAuroraData();
  setInterval(fetchAuroraData, 5 * 60 * 1000);

}

// --- Show aurora popup ---
async function showAuroraPopup(lat, lon, marker = null, showGoogleMapsLink = true) {
  let score = 0;
  let auroraIntensity = 0;

  // Aurora intensity
  if (currentData && currentData.coordinates) {
    let nearest = null, minDist = Infinity;
    currentData.coordinates.forEach(p => {
      let pointLon = p[0] < 0 ? p[0] + 360 : p[0];
      const pointLat = p[1], intensity = p[2];
      const dist = Math.hypot(pointLat - lat, Math.abs(pointLon - lon));
      if (dist < minDist) { minDist = dist; nearest = intensity; }
    });
    auroraIntensity = nearest || 0;
    if (auroraIntensity > 60) score += 2;
    else if (auroraIntensity > 30) score += 1;
  }

  // Weather
  const weather = await getWeather(lat, lon);
  let clouds = weather ? weather.clouds : 100;
  if (clouds < 30) score += 2;
  else if (clouds < 60) score += 1;

  // Traffic light status
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
      <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" style="color:#1e88e5;">Open in Google Maps</a>`;
  }

  if (marker) {
    marker.setLatLng([lat, lon]).bindPopup(popupContent).openPopup();
  } else {
    L.popup().setLatLng([lat, lon]).setContent(popupContent).openOn(map);
  }
}

// --- Buttons ---
function initButtons() {
  const helpPopup = document.getElementById('help-popup');
  const closePopupBtn = document.getElementById('close-popup');
  const dontShowAgainCheckbox = document.getElementById('dont-show-again');
  const showHelpLink = document.getElementById('show-help');
  if (helpPopup && !localStorage.getItem('hideHelpPopup')) helpPopup.style.display = 'flex';
  if (closePopupBtn) closePopupBtn.addEventListener('click', () => {
    if (dontShowAgainCheckbox && dontShowAgainCheckbox.checked) localStorage.setItem('hideHelpPopup', 'true');
    helpPopup.style.display = 'none';
  });
  if (showHelpLink) showHelpLink.addEventListener('click', e => { e.preventDefault(); helpPopup.style.display = 'flex'; });

  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('menu');
  if (menuBtn && menu) menuBtn.addEventListener('click', () => { menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex'; });

  const forecastBtn = document.getElementById('forecast-btn');
  const forecastPopup = document.getElementById('forecast-popup');
  const closeForecast = document.getElementById('close-forecast');
  if (forecastBtn && forecastPopup) forecastBtn.addEventListener('click', () => { forecastPopup.style.display = 'flex'; fetchAuroraForecast(); });
  if (closeForecast && forecastPopup) closeForecast.addEventListener('click', () => { forecastPopup.style.display = 'none'; });

  const locateBtn = document.getElementById('locate-btn');
  if(locateBtn) {
    locateBtn.addEventListener("click", async () => {
      navigator.geolocation.getCurrentPosition(async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        map.setView([lat, lon], 6);
        if (!userMarker) userMarker = L.marker([lat, lon]).addTo(map);
        await showAuroraPopup(lat, lon, userMarker, false);
      }, err => alert("Location failed: " + err.message));
    });
  }
}

// --- Aurora NOAA ---
async function fetchAuroraData() {
  const info = document.getElementById("info");
  if (!info) return;
  info.className = 'loading';
  info.innerHTML = '⏳ Loading northern lights forecast...';

  const directUrl = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
  const proxyUrl = 'https://corsproxy.io/?' + directUrl;

  try {
    const res = await fetch(directUrl).catch(() => fetch(proxyUrl));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.coordinates || !Array.isArray(data.coordinates)) throw new Error("Invalid data format.");
    currentData = data;

    const obsTime = new Date(data["Observation Time"]).toLocaleString();
    const forecastTime = new Date(data["Forecast Time"]).toLocaleString();
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
  if (auroraLayer) auroraLayer.forEach(l => map.removeLayer(l));
  auroraLayer = [];

  const canvasWidth = 3600, canvasHeight = 500;
  const createCanvasOverlay = (xOffset = 0) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth; canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    points.forEach(p => {
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
    auroraLayer.push(overlay);
  };

  createCanvasOverlay(0);
  createCanvasOverlay(-canvasWidth);
  createCanvasOverlay(canvasWidth);
}

// --- Chart.js ---
const chartScript = document.createElement('script');
chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(chartScript);

// --- Forecast chart ---
async function fetchAuroraForecast() {
  try {
    const response = await fetch('https://services.swpc.noaa.gov/text/3-day-forecast.txt');
    if (!response.ok) throw new Error(`Verkkovirhe: ${response.status}`);
    const text = await response.text();
    const today = new Date(); 
    const dayLabels = [];
    for (let i = 0; i < 3; i++) { 
      const d = new Date(today); d.setDate(today.getDate() + i); 
      dayLabels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })); 
    }

    const kpRegex = /[ \t]*(\d{2}-\d{2}UT)[ \t]+([\d\.\(\)G \t]+)/g;
    const times = [], day1 = [], day2 = [], day3 = []; 
    let match;
    while ((match = kpRegex.exec(text)) !== null) {
      const time = match[1].trim();
      const clean = match[2].replace(/\(G\d\)/g, '').replace(/[ \t]+/g, ' ').trim();
      const values = clean.split(' ').map(Number);
      if (values.length === 3 && values.every(v => !isNaN(v))) { 
        times.push(time); day1.push(values[0]); day2.push(values[1]); day3.push(values[2]); 
      }
    }
    if (times.length === 0) throw new Error("Kp values not found.");

    const ctxElement = document.getElementById('kpChart'); 
    if (!ctxElement) return;
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
          tooltip: { callbacks: { label: function(context) { const kp = context.parsed.y; if (kp >= 5) return `Kp ${kp} - High chance`; if (kp >= 3) return `Kp ${kp} - Moderate chance`; return `Kp ${kp} - Low chance`; } } }
        },
        scales: { y: { min: 0, max: 9, title: { display: true, text: 'Kp Index' } }, x: { title: { display: true, text: 'UT Time (3h intervals)' } } }
      }
    });

  } catch (error) {
    console.error("Error fetching NOAA forecast:", error);
    const container = document.getElementById('errorMessage');
    if (container) { 
      container.textContent = "⚠️ Error downloading NOAA data: " + error.message; 
      container.style.color = 'red'; 
      container.style.fontWeight = 'bold'; 
    }
  }
}

// --- Start app ---
document.addEventListener('DOMContentLoaded', initApp);
