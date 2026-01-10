let map;
let auroraCanvas = null; // Alustetaan nulliksi
let ctx = null;          // Alustetaan nulliksi
let userMarker = null;
let currentData = null;
let placeMarkers = new Map();
let animationFrameId;
let kpChartInstance = null;

// Spritet ja säädöt
let spriteGreen, spriteYellow, spriteRed, currentRadius = 0;

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

        const id = file.replace(/\.json$/i, '');

        // Tuki joko suoraan JSON "description" -kentälle tai erilliselle HTML-tiedostolle "descriptionFile"
        let description = meta.description || '';
        if (!description && meta.descriptionFile) {
          const htmlRes = await fetch(`kohteet/${meta.descriptionFile}`, { cache: 'no-cache' });
          description = htmlRes.ok ? await htmlRes.text() : '';
        }

        return {
          id,
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
  
const t = e.originalEvent?.target;
  if (t && (t.closest('#forecast-btn')
         || t.closest('#close-forecast')
         || t.closest('#forecast-popup')
         || t.closest('#menu-btn')
         || t.closest('#menu')
         || t.closest('#locate-btn'))) {
    return; // älä käsittele tätä karttaklkkina
  }

  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  await showAuroraPopup(lat, lon, null, true);
}

// ---------------------
// App init / Leaflet
// ---------------------

async function initAppMap() {
  if (typeof L === 'undefined') return;

  // 1. Alustetaan kartta
  map = L.map('map', { 
    center: [65, 25], 
    zoom: 4, 
    minZoom: 3, // NOSTETTU: Estää karttaa näkymästä liian pienenä (poistaa valkoiset reunat)
    maxZoom: 18, 
    worldCopyJump: false, 
    maxBoundsViscosity: 1.0, 
    bounceAtZoomLimits: true
  });

  // 2. Taustaväri Leaflet-konttiin (viimeinen lukko valkoista vastaan)
  document.getElementById('map').style.background = '#000000';

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    noWrap: true, // Karttaa näkyy vain yksi kappale
    bounds: [[-90, -180], [90, 180]],
    maxZoom: 22
  }).addTo(map);

  // 3. Tiukat rajat, jotka estävät selaamisen tyhjyyteen
  const bounds = [[-85, -180], [85, 180]];
  map.setMaxBounds(bounds);

  // --- KORJAUS TÖKSÄHDYKSEEN ---
  // Odotetaan hetki, että DOM on varmasti asettunut
  setTimeout(() => {
    map.invalidateSize(); // Pakottaa kartan täyttämään tilan oikein
    document.getElementById('map').classList.add('map-ready');
  }, 50);

  const auroraLayerInstance = new AuroraLayer();
  map.addLayer(auroraLayerInstance);

  map.setMaxBounds([[-90, -180], [90, 180]]);
  map.on('click', onMapClick);

  const places = await loadPlaces();
  if (places.length > 0 && typeof initMarkers === 'function') {
      initMarkers(map, getWeather, showPlaceInfo, places);
  }

  fetchAuroraData();
  setInterval(fetchAuroraData, 5 * 60 * 1000);
  await openPlaceFromUrlParam();
}




