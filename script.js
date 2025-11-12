let auroraLayer = null;
let userMarker = null;
let currentData = null;
let notificationPermissionRequested = false;

// --- Kartta ---
const map = L.map('map', {
  center: [65, 25],
  zoom: 4,
  minZoom: 2,
  maxZoom: 15,
  worldCopyJump: false
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> & <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19,

}).addTo(map);

// Rajoitetaan näkymä yhteen maapallon levyiseen alueeseen
map.setMaxBounds([[-90, -180], [90, 180]]);
map.on('drag', () => map.panInsideBounds([[-90, -180],[90,180]], {animate:false}));

const info = document.getElementById("info");

// --- Hae NOAA data ---
function fetchAuroraData() {
  info.className = 'loading';
  info.innerHTML = '⏳ Loading northern lights forecast...';
  const directUrl = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
  const proxyUrl = 'https://corsproxy.io/?' + directUrl;

  fetch(directUrl).catch(() => fetch(proxyUrl))
    .then(res => { if(!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
    .then(data => {
      if (!data.coordinates || !Array.isArray(data.coordinates)) throw new Error("The data does not contain a 'coordinates' table.");
      currentData = data;
      const obsTime = formatTime(data["Observation Time"]);
      const forecastTime = formatTime(data["Forecast Time"]);
      info.className = '';
      info.innerHTML = `<strong>📡 Northern Lights forecast</strong><br>
        <small>Observation: ${obsTime}<br>Forecast: ${forecastTime}<br>Points: ${data.coordinates.length}</small>`;
      drawAuroraOverlay(data.coordinates);
    })
    .catch(err => {
      console.error('Error retrieving northern light data', err);
      info.className = 'error';
      info.innerHTML = `<strong>❌ Error</strong><br><small>No northern lights forecast available.<br>${err.message}</small>`;
    });
}

function formatTime(timeStr) {
  try {
    const date = new Date(timeStr);
    return date.toLocaleString('fi-FI',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});
  } catch { return timeStr; }
}

// --- Piirrä revontulet gradienttina ---
// --- Piirrä revontulet gradienttina ympäri palloa ---
// --- Piirrä revontulet samalla tyylillä kuin liittämässäsi ---
function drawAuroraOverlay(points) {
  if (auroraLayer) {
    auroraLayer.forEach(l => map.removeLayer(l));
  }
  auroraLayer = [];

  const canvasWidth = 3600;
  const canvasHeight = 500;

  const createCanvasOverlay = (xOffset = 0, clipStart = -Infinity, clipEnd = Infinity) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    points.forEach(p => {
      let lon = p[0]; 
      if (lon < 0) lon += 360; // normalize 0-360
      if (lon < clipStart || lon > clipEnd) return; // piirrä vain sallitulle alueelle
      const lat = p[1];
      const intensity = p[2];
      if (intensity < 1) return;

      const x = ((lon + 180) / 360) * canvasWidth + xOffset;
      const y = ((90 - lat) / 50) * canvasHeight;

      const radius = Math.min(60, Math.max(10, intensity * 3));

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(50,255,100,${Math.min(0.3, intensity / 10)})`);
      grad.addColorStop(0.5, `rgba(0,200,100,${Math.min(0.1, intensity / 15)})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI*2);
      ctx.fill();
    });

    const bounds = [[40, -180], [90, 180]];
    const overlay = L.imageOverlay(canvas.toDataURL(), bounds, { opacity: 0.75, interactive: false }).addTo(map);
    auroraLayer.push(overlay);
  };

  // piirretään kolme overlayta, mutta rajoitetaan missä alueella pisteitä piirretään
  createCanvasOverlay(0);       // alkuperäinen
  createCanvasOverlay(-canvasWidth); // vasen kopio
  createCanvasOverlay(canvasWidth);   // oikea kopio

}


function hideInfoAfterDelay() {
  setTimeout(() => {
    document.getElementById("info").style.display = "none";
  }, 5000); // 5 sekuntia
}



// --- Tarkista käyttäjän sijainti ja revontulet ---
function checkAuroraAtLocation(userLat,userLon) {
  if(!currentData||!currentData.coordinates) return;
  let nearest=null,minDist=Infinity;
  currentData.coordinates.forEach(p=>{
    let lon = p[0]<0? p[0]+360:p[0];
    let lat=p[1]; let intensity=p[2];
    const latDiff = lat-userLat;
    const lonDiff = Math.abs(lon-userLon);
    const lonDiffNormalized = Math.min(lonDiff,360-lonDiff);
    const dist=Math.hypot(latDiff,lonDiffNormalized*Math.cos(userLat*Math.PI/180));
    if(dist<minDist){minDist=dist;nearest={lat,lon,intensity,distance:dist};}
  });
  if(nearest){
    let message='',emoji='';
    if(nearest.intensity>80){emoji='🌟';message=`${emoji} <strong>Strong aurora activity!</strong><br>Intensiteetti: ${nearest.intensity.toFixed(1)}`;}
    else if(nearest.intensity>60){emoji='🌌';message=`${emoji} <strong>Northern lights very likely to be visible</strong><br>Intensiteetti: ${nearest.intensity.toFixed(1)}`;}
    else if(nearest.intensity>40){emoji='✨';message=`${emoji} <strong>Moderate activity</strong><br>Intensiteetti: ${nearest.intensity.toFixed(1)}`;}
    else if(nearest.intensity>20){emoji='🌙';message=`${emoji} <strong>Low activity</strong><br>Intensiteetti: ${nearest.intensity.toFixed(1)}`;}
    else{emoji='😕';message=`${emoji} <strong>Not much northern lights</strong><br>Intensiteetti: ${nearest.intensity.toFixed(1)}`;}
    message+=`<br><small>Distance to data point: ~${(nearest.distance*111).toFixed(0)} km</small>`;
    L.popup().setLatLng([userLat,userLon]).setContent(message).openOn(map);
    if(Notification.permission==="granted"&&nearest.intensity>5){
      new Notification("🌌 Northern Lights alert",{body:message.replace(/<[^>]*>/g,'')});
    }
  }
}


