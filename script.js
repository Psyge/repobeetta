 let map, auroraCanvas, ctx;
        let time = 0;
        let kpIndex = 3.0;
        let userMarker = null;
        let ovationData = null;
        let placeMarkers = new Map(); // id -> Leaflet marker
        
        const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
        const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';

        // --- App Init ---
        async function initApp() {
            map = L.map('map', {
                center: [65, 25],
                zoom: 4,
                minZoom: 2,
                maxZoom: 15,
                zoomControl: false,
                attributionControl: false
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
                attribution: '&copy; CARTO',
                maxZoom: 20 
            }).addTo(map);

            // Dynaaminen Canvas-kerros revontulille
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

            // Alustetaan painikkeet
            initButtons();
            
            // Ladataan kohteet (markkerit)
            const places = await loadPlaces();
            initMarkers(places);

            // Haetaan datat
            fetchKPData();
            fetchOvationData();
            setInterval(fetchKPData, 300000);
            setInterval(fetchOvationData, 300000);
            
            // Tarkista URL-parametri
            openPlaceFromUrlParam();
            
            animate();
            map.on('click', onMapClick);
        }

        // --- Markkerien hallinta ---
        async function loadPlaces() {
            try {
                const res = await fetch('kohteet/index.json', { cache: 'no-cache' });
                if (!res.ok) throw new Error('index.json ei löydy');
                const manifest = await res.json();
                const files = Array.isArray(manifest.files) ? manifest.files : [];

                const loaded = await Promise.all(
                    files.map(async (file) => {
                        try {
                            const metaRes = await fetch(`kohteet/${file}`, { cache: 'no-cache' });
                            const meta = await metaRes.json();
                            const id = file.replace(/\.json$/i, '').toLowerCase();
                            
                            let description = meta.description || '';
                            if (!description && meta.descriptionFile) {
                                const htmlRes = await fetch(`kohteet/${meta.descriptionFile}`);
                                description = htmlRes.ok ? await htmlRes.text() : '';
                            }

                            return {
                                id, name: meta.name, lat: meta.lat, lon: meta.lon,
                                icon: meta.icon || 'images/iconi.png',
                                description: description,
                                url: meta.url || '',
                                stream: meta.stream || ''
                            };
                        } catch (err) { return null; }
                    })
                );
                return loaded.filter(p => p !== null);
            } catch (e) {
                console.error('Paikkojen lataus epäonnistui:', e);
                return [];
            }
        }

        function initMarkers(places) {
            places.forEach(place => {
                const customIcon = L.icon({
                    iconUrl: place.icon,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    popupAnchor: [0, -32]
                });

                const marker = L.marker([place.lat, place.lon], { icon: customIcon }).addTo(map);
                
                marker.on('click', async (e) => {
                    L.DomEvent.stopPropagation(e);
                    await showAuroraPopup(place.lat, place.lon, marker, true, place);
                });

                placeMarkers.set(place.id, marker);
            });
        }

        async function openPlaceFromUrlParam() {
            const params = new URLSearchParams(window.location.search);
            const kohdeId = params.get('kohde')?.toLowerCase();
            if (kohdeId && placeMarkers.has(kohdeId)) {
                const m = placeMarkers.get(kohdeId);
                map.setView(m.getLatLng(), 10);
                m.fire('click');
            }
        }

        // --- Revontulianimaatio (Canvas) ---
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
                const blurValue = (20 + j * 5) * (zoom / 4);
                ctx.filter = `blur(${blurValue}px)`;
                let hue = 145 + (j * 4);
                if (kpIndex > 4.5 && j === 0) hue = 330; 
                const alpha = (0.3 + (kpIndex/10 * 0.5)) / layers;
                ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
                ctx.shadowColor = `hsla(${hue}, 100%, 50%, 0.8)`;
                ctx.shadowBlur = 10 * scaleFactor;
                ctx.lineWidth = Math.max(10, 30 * scaleFactor);
                ctx.lineCap = 'round';
                ctx.beginPath();
                const points = 45;
                for (let i = 0; i <= points; i++) {
                    const lon = -180 + (i / points) * 360;
                    const wave = Math.sin(i * 0.15 + time * 0.3 + j) * (1.1 + kpIndex * 0.4);
                    const pt = map.latLngToContainerPoint([targetLat + wave, lon]);
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
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

        // --- Popup ja säälogiikka ---
        async function onMapClick(e) {
            await showAuroraPopup(e.latlng.lat, e.latlng.lng);
        }

        async function showAuroraPopup(lat, lon, marker = null, showDetails = true, place = null) {
            let intensity = 0;
            if (ovationData?.coordinates) {
                let minDist = Infinity;
                ovationData.coordinates.forEach(p => {
                    let pLon = p[0] > 180 ? p[0] - 360 : p[0];
                    let dist = Math.hypot(p[1] - lat, pLon - lon);
                    if (dist < minDist) { minDist = dist; intensity = p[2]; }
                });
            }

            const weather = await getWeather(lat, lon);
            const clouds = weather ? weather.clouds : 100;
            
            let score = 0;
            if (intensity > 25) score += 1;
            if (intensity > 50) score += 1;
            if (clouds < 35) score += 2;
            else if (clouds < 65) score += 1;

            let statusEmoji = '🔴', statusText = 'Heikko';
            if (score >= 3) { statusEmoji = '🟢'; statusText = 'Erinomainen!'; }
            else if (score >= 2) { statusEmoji = '🟡'; statusText = 'Kohtalainen'; }

            let content = `
                <div class="aurora-popup-content">
                    <strong>${place ? place.name : 'Valittu sijainti'}</strong><br>
                    Mahdollisuus: ${statusEmoji} ${statusText}<br>
                    Intensiteetti: ${intensity.toFixed(0)}% | Pilvet: ${clouds}%<br>
                    Lämpötila: ${weather ? weather.temp + '°C' : '--'}<br>
            `;

            if (place) {
                content += `<button onclick='window.parent.postMessage({type:"showPlace", id:"${place.id}"}, "*")' style="margin-top:5px; cursor:pointer;">Lue lisää</button><br>`;
                // Jos haluat käyttää sivun omaa showPlaceInfoa suoraan:
                if (typeof showPlaceInfo === 'function') {
                    content += `<a href="#" onclick="event.preventDefault(); showPlaceInfo(${JSON.stringify(place).replace(/"/g, '&quot;')})">Lue lisää</a><br>`;
                }
            }

            content += `<small>${lat.toFixed(3)}, ${lon.toFixed(3)}</small><br>
                        <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank">Google Maps</a></div>`;

            if (marker) {
                marker.bindPopup(content).openPopup();
            } else {
                L.popup().setLatLng([lat, lon]).setContent(content).openOn(map);
            }
        }

        async function getWeather(lat, lon) {
            try {
                const res = await fetch(`https://repotracker.masto84.workers.dev/?lat=${lat}&lon=${lon}`);
                const data = await res.json();
                return { temp: Math.round(data.main.temp), clouds: data.clouds.all };
            } catch (e) { return null; }
        }

        // --- UI & Ennusteet ---
        function initButtons() {
            document.getElementById('forecast-btn').onclick = (e) => {
                e.stopPropagation();
                document.getElementById('forecast-popup').style.display = 'flex';
                fetchAuroraForecast();
            };
            document.getElementById('close-forecast').onclick = (e) => {
                e.stopPropagation();
                document.getElementById('forecast-popup').style.display = 'none';
            };
            document.getElementById('locate-btn').onclick = (e) => {
                e.stopPropagation();
                navigator.geolocation.getCurrentPosition(pos => {
                    map.setView([pos.coords.latitude, pos.coords.longitude], 8);
                });
            };
        }

        async function fetchKPData() {
            try {
                const res = await fetch(KP_URL);
                const data = await res.json();
                if (data.length > 1) {
                    kpIndex = parseFloat(data[data.length - 1][1]);
                    updateUI(kpIndex);
                }
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
            const dot = document.getElementById('statusDot');
            dot.style.background = val >= 5 ? '#ff3366' : (val >= 3 ? '#ffcc00' : '#00ffcc');
            document.getElementById('activityText').innerText = val >= 5 ? "Myrsky" : (val >= 3 ? "Aktiivista" : "Rauhallista");
        }

        function fetchAuroraForecast() {
            const ctxChart = document.getElementById('kpChart').getContext('2d');
            if (window.myKpChart) window.myKpChart.destroy();
            window.myKpChart = new Chart(ctxChart, {
                type: 'line',
                data: {
                    labels: ['00','03','06','09','12','15','18','21'],
                    datasets: [{ 
                        label: 'Kp', data: [kpIndex, kpIndex+1, kpIndex, kpIndex-1, kpIndex, kpIndex+0.5, kpIndex, kpIndex],
                        borderColor: '#00ffcc', tension: 0.4 
                    }]
                },
                options: { scales: { y: { min: 0, max: 9 } } }
            });
        }

        // --- Säilytetään "Lue lisää" yhteensopivuus ---
        function showPlaceInfo(place) {
            const def = document.getElementById('aurora-default');
            const info = document.getElementById('place-info');
            if (def) def.style.display = 'none';
            if (info) {
                info.style.display = 'block';
                info.innerHTML = `<h3>${place.name}</h3>${place.description}<br><button onclick="document.getElementById('place-info').style.display='none'; document.getElementById('aurora-default').style.display='block';">Sulje</button>`;
            }
        }

        window.onload = initApp;
