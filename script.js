let auroraLayer = null;
let userMarker = null;
let currentData = null;
let notificationPermissionRequested = false;

function convertLonNOAAtoLeaflet(lon) {
    if (lon > 180) {
        lon = lon - 360;
    }
    return lon;
}

const map = L.map('map', {
  center: [65, 25],
  zoom: 4,
  minZoom: 2,
  maxZoom: 15
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CARTO',
  subdomains: 'abcd'
}).addTo(map);

map.setMaxBounds([[-90, -180], [90, 180]]);
map.on('drag', () => map.panInsideBounds([[-90, -180],[90,180]], {animate:false}));

const info = document.getElementById("info");

async function fetchAuroraData() {
  try {
    const res = await fetch('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentData = data;
    drawAuroraOverlay(data.coordinates);
  } catch (err) {
    console.error("Aurora data error:", err);
  }
}

function formatTime(timeStr) {
  try {
    const date = new Date(timeStr);
    return date.toLocaleString('fi-FI',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});
  } catch { return timeStr; }
}

// --------------------------------------------------
//  Smart filter: Remove only problematic wrap artifacts
// --------------------------------------------------
function drawAuroraOverlay(points) {
  if (auroraLayer) map.removeLayer(auroraLayer);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = 800;
  canvas.height = 500;
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  
  // Draw points twice near the edges to create smooth wrapping
  points.forEach(p => {
    let lon = p[0]; // NOAA 0–360
    const lat = p[1];
    const intensity = Math.min(p[2], 100);
    if (intensity < 1) return;

    // Convert to -180 to 180
    if (lon > 180) {
      lon = lon - 360;
    }
    
    const radius = 30 + intensity * 0.5;
    const alpha = Math.min(0.2, intensity / 200);

    function drawBlob(longitude) {
      const x = ((longitude + 180) / 360) * canvasWidth;
      const y = ((90 - lat) / 50) * canvasHeight;
      
      // Skip if outside canvas bounds
      if (x < -radius || x > canvasWidth + radius) return;
      
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(50,255,100,${alpha})`);
      grad.addColorStop(0.5, `rgba(0,200,100,${alpha/2})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI*2);
      ctx.fill();
    }

    // Draw at primary position
    drawBlob(lon);
    
    // If near left edge, also draw on right side
    if (lon < -160) {
      drawBlob(lon + 360);
    }
    
    // If near right edge, also draw on left side  
    if (lon > 160) {
      drawBlob(lon - 360);
    }
  });

  const bounds = [[40, -180], [90, 180]];
  auroraLayer = L.imageOverlay(canvas.toDataURL(), bounds, { opacity: 0.7 });
  auroraLayer.addTo(map);
}

function hideInfoAfterDelay() {
  setTimeout(() => {
    document.getElementById("info").style.display = "none";
  }, 5000);
}

function checkAuroraAtLocation(userLat, userLon) {
  if (!currentData || !currentData.coordinates) return;

  let nearest = null, minDist = Infinity;

  currentData.coordinates.forEach(p => {
    const pointLon = convertLonNOAAtoLeaflet(p[0]);
    const pointLat = p[1];
    const intensity = p[2];

    const latDiff = pointLat - userLat;
    const lonDiff = pointLon - userLon;
    
    let adjustedLonDiff = lonDiff;
    if (Math.abs(lonDiff) > 180) {
      adjustedLonDiff = lonDiff > 0 ? lonDiff - 360 : lonDiff + 360;
    }
    
    const dist = Math.hypot(latDiff, adjustedLonDiff * Math.cos(userLat * Math.PI / 180));

    if (dist < minDist) {
      minDist = dist;
      nearest = { lat: pointLat, lon: pointLon, intensity, distance: dist };
    }
  });

  if (nearest) {
    let message = '', emoji = '';
    const i = nearest.intensity;
    if (i > 80) { emoji = '🌟'; message = `${emoji} <strong>Strong aurora activity!</strong><br>Intensity: ${i.toFixed(1)}`; }
    else if (i > 60) { emoji = '🌌'; message = `${emoji} <strong>Very likely visible</strong><br>Intensity: ${i.toFixed(1)}`; }
    else if (i > 40) { emoji = '✨'; message = `${emoji} <strong>Moderate activity</strong><br>Intensity: ${i.toFixed(1)}`; }
    else if (i > 20) { emoji = '🌙'; message = `${emoji} <strong>Low activity</strong><br>Intensity: ${i.toFixed(1)}`; }
    else { emoji = '😕'; message = `${emoji} <strong>Not much northern lights</strong><br>Intensity: ${i.toFixed(1)}`; }

    message += `<br><small>Distance to data point: ~${(nearest.distance*111).toFixed(0)} km</small>`;

    L.popup().setLatLng([userLat, userLon]).setContent(message).openOn(map);

    if (!notificationPermissionRequested) {
      Notification.requestPermission();
      notificationPermissionRequested = true;
    }
    if (Notification.permission === "granted" && nearest.intensity > 5) {
      new Notification("🌌 Northern Lights alert", { body: message.replace(/<[^>]*>/g,'') });
    }
  }
}

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    map.setView([lat, lon], 5);
    userMarker = L.marker([lat, lon]).addTo(map).bindPopup('Your location');
    checkAuroraAtLocation(lat, lon);
  });
}

