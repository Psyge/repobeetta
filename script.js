// --- Globaalit muuttujat ---
let auroraLayer = null;
let userMarker = null;
let currentData = null;
let map;

const info = document.getElementById("info");
if (info) info.textContent = translations[currentLang].map.clickInfo;

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
  // Help Popup
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
      helpPopup.style.display = 'none';
    });
  }

  if (showHelpLink) {
    showHelpLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (helpPopup) helpPopup.style.display = 'flex';
    });
  }

  // Menu toggle
  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => {
      menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
    });
  }

  // Forecast Popup
  const forecastBtn = document.getElementById('forecast-btn');
  const forecastPopup = document.getElementById('forecast-popup');
  const closeForecast = document.getElementById('close-forecast');

  if (forecastBtn && forecastPopup) {
    forecastBtn.addEventListener('click', () => {
      forecastPopup.style.display = 'flex';
      fetchAuroraForecast();
    });
  }

  if (closeForecast && forecastPopup) {
    closeForecast.addEventListener('click', () => {
      forecastPopup.style.display = 'none';
    });
  }
});

// --- Kartta ---
if (typeof L !== 'undefined') {
  map = L.map('map', {
    center: [65, 25],
    zoom: 4,
    minZoom: 2,
    maxZoom: 15,
    worldCopyJump: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  map.setMaxBounds([[-90, -180], [90, 180]]);
  map.on('drag', () => map.panInsideBounds([[-90, -180], [90, 180]], { animate: false }));

  map.on('click', async (e) => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    let auroraScore = 0;
    let auroraIntensity = 0;

    // Aurora-intensiteetti
    if (currentData && currentData.coordinates) {
      let nearest = null, minDist = Infinity;
      currentData.coordinates.forEach(p => {
        let pointLon = p[0] < 0 ? p[0] + 360 : p[0];
        const pointLat = p[1], intensity = p[2];
        const dist = Math.hypot(pointLat - lat, Math.abs(pointLon - lon));
        if (dist < minDist) { minDist = dist; nearest = intensity; }
      });
      auroraIntensity = nearest || 0;
      if (auroraIntensity > 60) auroraScore += 2;
      else if (auroraIntensity > 30) auroraScore += 1;
    }

    // Säädata
    const weather = await getWeather(lat, lon);
    let clouds = weather ? weather.clouds : 100;
    if (clouds < 30) auroraScore += 2;
    else if (clouds < 60) auroraScore += 1;

    // Liikennevalo
    let statusEmoji = '🔴';
    let statusText = translations[currentLang].map.chanceLow;
    if (auroraScore >= 3) { statusEmoji = '🟢'; statusText = translations[currentLang].map.chanceHigh; }
    else if (auroraScore === 2) { statusEmoji = '🟡'; statusText = translations[currentLang].map.chanceModerate; }

    // Popup sisältö
    const popupContent = `
      <strong>${translations[currentLang].map.popupTitle}</strong><br>
      ${statusEmoji} ${statusText}<br>
      ${translations[currentLang].map.auroraIntensity}: ${auroraIntensity.toFixed(1)}<br>
      ${translations[currentLang].map.clouds}: ${clouds}%<br>
      ${translations[currentLang].map.temp}: ${weather ? weather.temp + '°C' : 'N/A'}<br>
      <strong>${translations[currentLang].map.coordinates}:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}<br>
      <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank">${translations[currentLang].map.openMaps}</a>
    `;

    L.popup().setLatLng([lat, lon]).setContent(popupContent).openOn(map);
  });
}

// --- NOAA Data ---
function fetchAuroraData() {
  if (!info) return;
  info.className = 'loading';
  info.innerHTML = translations[currentLang].map.loading;

  const directUrl = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
  const proxyUrl = 'https://corsproxy.io/?' + directUrl;

  fetch(directUrl).catch(() => fetch(proxyUrl))
    .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
    .then(data => {
      if (!data.coordinates || !Array.isArray(data.coordinates)) throw new Error("Invalid data format.");
      currentData = data;
      const obsTime = formatTime(data["Observation Time"]);
      const forecastTime = formatTime(data["Forecast Time"]);
      info.className = '';
      info.innerHTML = `
        <strong>${translations[currentLang].map.forecastTitle}</strong><br>
        <small>
          ${translations[currentLang].map.observation}: ${obsTime}<br>
          ${translations[currentLang].map.forecast}: ${forecastTime}<br>
          ${translations[currentLang].map.points}: ${data.coordinates.length}
        </small>
      `;
      if (map) drawAuroraOverlay(data.coordinates);
    })
    .catch(err => {
      console.error('Error retrieving northern light data', err);
      info.className = 'error';
      info.innerHTML = `<strong>${translations[currentLang].map.error}</strong>`;
    });
}

// --- Chart.js ---
async function fetchAuroraForecast() {
  try {
    const response = await fetch('https://services.swpc.noaa.gov/text/3-day-forecast.txt');
    if (!response.ok) throw new Error(`Network error: ${response.status}`);
    const text = await response.text();

    const kpRegex = /[ \t]*(\d{2}-\d{2}UT)[ \t]+([\d\.\(\)G \t]+)/g;
    const times = [], day1 = [], day2 = [], day3 = [];
    let match;

    while ((match = kpRegex.exec(text)) !== null) {
      const clean = match[2].replace(/\(G\d\)/g, '').replace(/[ \t]+/g, ' ').trim();
      const values = clean.split(' ').map(Number);
      if (values.length === 3 && values.every(v => !isNaN(v))) {
        times.push(match[1].trim());
        day1.push(values[0]);
        day2.push(values[1]);
        day3.push(values[2]);
      }
    }

    const ctxElement = document.getElementById('kpChart');
    if (!ctxElement) return;
    const ctx = ctxElement.getContext('2d');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: times,
        datasets: [
          { label: 'Day 1', data: day1, borderColor: '#007bff', pointBackgroundColor: day1.map(kp => kp < 3 ? 'green' : kp < 5 ? 'orange' : 'red'), pointRadius: 6, tension: 0.3 },
          { label: 'Day 2', data: day2, borderColor: '#6f42c1', pointBackgroundColor: day2.map(kp => kp < 3 ? 'green' : kp < 5 ? 'orange' : 'red'), pointRadius: 6, tension: 0.3 },
          { label: 'Day 3', data: day3, borderColor: '#20c997', pointBackgroundColor: day3.map(kp => kp < 3 ? 'green' : kp < 5 ? 'orange' : 'red'), pointRadius: 6, tension: 0.3 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: translations[currentLang].chart.title },
          tooltip: {
            callbacks: {
              label: function(context) {
                const kp = context.parsed.y;
                if (kp >= 5) return translations[currentLang].chart.tooltipHigh.replace('{kp}', kp);
                if (kp >= 3) return translations[currentLang].chart.tooltipModerate.replace('{kp}', kp);
                return translations[currentLang].chart.tooltipLow.replace('{kp}', kp);
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error("Error fetching forecast:", error);
  }
}
document.dispatchEvent(new Event('mapReady'));