// --- Käyttäjän sijainti ---
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    map.setView([lat, lon], 5);
    userMarker = L.marker([lat, lon]).addTo(map).bindPopup('Your location');
    checkAuroraAtLocation(lat, lon);
  });
} else {
  alert("Your browser does not support location detection.");
}

// --- Nappi oman sijainnin näyttämiseen ---
document.getElementById("locate-btn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Your browser does not support location detection.");
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    map.setView([lat, lon], 6);

    if (userMarker) {
      userMarker.setLatLng([lat, lon]);
    } else {
      userMarker = L.marker([lat, lon]).addTo(map).bindPopup('Your location');
    }

    userMarker.openPopup();
    checkAuroraAtLocation(lat, lon);
  }, err => {
    alert("Location determination failed: " + err.message);
  });
});



// --- Säännöllinen päivitys ---
fetchAuroraData();
setInterval(fetchAuroraData, 5*60*1000);

// --- Valikon toiminta ---
const menuBtn = document.getElementById("menu-btn");
const menu = document.getElementById("menu");

menuBtn.addEventListener("click", () => {
  menu.style.display = menu.style.display === "flex" ? "none" : "flex";
});
map.on('click', () => { 
  menu.style.display = 'none'; 
});



hideInfoAfterDelay();
 // --- Klikkaus kartalla: näytä revontulitilanne ---
map.on('click', (e) => {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  showAuroraAtClickedLocation(lat, lon);
});

function showAuroraAtClickedLocation(lat, lon) {
  if (!currentData || !currentData.coordinates) {
    L.popup()
      .setLatLng([lat, lon])
      .setContent("❌ No aurora data available.")
      .openOn(map);
    return;
  }

  let nearest = null, minDist = Infinity;
  currentData.coordinates.forEach(p => {
    let pointLon = p[0] < 0 ? p[0] + 360 : p[0];
    let pointLat = p[1];
    let intensity = p[2];
    const latDiff = pointLat - lat;
    const lonDiff = Math.abs(pointLon - lon);
    const lonDiffNormalized = Math.min(lonDiff, 360 - lonDiff);
    const dist = Math.hypot(latDiff, lonDiffNormalized * Math.cos(lat * Math.PI / 180));
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

  L.popup()
    .setLatLng([lat, lon])
    .setContent(message)
    .openOn(map);
} 

// --- Pop-up Help Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const helpPopup = document.getElementById('help-popup');
  const closePopupBtn = document.getElementById('close-popup');
  const dontShowAgainCheckbox = document.getElementById('dont-show-again');

  // Show popup only if user hasn't disabled it
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


const showHelpLink = document.getElementById('show-help');
showHelpLink.addEventListener('click', (e) => {
  e.preventDefault(); // estää #-linkin hyppäämisen
  document.getElementById('help-popup').style.display = 'flex';
});

// Chart.js CDN
const chartScript = document.createElement('script');
chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(chartScript);

// Näytä popup
document.getElementById('forecast-btn').addEventListener('click', () => {
  document.getElementById('forecast-overlay').style.display = 'flex';
  fetchAuroraForecast();
});

// Sulje popup
document.getElementById('close-forecast').addEventListener('click', () => {
  document.getElementById('forecast-popup').style.display = 'none';
});

async function fetchAuroraForecast() {
  const response = await fetch('https://services.swpc.noaa.gov/text/3-day-forecast.txt');
  const text = await response.text();

  const kpRegex = /(\d{2}-\d{2}UT)\s+(\d+\.\d+)/g;
  const kpValues = [];
  let match;
  while ((match = kpRegex.exec(text)) !== null) {
    kpValues.push({ time: match[1], kp: parseFloat(match[2]) });
  }

  const labels = kpValues.map(v => v.time);
  const dataPoints = kpValues.map(v => v.kp);
  const colors = kpValues.map(v => v.kp < 3 ? 'green' : v.kp < 5 ? 'orange' : 'red');

  const ctx = document.getElementById('kpChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Kp index forecast',
        data: dataPoints,
        borderColor: 'blue',
        pointBackgroundColor: colors,
        pointRadius: 9,
        fill: false,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: 'Northern Lights forecast (NOAA)' } },
      scales: { y: { min: 0, max: 9 } }
    }
  });
}