document.getElementById("locate-btn").addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Your browser does not support location detection.");

  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    map.setView([lat, lon], 6);

    if (userMarker) userMarker.setLatLng([lat, lon]);
    else userMarker = L.marker([lat, lon]).addTo(map).bindPopup('Your location');

    userMarker.openPopup();
    checkAuroraAtLocation(lat, lon);
  });
});

map.on('click', (e) => {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  showAuroraAtClickedLocation(lat, lon);
});

function showAuroraAtClickedLocation(lat, lon) {
  if (!currentData||!currentData.coordinates) return;

  let nearest = null, minDist = Infinity;
  currentData.coordinates.forEach(p => {
    let pointLon = convertLonNOAAtoLeaflet(p[0]);
    let pointLat = p[1];
    let intensity = p[2];
    
    const latDiff = pointLat - lat;
    const lonDiff = pointLon - lon;
    
    let adjustedLonDiff = lonDiff;
    if (Math.abs(lonDiff) > 180) {
      adjustedLonDiff = lonDiff > 0 ? lonDiff - 360 : lonDiff + 360;
    }
    
    const dist = Math.hypot(latDiff, adjustedLonDiff * Math.cos(lat * Math.PI / 180));

    if (dist < minDist) {
      minDist = dist;
      nearest = { lat: pointLat, lon: pointLon, intensity, distance: dist };
    }
  });

  let message = '', emoji = '';
  if (nearest.intensity > 80) { emoji = '🌟'; message = `${emoji} <strong>Strong aurora activity!</strong>`; }
  else if (nearest.intensity > 60) { emoji = '🌌'; message = `${emoji} <strong>Very likely visible</strong>`; }
  else if (nearest.intensity > 40) { emoji = '✨'; message = `${emoji} <strong>Moderate activity</strong>`; }
  else if (nearest.intensity > 20) { emoji = '🌙'; message = `${emoji} <strong>Low activity</strong>`; }
  else { emoji = '😕'; message = `${emoji} <strong>Not much northern lights</strong>`; }

  message += `<br>Intensity: ${nearest.intensity.toFixed(1)}<br><small>Distance to data point: ~${(nearest.distance * 111).toFixed(0)} km</small>`;

  L.popup().setLatLng([lat, lon]).setContent(message).openOn(map);
}

document.addEventListener('DOMContentLoaded', () => {
  const helpPopup = document.getElementById('help-popup');
  const closePopupBtn = document.getElementById('close-popup');
  const dontShowAgainCheckbox = document.getElementById('dont-show-again');

  if (!localStorage.getItem('hideHelpPopup')) {
    helpPopup.style.display = 'flex';
  }

  closePopupBtn.addEventListener('click', () => {
    if (dontShowAgainCheckbox.checked) {
      localStorage.setItem('hideHelpPopup', 'true');
    }
    helpPopup.style.display = 'none';
  });
});

document.getElementById('show-help').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('help-popup').style.display = 'flex';
});

const chartScript = document.createElement('script');
chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(chartScript);

document.getElementById('forecast-btn').addEventListener('click', () => {
  document.getElementById('forecast-popup').style.display = 'flex';
  fetchAuroraForecast();
});

document.getElementById('close-forecast').addEventListener('click', () => {
  document.getElementById('forecast-popup').style.display = 'none';
});

async function fetchAuroraForecast() {
  try {
    const response = await fetch('https://services.swpc.noaa.gov/text/3-day-forecast.txt');
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
    const times = [];
    const day1 = [], day2 = [], day3 = [];
    let match;

    while ((match = kpRegex.exec(text)) !== null) {
      const time = match[1].trim();
      const clean = match[2]
        .replace(/\(G\d\)/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();

      const values = clean.split(' ').map(Number);

      if (values.length === 3 && values.every(v => !isNaN(v))) {
        times.push(time);
        day1.push(values[0]);
        day2.push(values[1]);
        day3.push(values[2]);
      }
    }

    if (times.length === 0) {
      throw new Error("Kp-arvoja ei löytynyt datasta");
    }

    const ctx = document.getElementById('kpChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: times,
        datasets: [
          {
            label: dayLabels[0],
            data: day1,
            borderColor: '#007bff',
            pointBackgroundColor: day1.map(kp => kp < 3 ? 'green' : kp < 5 ? 'orange' : 'red'),
            pointRadius: 6,
            tension: 0.3
          },
          {
            label: dayLabels[1],
            data: day2,
            borderColor: '#6f42c1',
            pointBackgroundColor: day2.map(kp => kp < 3 ? 'green' : kp < 5 ? 'orange' : 'red'),
            pointRadius: 6,
            tension: 0.3
          },
          {
            label: dayLabels[2],
            data: day3,
            borderColor: '#20c997',
            pointBackgroundColor: day3.map(kp => kp < 3 ? 'green' : kp < 5 ? 'orange' : 'red'),
            pointRadius: 6,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Northern Lights forecast (NOAA)' },
          tooltip: {
            callbacks: {
              label: function(context) {
                const kp = context.parsed.y;
                if (kp === null) return 'No data';
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
    console.error("Virhe:", error);
    const container = document.getElementById('errorMessage');
    if (container) {
      container.textContent = "⚠️ Virhe ladattaessa NOAA:n dataa: " + error.message;
      container.style.color = 'red';
      container.style.fontWeight = 'bold';
    }
  }
}

fetchAuroraData();
setInterval(fetchAuroraData, 5*60*1000);

hideInfoAfterDelay();