console.debug('Saatavilla marker-id:t:', Array.from(placeMarkers.keys()));
async function openPlaceFromUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const kohdeIdRaw = params.get('kohde'); // määritellään ensin
  if (!kohdeIdRaw) return;

  const kohdeId = kohdeIdRaw.toLowerCase(); // normalisointi
  const existing = placeMarkers.get(kohdeId);

  if (!existing) {
    console.warn(`Markeria ei löytynyt id:llä "${kohdeId}". Saatavilla:`, Array.from(placeMarkers.keys()));
    return; // ei fallbackia → ei luoda uutta popupia
  }

  const ll = existing.getLatLng();
  map.setView(ll, Math.max(map.getZoom(), 12));
  existing.openPopup();
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
      e.preventDefault();     // tämä linkki avaa popupin
      e.stopPropagation();
      helpPopup.style.display = 'flex';
    });
  }

  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('menu');
  const forecastBtn = document.getElementById('forecast-btn');
  const forecastPopup = document.getElementById('forecast-popup');
  const closeForecast = document.getElementById('close-forecast');
  const locateBtn = document.getElementById('locate-btn');

  // 1) Nappulat (eivät navigoi)
  [menuBtn, forecastBtn, closeForecast, locateBtn, closePopupBtn]
    .filter(Boolean)
    .forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

  // 2) Kontit (menu, forecastPopup, helpPopup): EI preventDefault
  [menu, forecastPopup, helpPopup]
    .filter(Boolean)
    .forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      if (typeof L !== 'undefined') {
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);
      }
    });

  // 3) Menun linkit: navigoivat
  document.querySelectorAll('#menu a[href]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.stopPropagation(); // sallitaan navigointi, estetään vain kartan reagointi
      // a.target = '_self'; // halutessa varmistus
    });
  });

  // 4) Menu toggle
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => {
      menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
    });
  }

  // 5) Forecast-popup avaus/sulku
  if (forecastBtn && forecastPopup) {
    forecastBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      forecastPopup.style.display = 'flex';
      await ensureChartJs();
      fetchAuroraForecast();
    });
  }
  if (closeForecast && forecastPopup) {
    closeForecast.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      forecastPopup.style.display = 'none';
    });
  }

  // 6) Geolokaatio
  if (locateBtn) {
    locateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!navigator.geolocation) {
            alert('Geolocation not supported in this browser.');
            return;
        }

        // Lisätään visuaalinen palaute, että jotain tapahtuu
        const originalText = locateBtn.innerText;
        if (window.innerWidth <= 768) {
            locateBtn.innerText = "⏳"; // Vaihdetaan ikoni lataukseksi mobiilissa
        } else {
            locateBtn.innerText = "Locating...";
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                // Palautetaan nappi normaaliksi
                locateBtn.innerText = window.innerWidth <= 768 ? "" : originalText;
                
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                map.setView([lat, lon], 6);
                
                if (!userMarker) {
                    userMarker = L.marker([lat, lon]).addTo(map);
                } else {
                    userMarker.setLatLng([lat, lon]);
                }
                
                await showAuroraPopup(lat, lon, userMarker, false);
            },
            (err) => {
                // Palautetaan nappi virheen sattuessa
                locateBtn.innerText = window.innerWidth <= 768 ? "" : originalText;
                
                if (err.code === 1) {
                    alert('Salli paikannus selaimen asetuksista.');
                } else if (err.code === 3) {
                    alert('Paikannus aikakatkaistiin. Yritä uudelleen, laite herää yleensä toisella kerralla.');
                } else {
                    alert('Location failed: ' + err.message);
                }
            },
            { 
                enableHighAccuracy: false, // NOPEAMPI: käyttää WiFi/mobiiliverkkoa GPS:n sijaan
                timeout: 15000,            // Hieman enemmän pelivaraa (15s)
                maximumAge: 60000          // Käyttää max 1min vanhaa sijaintia (erittäin nopea!)
            }
        );
    });
}
}



