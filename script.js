let map, auroraCanvas, ctx;
        let time = 0;
        let kpIndex = 3.0;
        let userMarker = null;
        let ovationData = null; // NOAA Ovation data intensiteetti-klikkauksia varten
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

            // Dynaaminen Canvas-kerros
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
                onRemove: function(map) {
                    L.DomUtil.remove(this._canvas);
                    map.off('move moveend zoomend', this._reset, this);
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

            initButtons();
            fetchKPData();
            fetchOvationData();
            setInterval(fetchKPData, 300000);
            setInterval(fetchOvationData, 300000);
            
            animate();
            map.on('click', onMapClick);
        }

        async function fetchKPData() {
            try {
                const response = await fetch(KP_URL);
                const data = await response.json();
                if (data && data.length > 1) {
                    kpIndex = parseFloat(data[data.length - 1][1]);
                    updateUI(kpIndex);
                }
            } catch (e) { console.error("KP fetch error", e); }
        }

        async function fetchOvationData() {
            try {
                const response = await fetch(OVATION_URL);
                ovationData = await response.json();
            } catch (e) { console.error("Ovation fetch error", e); }
        }

        function updateUI(val) {
            document.getElementById('kpVal').innerText = val.toFixed(1);
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('activityText');
            if (val >= 5) { dot.style.background = '#ff3366'; text.innerText = "Voimakas myrsky"; }
            else if (val >= 3) { dot.style.background = '#ffcc00'; text.innerText = "Kohtalainen aktiivisuus"; }
            else { dot.style.background = '#00ffcc'; text.innerText = "Rauhallinen tila"; }
        }

        function drawAurora() {
            if (!ctx || !map) return;
            ctx.clearRect(0, 0, auroraCanvas.width, auroraCanvas.height);
            
            const zoom = map.getZoom();
            // Skaalauskertoimet, jotta animaatio mukautuu zoomaustasoon
            const scaleFactor = Math.pow(2, zoom - 4);
            const layers = Math.floor(4 + (kpIndex / 2));
            const targetLat = 75 - (kpIndex * 2.5);
            
            for (let j = 0; j < layers; j++) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                
                // Blur säätyy zoomin mukaan
                const blurValue = (20 + j * 5) * (zoom / 4);
                ctx.filter = `blur(${blurValue}px)`;

                let hue = 145 + (j * 4);
                if (kpIndex > 4.5 && j === 0) hue = 330; 

                const alpha = (0.3 + (kpIndex/10 * 0.5)) / layers;
                ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
                
                ctx.shadowColor = `hsla(${hue}, 100%, 50%, 0.8)`;
                ctx.shadowBlur = 10 * scaleFactor;
                // Paksuus skaalautuu zoomin mukaan (minimi pidetään järkevänä)
                ctx.lineWidth = Math.max(10, 30 * scaleFactor);
                ctx.lineCap = 'round';

                ctx.beginPath();
                const points = 45;
                for (let i = 0; i <= points; i++) {
                    const lon = -180 + (i / points) * 360;
                    const wave = Math.sin(i * 0.15 + time * 0.3 + j) * (1.1 + kpIndex * 0.4);
                    const point = map.latLngToContainerPoint([targetLat + wave, lon]);
                    
                    if (i === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                }
                ctx.stroke();
                ctx.restore();
            }
        }

        function animate() {
            drawAurora();
            time += 0.006;
            requestAnimationFrame(animate);
        }

        async function onMapClick(e) {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;
            
            // 1. Etsi lähin intensiteetti Ovation-datasta
            let intensity = 0;
            if (ovationData && ovationData.coordinates) {
                let minDist = Infinity;
                ovationData.coordinates.forEach(p => {
                    let pLon = p[0] > 180 ? p[0] - 360 : p[0];
                    let pLat = p[1];
                    let dist = Math.hypot(pLat - lat, pLon - lon);
                    if (dist < minDist) {
                        minDist = dist;
                        intensity = p[2];
                    }
                });
            }

            // 2. Hae sää (pilvisyys)
            const weather = await getWeather(lat, lon);
            const clouds = weather ? weather.clouds : 100;
            
            // 3. Laske todennäköisyyspisteet (0-4)
            let score = 0;
            if (intensity > 20) score += 1;
            if (intensity > 50) score += 1;
            if (clouds < 40) score += 2;
            else if (clouds < 70) score += 1;

            let statusEmoji = '🔴', statusText = 'Heikko mahdollisuus';
            if (score >= 3) { statusEmoji = '🟢'; statusText = 'Erinomainen mahdollisuus!'; }
            else if (score >= 2) { statusEmoji = '🟡'; statusText = 'Kohtalainen mahdollisuus'; }

            const popupContent = `
                <div class="aurora-popup-content">
                    <strong>Revontulien todennäköisyys:</strong><br>
                    <span style="font-size: 1.2em;">${statusEmoji} ${statusText}</span><br><br>
                    Intensiteetti: ${intensity}%<br>
                    Pilvisyys: ${clouds}%<br>
                    Lämpötila: ${weather ? weather.temp + '°C' : '--'}<br><br>
                    <small>Koordinaatit: ${lat.toFixed(3)}, ${lon.toFixed(3)}</small><br>
                    <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank">Avaa Google Mapsissa</a>
                </div>
            `;

            L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(map);
        }

        async function getWeather(lat, lon) {
            try {
                const res = await fetch(`https://repotracker.masto84.workers.dev/?lat=${lat}&lon=${lon}`);
                const data = await res.json();
                return { temp: Math.round(data.main.temp), clouds: data.clouds.all };
            } catch (e) { return null; }
        }

        function initButtons() {
            const forecastBtn = document.getElementById('forecast-btn');
            const closeForecast = document.getElementById('close-forecast');
            const forecastPopup = document.getElementById('forecast-popup');
            const locateBtn = document.getElementById('locate-btn');

            forecastBtn.onclick = (e) => {
                e.stopPropagation();
                forecastPopup.style.display = 'flex';
                fetchAuroraForecast();
            };
            closeForecast.onclick = (e) => {
                e.stopPropagation();
                forecastPopup.style.display = 'none';
            };

            locateBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.geolocation.getCurrentPosition(pos => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    map.setView([lat, lon], 8);
                    if (userMarker) map.removeLayer(userMarker);
                    userMarker = L.marker([lat, lon]).addTo(map);
                }, err => alert("Sijaintia ei voitu hakea."));
            };
        }

        async function fetchAuroraForecast() {
            const ctxChart = document.getElementById('kpChart').getContext('2d');
            // Tyhjennetään vanha jos on
            if (window.myKpChart) window.myKpChart.destroy();
            
            window.myKpChart = new Chart(ctxChart, {
                type: 'line',
                data: {
                    labels: ['00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-00'],
                    datasets: [{ 
                        label: 'Kp-indeksi ennuste', 
                        data: [kpIndex, kpIndex+0.3, kpIndex-0.5, kpIndex+1, kpIndex, kpIndex+0.2, kpIndex-0.1, kpIndex], 
                        borderColor: '#00ffcc', 
                        backgroundColor: 'rgba(0, 255, 204, 0.1)',
                        fill: true,
                        tension: 0.4 
                    }]
                },
                options: {
                    scales: {
                        y: { min: 0, max: 9, grid: { color: 'rgba(255,255,255,0.1)' } },
                        x: { grid: { color: 'rgba(255,255,255,0.1)' } }
                    },
                    plugins: { legend: { labels: { color: '#fff' } } }
                }
            });
        }

        window.onload = initApp;
