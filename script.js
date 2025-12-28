 let map, auroraCanvas, ctx, markersLayer;
        let time = 0;
        let kpIndex = 3.0;
        let ovationData = null;
        let placeMarkers = new Map();
        let readMoreBound = false;
        
        const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
        const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';

        async function initApp() {
            map = L.map('map', {
                center: [65, 25],
                zoom: 4,
                minZoom: 2,
                maxZoom: 15,
                zoomControl: false,
                attributionControl: false
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);

            const AuroraLayer = L.Layer.extend({
                onAdd: function(map) {
                    const container = L.DomUtil.create('div', 'leaflet-aurora-layer');
                    this._canvas = L.DomUtil.create('canvas', 'aurora-canvas', container);
                    this._canvas.style.pointerEvents = 'none';
                    map.getPanes().overlayPane.appendChild(container);
                    this._map = map;
                    auroraCanvas = this._canvas;
                    ctx = auroraCanvas.getContext('2d');
                    map.on('move moveend zoomend', this._reset, this);
                    this._reset();
                    return this;
                },
                _reset: function() {
                    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
                    L.DomUtil.setPosition(this._canvas, topLeft);
                    const size = this._map.getSize();
                    this._canvas.width = size.x;
                    this._canvas.height = size.y;
                }
            });
            map.addLayer(new AuroraLayer());

            markersLayer = L.layerGroup().addTo(map);

            initButtons();
            const places = await loadPlaces();
            initMarkers(map, getWeather, showPlaceInfo, places);

            fetchKPData();
            fetchOvationData();
            setInterval(fetchKPData, 300000);
            setInterval(fetchOvationData, 300000);
            
            animate();
            map.on('click', onMapClick);
        }

        async function loadPlaces() {
            try {
                const res = await fetch('kohteet/index.json', { cache: 'no-cache' });
                const manifest = await res.json();
                const files = manifest.files || [];
                const loaded = await Promise.all(files.map(async (file) => {
                    try {
                        const mRes = await fetch(`kohteet/${file}`, { cache: 'no-cache' });
                        const meta = await mRes.json();
                        const id = file.replace(/\.json$/i, '').toLowerCase();
                        return { id, ...meta, icon: meta.icon || 'images/iconi.png' };
                    } catch (e) { return null; }
                }));
                return loaded.filter(p => p !== null);
            } catch (e) { return []; }
        }

        function initMarkers(targetMap, getWeatherFn, showPlaceInfoFn, places = []) {
            if (!targetMap || !Array.isArray(places)) return;
            markersLayer.clearLayers();

            places.forEach(place => {
                const customIcon = L.divIcon({
                    className: 'custom-marker',
                    html: `
                        <div class="marker-wrapper">
                            <img src="pinni.png" class="pin">
                            <img src="${place.icon}" class="pin-icon" onerror="this.src='images/iconi.png'">
                        </div>
                    `,
                    iconSize: [32, 48],
                    iconAnchor: [16, 48],
                    popupAnchor: [0, -52]
                });

                const popupContent = `
                    <div class="popup-header">
                        <img src="${place.icon}" alt="${place.name}" onerror="this.src='images/iconi.png'">
                        <strong class="popup-title">${place.name}</strong>
                    </div>
                    <div style="font-size:0.9em; margin:6px 0; max-width:250px; color:#ddd;">
                        ${place.short || 'Kaunis revontulikohde'}
                    </div>
                    <div id="aurora-chance-box" style="margin-bottom:8px; font-weight:bold; color:#00ffcc;">Lasketaan mahdollisuutta...</div>
                    <a href="#" class="read-more" data-place="${place.id}">Lue lisää</a>
                    <div class="weather-box" style="margin-top:10px;">
                        <em>Haetaan säätietoja...</em>
                    </div>
                `;

                const marker = L.marker([place.lat, place.lon], { icon: customIcon })
                    .bindPopup(popupContent, { className: 'custom-popup' })
                    .addTo(markersLayer);

                marker.on('popupopen', async (e) => {
                    const popupEl = e.popup.getElement();
                    
                    // Lasketaan revontulimahdollisuus klikatessa
                    const chanceBox = popupEl.querySelector('#aurora-chance-box');
                    if (chanceBox) {
                        const weather = await getWeatherFn(place.lat, place.lon);
                        const intensity = calculateIntensity(place.lat, place.lon);
                        const clouds = weather ? weather.clouds : 100;
                        const score = (intensity > 30 ? 1 : 0) + (clouds < 40 ? 2 : (clouds < 70 ? 1 : 0));
                        const status = score >= 3 ? '🟢 Erinomainen' : (score >= 2 ? '🟡 Kohtalainen' : '🔴 Heikko');
                        chanceBox.innerHTML = `Mahdollisuus: ${status} (${intensity}%)`;
                    }

                    // Sää
                    const weatherBox = popupEl.querySelector('.weather-box');
                    if (weatherBox && !weatherBox.dataset.loaded) {
                        const weather = await getWeatherFn(place.lat, place.lon);
                        if (weather) {
                            weatherBox.innerHTML = `
                                <div class="weather-row">
                                    <img src="https://openweathermap.org/img/wn/${weather.icon}.png">
                                    <span>${weather.temp}°C — ${weather.desc}</span>
                                </div>
                                <small>Pilvisyys: ${weather.clouds}% | Tuuli: ${weather.wind} m/s</small>
                            `;
                        } else { weatherBox.textContent = 'Säätietoa ei saatavilla'; }
                        weatherBox.dataset.loaded = 'true';
                    }
                });

                placeMarkers.set(place.id, { marker, data: place });
            });

            if (!readMoreBound) {
                document.addEventListener('click', function (e) {
                    const link = e.target.closest('.read-more');
                    if (!link) return;
                    e.preventDefault();
                    const id = link.dataset.place;
                    const p = places.find(item => item.id === id);
                    if (p) showPlaceInfoFn(p);
                });
                readMoreBound = true;
            }
        }

        function calculateIntensity(lat, lon) {
            if (!ovationData?.coordinates) return 0;
            let minDist = Infinity, intensity = 0;
            ovationData.coordinates.forEach(p => {
                let pLon = p[0] > 180 ? p[0] - 360 : p[0];
                let dist = Math.hypot(p[1] - lat, pLon - lon);
                if (dist < minDist) { minDist = dist; intensity = p[2]; }
            });
            return intensity;
        }

        async function onMapClick(e) {
            if (e.originalEvent.target.closest('.leaflet-marker-icon')) return;
            
            const intensity = calculateIntensity(e.latlng.lat, e.latlng.lng);
            const weather = await getWeather(e.latlng.lat, e.latlng.lng);
            const clouds = weather ? weather.clouds : 100;
            const score = (intensity > 30 ? 1 : 0) + (clouds < 40 ? 2 : (clouds < 70 ? 1 : 0));
            const status = score >= 3 ? '🟢 Erinomainen' : (score >= 2 ? '🟡 Kohtalainen' : '🔴 Heikko');

            const content = `
                <div class="aurora-popup-content">
                    <strong>Valittu sijainti</strong><br>
                    Mahdollisuus: ${status}<br>
                    Intensiteetti: ${intensity}% | Pilvet: ${clouds}%<br>
                    <small>${e.latlng.lat.toFixed(3)}, ${e.latlng.lng.toFixed(3)}</small>
                </div>
            `;
            L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
        }

        async function getWeather(lat, lon) {
            try {
                const res = await fetch(`https://repotracker.masto84.workers.dev/?lat=${lat}&lon=${lon}`);
                const data = await res.json();
                return {
                    temp: Math.round(data.main.temp),
                    desc: data.weather[0].description,
                    icon: data.weather[0].icon,
                    clouds: data.clouds.all,
                    wind: data.wind.speed
                };
            } catch (e) { return null; }
        }

        function showPlaceInfo(place) {
            const info = document.getElementById('place-info');
            info.style.display = 'block';
            info.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="margin:0; color:#00ffcc;">${place.name}</h2>
                    <button class="btn" onclick="this.parentElement.parentElement.style.display='none'" style="padding:4px 10px;">X</button>
                </div>
                <div style="margin-top:15px; line-height:1.6; max-height:400px; overflow-y:auto;">
                    ${place.description || 'Ei lisätietoja saatavilla.'}
                </div>
            `;
        }

        function drawAurora() {
            if (!ctx || !map) return;
            ctx.clearRect(0, 0, auroraCanvas.width, auroraCanvas.height);
            const zoom = map.getZoom();
            const scaleFactor = Math.pow(2, zoom - 4);
            const layers = Math.floor(4 + (kpIndex / 2));
            const targetLat = 75 - (kpIndex * 2.5);
            
            for (let j = 0; j < layers; j++) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.filter = `blur(${(20 + j * 5) * (zoom / 4)}px)`;
                ctx.strokeStyle = `hsla(${kpIndex > 4.5 && j === 0 ? 330 : 145 + (j * 4)}, 100%, 60%, ${(0.3 + (kpIndex/10 * 0.5)) / layers})`;
                ctx.lineWidth = Math.max(10, 30 * scaleFactor);
                ctx.shadowBlur = 10 * scaleFactor;
                ctx.beginPath();
                for (let i = 0; i <= 45; i++) {
                    const lon = -180 + (i / 45) * 360;
                    const wave = Math.sin(i * 0.15 + time * 0.3 + j) * (1.1 + kpIndex * 0.4);
                    const pt = map.latLngToContainerPoint([targetLat + wave, lon]);
                    if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke(); ctx.restore();
            }
        }

        function animate() { drawAurora(); time += 0.006; requestAnimationFrame(animate); }

        async function fetchKPData() {
            try {
                const res = await fetch(KP_URL);
                const data = await res.json();
                if (data.length > 1) { kpIndex = parseFloat(data[data.length - 1][1]); updateUI(kpIndex); }
            } catch (e) {}
        }

        async function fetchOvationData() {
            try {
                const res = await fetch(OVATION_URL);
                ovationData = await res.json();
            } catch (e) {}
        }

        function updateUI(val) {
            document.getElementById('kpVal').innerText = val.toFixed(1);
            document.getElementById('statusDot').style.background = val >= 5 ? '#ff3366' : (val >= 3 ? '#ffcc00' : '#00ffcc');
            document.getElementById('activityText').innerText = val >= 5 ? "Myrsky" : (val >= 3 ? "Aktiivista" : "Rauhallista");
        }

        function initButtons() {
            document.getElementById('forecast-btn').onclick = () => {
                document.getElementById('forecast-popup').style.display = 'flex';
                fetchAuroraForecast();
            };
            document.getElementById('close-forecast').onclick = () => document.getElementById('forecast-popup').style.display = 'none';
            document.getElementById('locate-btn').onclick = () => navigator.geolocation.getCurrentPosition(pos => map.setView([pos.coords.latitude, pos.coords.longitude], 8));
        }

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
    console.error('Error fetching NOAA forecast:', error);
    const container = document.getElementById('errorMessage');
    if (container) {
      container.textContent = '⚠️ Error downloading NOAA data: ' + error.message;
      container.style.color = 'red';
      container.style.fontWeight = 'bold';
    }
  }
}

        window.onload = initApp;