// ------------------------
// NOAA (Ovation) overlay
// ------------------------
const AuroraLayer = L.Layer.extend({
    onAdd: function(map) {
        this._container = L.DomUtil.create('div', 'leaflet-aurora-layer');
        this._canvas = L.DomUtil.create('canvas', 'aurora-canvas', this._container);
        map.getPanes().overlayPane.appendChild(this._container);
        auroraCanvas = this._canvas;
        ctx = auroraCanvas.getContext('2d');
        
        map.on('move moveend zoomend', this._update, this);
        this._startAnimation(); // Käynnistetään liike
        this._update();
    },
    onRemove: function(map) {
        cancelAnimationFrame(animationFrameId);
    },
    _startAnimation: function() {
    let lastFrameTime = 0;
    const fps = 25; // Rajoitetaan FPS
    const interval = 1000 / fps;

    const render = (now) => {
        if (!lastFrameTime) lastFrameTime = now;
        const delta = now - lastFrameTime;

        if (delta > interval) {
            if (currentData) drawAuroraOverlay(currentData.coordinates);
            lastFrameTime = now - (delta % interval);
        }
        animationFrameId = requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
},
_update: function() {
    const size = map.getSize();
    // Kohdistetaan canvas kartan vasempaan ylänurkkaat (0,0)
    const topLeft = map.containerPointToLayerPoint([0, 0]); 
    L.DomUtil.setPosition(this._canvas, topLeft);
    
    // Asetetaan kankaan koko vastaamaan näkyvää aluetta
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    
    const zoom = map.getZoom();
    const blurValue = zoom > 8 ? 20 : Math.max(12, zoom * 3.5);
    this._canvas.style.filter = `blur(${blurValue}px)`;
}
});

function createSprites(radius) {
    if (radius === currentRadius) return;
    currentRadius = radius;
    
    const create = (color) => {
        const s = document.createElement('canvas');
        s.width = s.height = radius * 4;
        const c = s.getContext('2d');
        const center = s.width / 2;
        const g = c.createRadialGradient(center, center, 0, center, center, radius);
        g.addColorStop(0, `rgba(${color}, 0.9)`); // Vahva keskusta
        g.addColorStop(0.4, `rgba(${color}, 0.2)`); 
        g.addColorStop(1, `rgba(${color}, 0)`);
        c.fillStyle = g;
        c.fillRect(0, 0, s.width, s.height);
        return s;
    };
    
    // Neon-värikoodit
    spriteGreen = create('50, 255, 150');  // Sähköinen vihreä
    spriteYellow = create('200, 255, 0'); // Neon lime
    spriteRed = create('255, 0, 100');    // Neon pinkki/punainen
}

function drawAuroraOverlay(points) {
    if (!ctx || !points || !auroraCanvas) return;
    ctx.clearRect(0, 0, auroraCanvas.width, auroraCanvas.height);
    
    const zoom = map.getZoom();
    const time = Date.now() * 0.001;
    
    // TÄMÄ ON SE KORJAUS: latShift siirtää hohdetta asteina (pohjoiseen)
    // Kokeile arvoa 1.8 tai 2.0, se skaalautuu nyt oikein zoomatessa.
    const latShift = 1.8; 

    let radius = zoom * 10;
    if (zoom > 7) radius = zoom * 50; 
    if (zoom > 10) radius = zoom * 100;

    createSprites(radius);
    ctx.globalCompositeOperation = 'screen';

    points.forEach((p, index) => {
        const lat = p[1];
        const intensity = p[2];
        if (lat < 45 || intensity < 4) return;

        let lon = p[0];
        if (lon > 180) lon -= 360;

        const offsetLat = Math.sin(time + index) * 0.2; 
        const offsetLon = Math.cos(time * 0.8 + index) * 0.2;

        // Lasketaan sijainti: lat + animaatio + manuaalinen korjaus
        const pos = map.latLngToContainerPoint([lat + offsetLat + latShift, lon + offsetLon]);

        // Määritellään sprite intensiteetin mukaan (Tämä puuttui aiemmin!)
        let sprite = spriteGreen;
        if (intensity > 35) sprite = spriteYellow;
        if (intensity > 70) sprite = spriteRed;

        const zoomAlpha = zoom > 8 ? 0.6 : 0.4;
        ctx.globalAlpha = Math.min(zoomAlpha, (intensity / 100));
        
        // Piirretään suoraan laskettuun pisteeseen
        ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height / 2);

        if (zoom > 8) {
            ctx.globalAlpha *= 0.4;
            const pulse = Math.sin(time * 2 + index) * 0.1 + 1;
            ctx.drawImage(sprite, 
                pos.x - (sprite.width * 1.8 * pulse) / 2, 
                pos.y - (sprite.height * 1.8 * pulse) / 2, 
                sprite.width * 1.8 * pulse, 
                sprite.height * 1.8 * pulse
            );
        }
    });
}
async function fetchAuroraData() {
    try {
        const res = await fetch('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json');
        const data = await res.json();
        currentData = data;
        
        if (document.getElementById('loader')) {
            document.getElementById('loader').style.display = 'none';
        }

        // Kutsutaan piirtoa vain jos karttataso on jo valmis
        if (ctx) {
            drawAuroraOverlay(data.coordinates);
        }
    } catch (err) {
        console.error('Aurora data error:', err);
    }
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

    // --- TÄRKEÄ KORJAUS: TUHOTAAN VANHA KAAVIO ---
    if (kpChartInstance) {
      kpChartInstance.destroy();
    }

    // Luodaan uusi kaavio ja tallennetaan se muuttujaan
    kpChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: times,
        datasets: [
          { label: dayLabels[0], data: day1, borderColor: '#00ffcc', pointBackgroundColor: day1.map(kp => kp < 3 ? '#00ffcc' : kp < 5 ? '#ffcc00' : '#ff3366'), pointRadius: 5, tension: 0.3, fill: false },
          { label: dayLabels[1], data: day2, borderColor: '#6f42c1', pointBackgroundColor: day2.map(kp => kp < 3 ? '#00ffcc' : kp < 5 ? '#ffcc00' : '#ff3366'), pointRadius: 5, tension: 0.3, fill: false },
          { label: dayLabels[2], data: day3, borderColor: '#20c997', pointBackgroundColor: day3.map(kp => kp < 3 ? '#00ffcc' : kp < 5 ? '#ffcc00' : '#ff3366'), pointRadius: 5, tension: 0.3, fill: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#fff' } },
          tooltip: { 
            callbacks: { 
              label: function(context) { 
                const kp = context.parsed.y; 
                if (kp >= 5) return `Kp ${kp} - High chance`; 
                if (kp >= 3) return `Kp ${kp} - Moderate chance`; 
                return `Kp ${kp} - Low chance`; 
              } 
            } 
          }
        },
        scales: { 
          y: { 
            min: 0, max: 9, 
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#fff' },
            title: { display: true, text: 'Kp Index', color: '#fff' } 
          }, 
          x: { 
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: { color: '#fff' },
            title: { display: true, text: 'UT Time', color: '#fff' } 
          } 
        }
      }
    });

  } catch (error) {
    console.error('Error fetching NOAA forecast:', error);
    const container = document.getElementById('errorMessage');
    if (container) {
      container.textContent = '⚠️ Error downloading NOAA data: ' + error.message;
      container.style.color = '#ff3366';
      container.style.fontWeight = 'bold';
    }
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  // 1) UI-napit (menu, help-popup, forecast, locate, jne.) AINA
  if (typeof initButtons === 'function') {
    try { initButtons(); } catch (e) { console.error('initButtons error:', e); }
  }

  // 2) Kartta vain jos #map löytyy ja Leaflet on ladattu
  const hasMap = !!document.getElementById('map');
  const leafletLoaded = (typeof L !== 'undefined');

  if (hasMap && leafletLoaded && typeof initAppMap === 'function') {
    try { 
      await initAppMap(); 
      
      // --- LISÄTTY TÄMÄ OSA ---
      // Kun kartta on alustettu (await valmis), pakotetaan koon tunnistus
      // Tämä poistaa hyppimisen ja varmistaa, että kartta täyttää ruudun
      setTimeout(() => {
        if (typeof map !== 'undefined' && map) {
          map.invalidateSize();
          console.log("Kartan koko vakautettu latauksen jälkeen.");
        }
      }, 300);
      // -------------------------

    } catch (e) { console.error('initAppMap error:', e); }
  }

  // 3) Globaali koonmuutos-kuuntelija (varmistus mobiilikääntöihin)
  window.addEventListener('resize', () => {
    if (typeof map !== 'undefined' && map) {
      map.invalidateSize();
    }
  });
});



















