//------------------------------------------------------
// Asetukset ja muuttujat
//------------------------------------------------------
let auroraLayer = null;
let userMarker = null;
let currentData = null;
let notificationPermissionRequested = false;


//------------------------------------------------------
//  ✓ Lon-muunnos (NOAA 0–360° → Leaflet -180–180°)
//------------------------------------------------------
function convertLonNOAAtoLeaflet(lon) {
    return lon > 180 ? lon - 360 : lon;
}


//------------------------------------------------------
// Kartta
//------------------------------------------------------
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

// Estä kartan kääntyminen useammalle "maapallolle"
map.setMaxBounds([[-90, -180], [90, 180]]);
map.on('drag', () => map.panInsideBounds([[-90, -180], [90, 180]], { animate: false }));


//------------------------------------------------------
// Hae NOAA-revontulidata
//------------------------------------------------------
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


//------------------------------------------------------
// Piirrä revontulet Canvasiin ja lisää kartalle
//------------------------------------------------------
function drawAuroraOverlay(points) {

    if (auroraLayer) map.removeLayer(auroraLayer);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 800;
    canvas.height = 500;

    points.forEach(p => {
        let lon = convertLonNOAAtoLeaflet(p[0]);
        let lat = p[1];
        let intensity = Math.min(p[2], 100);

        if (intensity < 1) return;

        const x = ((lon + 180) / 360) * canvas.width;
        const y = ((90 - lat) / 50) * canvas.height;

        const radius = 30 + intensity * 0.5;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const alpha = Math.min(0.2, intensity / 200);

        grad.addColorStop(0, `rgba(50,255,100,${alpha})`);
        grad.addColorStop(0.5, `rgba(0,200,100,${alpha / 2})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    });

    const bounds = [[40, -180], [90, 180]];  // pohjoinen pallonpuolisko

    auroraLayer = L.imageOverlay(canvas.toDataURL(), bounds, { opacity: 0.7 });
    auroraLayer.addTo(map);
}


//------------------------------------------------------
// Info-ikkuna piiloon automaattisesti
//------------------------------------------------------
function hideInfoAfterDelay() {
    const div = document.getElementById("info");
    if (!div) return;
    setTimeout(() => div.style.display = "none", 5000);
}


//------------------------------------------------------
// Tarkista revontulet käyttäjän sijainnissa
//------------------------------------------------------
function checkAuroraAtLocation(userLat, userLon) {
    if (!currentData || !currentData.coordinates) return;

    let nearest = null, minDist = Infinity;

    currentData.coordinates.forEach(p => {
        let lon = convertLonNOAAtoLeaflet(p[0]);
        let lat = p[1];
        let intensity = p[2];

        const latDiff = lat - userLat;
        const lonDiff = Math.abs(lon - userLon);
        const lonDiffNorm = Math.min(lonDiff, 360 - lonDiff);

        const dist = Math.hypot(latDiff, lonDiffNorm * Math.cos(userLat * Math.PI / 180));

        if (dist < minDist) {
            minDist = dist;
            nearest = { lat, lon, intensity, distance: dist };
        }
    });

    if (!nearest) return;

    let emoji = "😕", text = "Not much northern lights";

    if (nearest.intensity > 80) { emoji = "🌟"; text = "Strong aurora activity!"; }
    else if (nearest.intensity > 60) { emoji = "🌌"; text = "Very likely visible"; }
    else if (nearest.intensity > 40) { emoji = "✨"; text = "Moderate activity"; }
    else if (nearest.intensity > 20) { emoji = "🌙"; text = "Low activity"; }

    const message =
        `${emoji} <strong>${text}</strong><br>` +
        `Intensity: ${nearest.intensity.toFixed(1)}<br>` +
        `<small>Distance: ${(nearest.distance * 111).toFixed(0)} km</small>`;

    L.popup()
        .setLatLng([userLat, userLon])
        .setContent(message)
        .openOn(map);

    // ilmoitukset
    if (!notificationPermissionRequested) {
        Notification.requestPermission();
        notificationPermissionRequested = true;
    }
    if (Notification.permission === "granted" && nearest.intensity > 5) {
        new Notification("🌌 Northern Lights alert",
            { body: message.replace(/<[^>]*>/g, '') });
    }
}


//------------------------------------------------------
// Käyttäjän sijainti
//------------------------------------------------------
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        map.setView([lat, lon], 5);
        userMarker = L.marker([lat, lon]).addTo(map).bindPopup("Your location");
        checkAuroraAtLocation(lat, lon);
    });
}


//------------------------------------------------------
// Karttaklikkaus: näytä revontulitilanne
//------------------------------------------------------
map.on("click", e => {
    showAuroraAtClickedLocation(e.latlng.lat, e.latlng.lng);
});


function showAuroraAtClickedLocation(lat, lon) {
    if (!currentData) return;

    let nearest = null, minDist = Infinity;

    currentData.coordinates.forEach(p => {
        let pointLon = convertLonNOAAtoLeaflet(p[0]);
        let pointLat = p[1];
        let intensity = p[2];

        const latDiff = pointLat - lat;
        const lonDiff = Math.abs(pointLon - lon);
        const lonNorm = Math.min(lonDiff, 360 - lonDiff);

        const dist = Math.hypot(latDiff, lonNorm * Math.cos(lat * Math.PI / 180));

        if (dist < minDist) {
            minDist = dist;
            nearest = { lat: pointLat, lon: pointLon, intensity, distance: dist };
        }
    });

    if (!nearest) return;

    let emoji = "😕", text = "Not much northern lights";

    if (nearest.intensity > 80) { emoji = "🌟"; text = "Strong aurora activity!"; }
    else if (nearest.intensity > 60) { emoji = "🌌"; text = "Very likely visible"; }
    else if (nearest.intensity > 40) { emoji = "✨"; text = "Moderate activity"; }
    else if (nearest.intensity > 20) { emoji = "🌙"; text = "Low activity"; }

    const msg =
        `${emoji} <strong>${text}</strong><br>` +
        `Intensity: ${nearest.intensity.toFixed(1)}<br>` +
        `<small>Distance: ${(nearest.distance * 111).toFixed(0)} km</small>`;

    L.popup().setLatLng([lat, lon]).setContent(msg).openOn(map);
}


//------------------------------------------------------
// Info-popup
//------------------------------------------------------
hideInfoAfterDelay();


//------------------------------------------------------
// Käynnistä
//------------------------------------------------------
fetchAuroraData();
setInterval(fetchAuroraData, 5 * 60 * 1000);
