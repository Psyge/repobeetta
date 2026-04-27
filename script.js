// ===============================
// RepoTracker — script.js (FIXED)
// ===============================

// FIX #1: Yksi jaettu vakio. Päivitä myös markers.js jos vaihdat URL:n.
const WEATHER_WORKER_URL = 'https://proud-union-1e84.masto84.workers.dev';

let map;
let auroraCanvas = null;
let ctx = null;
let userMarker = null;
let currentData = null;
// FIX #3: Tehdään globaaliksi jotta markers.js voi kirjoittaa siihen
window.placeMarkers = new Map();
let placeMarkers = window.placeMarkers;
let animationFrameId;
let kpChartInstance = null;

// =====================================================
// PREMIUM-tila (mock — vaihdetaan oikeaan auth-flowiin myöhemmin)
// Aktivointi:
//   1) URL-parametri:  ?premium=1
//   2) Koodi paneelista: AURORA2026
//   3) Konsoli: localStorage.setItem('rt_premium','1')
// Poisto: localStorage.removeItem('rt_premium')
// =====================================================
const PREMIUM_CODES = ['AURORA2026', 'TESTI'];
function isPremium() {
  try { return localStorage.getItem('rt_premium') === '1'; } catch (e) { return false; }
}
function setPremium(on) {
  try {
    if (on) localStorage.setItem('rt_premium', '1');
    else    localStorage.removeItem('rt_premium');
  } catch (e) {}
  refreshPremiumUI();
}
window.RT_setPremium = setPremium;
window.RT_isPremium  = isPremium;

// Tarkista URL-parametri heti latauksessa
(function checkPremiumFromUrl(){
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get('premium') === '1') localStorage.setItem('rt_premium', '1');
    if (p.get('premium') === '0') localStorage.removeItem('rt_premium');
  } catch (e) {}
})();

// Päivittää premium-teaser-paneelin tilan mukaan
function refreshPremiumUI() {
  const premium = isPremium();
  const teaser  = document.getElementById('premium-teaser');
  if (!teaser) return;

  const lockIcon    = document.getElementById('premium-lock-icon');
  const statusLabel = document.getElementById('premium-status-label');
  const toggleLink  = document.getElementById('premium-toggle-link');
  const title       = document.getElementById('premium-title');
  const desc        = document.getElementById('premium-desc');
  const ctaBtn      = document.getElementById('premium-cta-btn');
  const list        = document.getElementById('premium-forecast-list');

  if (premium) {
    teaser.style.borderColor = 'rgba(0,255,204,0.6)';
    teaser.style.boxShadow   = '0 10px 30px rgba(0,255,204,0.18)';
    if (lockIcon)    lockIcon.textContent = '✓';
    if (statusLabel) statusLabel.textContent = 'Premium aktiivinen';
    if (toggleLink)  toggleLink.textContent = 'Vaihda perustilaan';
    if (title)       title.textContent = 'Tunti-ennuste sijaintiisi';
    if (desc)        desc.innerHTML = 'Klikkaa karttapistettä → näet 6h tarkan ennusteen valitulle sijainnille.';
    if (ctaBtn)      ctaBtn.textContent = 'Avaa 3-päivän Kp-ennuste';
  } else {
    teaser.style.borderColor = 'rgba(0,255,204,0.25)';
    teaser.style.boxShadow   = '0 10px 30px rgba(0,0,0,0.5)';
    if (lockIcon)    lockIcon.textContent = '🔒';
    if (statusLabel) statusLabel.textContent = 'Premium';
    if (toggleLink)  toggleLink.textContent = 'Aktivoi';
    if (title)       title.textContent = 'Tarkka tunti-ennuste';
    if (desc)        desc.innerHTML = 'Karttaklikkaus näyttää karkean Kp-arvion. Premium paljastaa Bz:n, pimeyden, kuun ja sijainnin tarkan vaikutuksen.';
    if (ctaBtn)      ctaBtn.textContent = 'Avaa Premium →';
  }

  // Päivitä tuntiennuste-teaser viimeisimmästä klikkauksesta
  if (list) {
    if (window._lastPopupContext) {
      list.innerHTML = buildHourlyTeaserHTML(window._lastPopupContext, premium);
    } else {
      list.innerHTML = '<div style="opacity:0.5; text-align:center; padding:8px 0; font-size:10px;">Klikkaa karttaa ladataksesi…</div>';
    }
  }
}
window.refreshPremiumUI = refreshPremiumUI;

// Rakentaa "tunti-ennusteen" — käyttää AuroraEngineä projektioon. Premium näkee kaikki 6 tuntia,
// ilmainen näkee vain seuraavan tunnin trendinuolen + sumennetun listan.
function buildHourlyTeaserHTML(ctx, premium) {
  if (!window.AuroraEngine) return '<div style="font-size:10px; color:#888;">Ei dataa</div>';
  const now = new Date();
  const rows = [];
  for (let h = 1; h <= 6; h++) {
    const t = new Date(now.getTime() + h * 3600 * 1000);
    // Yksinkertainen projektio: pidetään OVATION & sää vakiona, päivitetään pimeys/kuu ajan myötä.
    // (Oikea malli vaatisi NOAA 3-day Kp -ennusteen interpolointia tunneiksi.)
    let projected;
    try {
      projected = window.AuroraEngine.computeAuroraScore({
        ovation:   ctx.ovationProb,
        clouds:    ctx.clouds,
        lat:       ctx.lat,
        lon:       ctx.lon,
        date:      t,
        solarWind: ctx.solarWind
      });
    } catch (e) { projected = { score: ctx.premiumScore }; }
    const hh = String(t.getHours()).padStart(2,'0');
    const mm = String(t.getMinutes()).padStart(2,'0');
    rows.push({ time: `${hh}:${mm}`, score: projected.score });
  }
  // Trendi
  const trend = rows[rows.length-1].score - rows[0].score;
  const trendLabel = trend > 5 ? 'nouseva ↑' : trend < -5 ? 'laskeva ↓' : 'tasainen →';
  const trendColor = trend > 5 ? '#00ffcc' : trend < -5 ? '#ff3366' : '#ffcc00';

  if (premium) {
    const list = rows.map(r => {
      const c = r.score >= 60 ? '#00ffcc' : r.score >= 30 ? '#ffcc00' : '#888';
      const star = r.score >= 60 ? ' ✨' : '';
      return `<div style="display:flex; justify-content:space-between; padding:2px 0;"><span>${r.time}</span><b style="color:${c};">${r.score}%${star}</b></div>`;
    }).join('');
    return `
      <div style="font-size:9px; color:#888; margin-bottom:4px;">Trendi: <b style="color:${trendColor};">${trendLabel}</b></div>
      ${list}
    `;
  } else {
    // Ilmainen: näytä vain ensimmäinen tunti selvästi, loput sumennettu
    const first = rows[0];
    const c = first.score >= 60 ? '#00ffcc' : first.score >= 30 ? '#ffcc00' : '#888';
    const blurredRest = rows.slice(1).map(r =>
      `<div style="display:flex; justify-content:space-between; padding:2px 0; filter:blur(3.5px);"><span>${r.time}</span><b>${r.score}%</b></div>`
    ).join('');
    return `
      <div style="font-size:9px; color:#888; margin-bottom:4px;">Seuraava tunti · trendi <b style="color:${trendColor};">${trendLabel}</b></div>
      <div style="display:flex; justify-content:space-between; padding:2px 0;"><span>${first.time}</span><b style="color:${c};">${first.score}%</b></div>
      <div style="position:relative; user-select:none; pointer-events:none;">
        ${blurredRest}
      </div>
    `;
  }
}

// Spritet ja säädöt
let spriteGreen, spriteYellow, spriteRed, currentRadius = 0;

// ------------------------------
// Weather from Cloudflare Worker
// ------------------------------
async function getWeather(lat, lon) {
  const url = `${WEATHER_WORKER_URL}/?lat=${lat}&lon=${lon}`;
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
      clouds: data.clouds?.all ?? 100,
      source: data.source || 'OpenWeather'
    };
  } catch (err) {
    console.error('Weather fetch error:', err);
    return null;
  }
}
window.getWeather = getWeather;

// ----------------------------------------------
// Places loader (kohteet/index.json + per-kohde)
// ----------------------------------------------
async function loadPlaces() {
  try {
    const prefix = window.location.pathname.includes('/map/') ? '../' : '';
    const res = await fetch(`${prefix}kohteet/index.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${prefix}kohteet/index.json ei löydy`);

    const manifest = await res.json();
    const files = Array.isArray(manifest.files) ? manifest.files : [];

    const loaded = await Promise.all(
      files.map(async (file) => {
        const metaRes = await fetch(`${prefix}kohteet/${file}`, { cache: 'no-cache' });
        const meta = await metaRes.json();
        return {
          ...meta,
          id: file.replace(/\.json$/i, ''),
          icon: meta.icon
            ? (meta.icon.startsWith('http') ? meta.icon : prefix + meta.icon)
            : `${prefix}images/iconi.png`
        };
      })
    );
    return loaded;
  } catch (e) {
    console.error('Paikkojen lataus epäonnistui:', e);
    return [];
  }
}

// FIX #8: Poistettu kuollut createCustomMarker — markers.js tekee tämän nyt itse.

// ------------------------------------
// "Read more" -paneeli
// ------------------------------------
function showPlaceInfo(place) {
  const defaultSection = document.getElementById('aurora-default');
  const infoSection = document.getElementById('place-info');

  if (defaultSection) defaultSection.style.display = 'none';
  if (infoSection) infoSection.style.display = 'block';

  // FIX #6: Korjattu rikkinäinen <a>-tagi
  const linkHtml = place.url
    ? `<p><a href="${place.url}" target="_blank" rel="noopener">Visit website</a></p>`
    : '';

  // FIX #7: Korjattu rikkinäinen <iframe>-tagi
  const streamHtml = place.stream
    ? `<iframe src="${place.stream}" width="${place.streamWidth || 320}" height="${place.streamHeight || 180}" style="border:none;" allowfullscreen></iframe>`
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

// ---------------------
// Karttaklikki → popup
// ---------------------
async function onMapClick(e) {
  const t = e.originalEvent?.target;
  if (t && (t.closest('#forecast-btn')
         || t.closest('#close-forecast')
         || t.closest('#forecast-popup')
         || t.closest('.menu-trigger')
         || t.closest('#side-menu')
         || t.closest('#locate-btn')
         || t.closest('.toggle-container'))) {
    return;
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

  map = L.map('map', {
    center: [65, 25],
    zoom: 4,
    minZoom: 3,
    maxZoom: 18,
    worldCopyJump: false,
    maxBoundsViscosity: 1.0,
    bounceAtZoomLimits: true
  });
  // FIX #12: Tehdään globaaliksi jotta inline-skriptit löytävät
  window.map = map;

  document.getElementById('map').style.background = '#000000';

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    noWrap: true,
    bounds: [[-90, -180], [90, 180]],
    maxZoom: 22
  }).addTo(map);

  map.setMaxBounds([[-85, -180], [85, 180]]);

  setTimeout(() => {
    map.invalidateSize();
    document.getElementById('map').classList.add('map-ready');
  }, 50);

  const auroraLayerInstance = new AuroraLayer();
  map.addLayer(auroraLayerInstance);

  map.on('click', onMapClick);

  const places = await loadPlaces();
  if (places.length > 0 && typeof initMarkers === 'function') {
    initMarkers(map, getWeather, showPlaceInfo, places);

    // FIX #3: Käytetään oikeaa nimeä (markersLayer eikä markerGroup)
    if (window.markersLayer) {
      window.markersLayer.addTo(map);
    }

    const placesToggle = document.getElementById('toggle-places');
    if (placesToggle) placesToggle.checked = true;
  }

  fetchAuroraData();
  setInterval(fetchAuroraData, 5 * 60 * 1000);
  await openPlaceFromUrlParam();
}

async function openPlaceFromUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const kohdeIdRaw = params.get('kohde');
  if (!kohdeIdRaw) return;

  const kohdeId = kohdeIdRaw.toLowerCase();
  const existing = placeMarkers.get(kohdeId);

  if (!existing) {
    console.warn(`Markeria ei löytynyt id:llä "${kohdeId}". Saatavilla:`, Array.from(placeMarkers.keys()));
    return;
  }

  const ll = existing.getLatLng();
  map.setView(ll, Math.max(map.getZoom(), 12));
  existing.openPopup();
}

// ---------------------------------------
// Auroran mahdollisuus -popup
// ---------------------------------------
async function showAuroraPopup(lat, lon, marker = null, showGoogleMapsLink = true) {
  let auroraIntensity = 0;

  if (currentData && Array.isArray(currentData.coordinates)) {
    let nearest = null, minDist = Infinity;
    currentData.coordinates.forEach((p) => {
      let pointLon = p[0] < 0 ? p[0] + 360 : p[0];
      const pointLat = p[1], intensity = p[2];
      const dist = Math.hypot(pointLat - lat, Math.abs(pointLon - lon));
      if (dist < minDist) {
        minDist = dist;
        nearest = intensity;
      }
    });
    auroraIntensity = nearest || 0;
  }

  const weather = await getWeather(lat, lon);
  const clouds = weather ? weather.clouds : 100;
  const source = weather ? weather.source : 'Unknown';
  const temp = weather ? weather.temp : 'N/A';

  // ===== UUSI MULTI-FACTOR ENNUSTUS =====
  // OVATION: skaalataan intensity (0..50+) → todennäköisyys 0..100
  const ovationProb = Math.min((auroraIntensity / 50) * 100, 100);

  // Aurinkotuuli (DSCOVR) jos saatavilla
  let solarWindBoost = null;
  if (window.SolarWind) {
    try {
      const sw = await window.SolarWind.getSolarWind();
      solarWindBoost = window.SolarWind.computeBoost(sw);
      window._lastSolarWind = sw; // talteen forecast-paneelia varten
    } catch (e) { console.warn('SW fetch failed', e); }
  }

  // Aja multi-factor moottori
  let result;
  if (window.AuroraEngine) {
    result = window.AuroraEngine.computeAuroraScore({
      ovation: ovationProb,
      clouds:  clouds,
      lat, lon,
      date: new Date(),
      solarWind: solarWindBoost
    });
  } else {
    // Fallback vanha logiikka
    const cloudVis = (100 - clouds) / 100;
    let p = Math.round(ovationProb * cloudVis);
    if (clouds > 85) p = Math.min(p, 5);
    if (auroraIntensity < 2) p = 0;
    result = { score: p, status: p >= 70 ? 'high' : p >= 30 ? 'moderate' : 'low',
               factors: { ovation: Math.round(ovationProb), clouds: Math.round(cloudVis*100),
                          darkness: 100, moon: 100, latitude: 100, solarWind: 100, magLat: lat },
               advice: '' };
  }

  const finalProbability = result.score;
  let statusEmoji = '🔴', statusText = 'Low chance', statusColor = '#ff3366';
  if (result.status === 'extreme')  { statusEmoji = '🟢'; statusText = 'EXTREME!';     statusColor = '#00ffcc'; }
  else if (result.status === 'high'){ statusEmoji = '🟢'; statusText = 'High chance!'; statusColor = '#00ffcc'; }
  else if (result.status === 'moderate'){ statusEmoji = '🟡'; statusText = 'Moderate'; statusColor = '#ffcc00'; }

  // ============================================================
  // ILMAINEN vs PREMIUM näkymä
  // Ilmainen: karkea Kp×pilvet (ei Bz/pimeys/kuu/lat -tarkennuksia)
  // Premium:  täysi 6-faktorin erittely
  // ============================================================
  const premium = isPremium();

  // Karkea Kp-pohjainen luku ilmaisille (sama logiikka kuin vanha fallback)
  const cloudVisFree = (100 - clouds) / 100;
  let basicProbability = Math.round(ovationProb * cloudVisFree);
  if (clouds > 85) basicProbability = Math.min(basicProbability, 5);
  if (auroraIntensity < 2) basicProbability = 0;
  let basicEmoji = '🔴', basicText = 'Low chance', basicColor = '#ff3366';
  if (basicProbability >= 60)      { basicEmoji = '🟢'; basicText = 'High chance!'; basicColor = '#00ffcc'; }
  else if (basicProbability >= 30) { basicEmoji = '🟡'; basicText = 'Moderate';     basicColor = '#ffcc00'; }

  // Tallenna premium-teaserille
  window._lastPopupContext = {
    lat, lon, clouds, ovationProb, auroraIntensity,
    premiumScore: finalProbability,
    basicScore: basicProbability,
    factors: result.factors,
    solarWind: solarWindBoost
  };

  const shownProb   = premium ? finalProbability : basicProbability;
  const shownEmoji  = premium ? statusEmoji      : basicEmoji;
  const shownText   = premium ? statusText       : basicText;
  const shownColor  = premium ? statusColor      : basicColor;

  let popupContent = `
    <div style="text-align:center; font-family:'Arial',sans-serif; min-width:200px; padding:5px;">
      <div style="font-size:10px; text-transform:uppercase; color:#888; letter-spacing:1px; margin-bottom:2px;">
        ${premium ? 'Tarkka ennuste · Premium ✓' : 'Karkea Kp-arvio'}
      </div>
      <div style="font-size:36px; font-weight:900; color:${shownColor}; line-height:1;">${shownProb}%</div>
      <div style="font-size:14px; font-weight:bold; color:${shownColor}; margin-top:5px; text-transform:uppercase;">
        ${shownEmoji} ${shownText}
      </div>
      <div style="width:100%; height:6px; background:#333; border-radius:10px; margin:15px 0;">
        <div style="width:${shownProb}%; height:100%; background:${shownColor}; border-radius:10px; box-shadow:0 0 8px ${shownColor}77;"></div>
      </div>
      ${premium && result.advice ? `<div style="font-size:11px; color:#ccc; margin:6px 0 10px; font-style:italic;">${result.advice}</div>` : ''}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; border-top:1px solid #333; padding-top:10px;">
        <div style="text-align:left;">
          <div style="font-size:9px; color:#888;">AURORA</div>
          <div style="font-size:14px; font-weight:bold; color:#fff;">✨ ${auroraIntensity.toFixed(1)} / 100</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px; color:#888;">CLOUDS</div>
          <div style="font-size:14px; font-weight:bold; color:#fff;">☁️ ${clouds}%</div>
        </div>
      </div>
      ${premium ? `
      <div style="margin-top:10px; padding:8px; background:rgba(0,255,204,0.05); border:1px solid rgba(0,255,204,0.15); border-radius:8px;">
        <div style="font-size:9px; color:#888; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Tekijät · 6-faktorin malli</div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; font-size:10px; color:#ccc;">
          <div>🌑 Pimeys<br><b style="color:#fff;">${result.factors.darkness}%</b></div>
          <div>🌕 Kuu<br><b style="color:#fff;">${result.factors.moon}%</b></div>
          <div>🧭 Mag.lat<br><b style="color:#fff;">${result.factors.magLat}°</b></div>
          <div>☁ Pilvi<br><b style="color:#fff;">${result.factors.clouds}%</b></div>
          <div>📡 Sol.wind<br><b style="color:#fff;">${result.factors.solarWind}%</b></div>
          <div>✨ OVATION<br><b style="color:#fff;">${result.factors.ovation}%</b></div>
        </div>
        ${solarWindBoost ? `<div style="font-size:9px; color:#888; margin-top:6px; text-align:center;">${solarWindBoost.label}: ${solarWindBoost.detail}</div>` : ''}
      </div>
      ` : `
      <div style="margin-top:10px; padding:10px; background:rgba(0,255,204,0.04); border:1px dashed rgba(0,255,204,0.3); border-radius:8px; position:relative;">
        <div style="font-size:9px; color:#00ffcc; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; text-align:center;">🔒 Tarkka 6-faktorin ennuste</div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; font-size:10px; color:#ccc; filter:blur(4px); user-select:none; pointer-events:none;">
          <div>🌑 Pimeys<br><b style="color:#fff;">${result.factors.darkness}%</b></div>
          <div>🌕 Kuu<br><b style="color:#fff;">${result.factors.moon}%</b></div>
          <div>🧭 Mag.lat<br><b style="color:#fff;">${result.factors.magLat}°</b></div>
          <div>☁ Pilvi<br><b style="color:#fff;">${result.factors.clouds}%</b></div>
          <div>📡 Sol.wind<br><b style="color:#fff;">${result.factors.solarWind}%</b></div>
          <div>✨ OVATION<br><b style="color:#fff;">${result.factors.ovation}%</b></div>
        </div>
        <div style="font-size:10px; color:#aaa; margin-top:8px; text-align:center; line-height:1.4;">
          Premium näyttää Bz:n, pimeyden, kuun ja magneettisen leveysasteen vaikutuksen.<br>
          <span style="color:#fff;">Tarkka arvio: <b style="color:#00ffcc;">${finalProbability}%</b></span> <span style="opacity:0.5;">(sumennettu)</span>
        </div>
        <button onclick="window.RT_openPremium && window.RT_openPremium();" style="margin-top:8px; width:100%; padding:6px; background:linear-gradient(135deg,#00ffcc,#00b894); border:none; border-radius:6px; color:#000; font-weight:bold; font-size:11px; cursor:pointer;">Avaa Premium →</button>
      </div>
      `}
      <div style="font-size:8px; color:#555; margin-top:10px;">Data source: ${source}</div>
    </div>
  `;

  if (showGoogleMapsLink) {
    popupContent += `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; border-top:1px solid #333; padding-top:5px;">
        <div style="text-align:left;">
          <div style="font-size:9px; color:#888;">TEMP</div>
          <div style="font-size:14px; font-weight:bold; color:#fff;">🌡️ ${temp}°C</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px; color:#888;">MAPS</div>
          <div style="font-size:14px;">
            <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener" style="text-decoration:none; color:#00ffcc;">📍 Open</a>
          </div>
        </div>
      </div>`;
  }

  if (marker) {
    marker.setLatLng([lat, lon]).bindPopup(popupContent).openPopup();
  } else {
    L.popup().setLatLng([lat, lon]).setContent(popupContent).openOn(map);
  }

  // Päivitä premium-teaser uusilla tiedoilla
  if (typeof refreshPremiumUI === 'function') refreshPremiumUI();
}

function initButtons() {
  // ---- Premium-paneelin alustus + tilan päivitys ----
  refreshPremiumUI();

  const toggleLink   = document.getElementById('premium-toggle-link');
  const activateBox  = document.getElementById('premium-activate-box');
  const codeInput    = document.getElementById('premium-code-input');
  const codeSubmit   = document.getElementById('premium-code-submit');
  const ctaBtn       = document.getElementById('premium-cta-btn');

  // Helper: avaa aktivointilaatikko (kutsutaan myös popupin "Avaa Premium" -napista)
  window.RT_openPremium = function () {
    if (activateBox) {
      activateBox.style.display = 'block';
      if (codeInput) { codeInput.focus(); codeInput.select(); }
    }
  };

  if (toggleLink) {
    toggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (isPremium()) {
        // Kirjaudu ulos premiumista
        if (confirm('Vaihda perustilaan? Premium-näkymä piilotetaan.')) setPremium(false);
      } else {
        window.RT_openPremium();
      }
    });
  }

  if (codeSubmit && codeInput) {
    const tryActivate = () => {
      const code = (codeInput.value || '').trim().toUpperCase();
      if (PREMIUM_CODES.includes(code)) {
        setPremium(true);
        if (activateBox) activateBox.style.display = 'none';
        codeInput.value = '';
        // Päivitä avoinna oleva popup jos sellainen on
        if (map && window._lastPopupContext) {
          const c = window._lastPopupContext;
          showAuroraPopup(c.lat, c.lon, null, true);
        }
      } else {
        codeInput.style.borderColor = '#ff3366';
        setTimeout(() => { codeInput.style.borderColor = '#333'; }, 1200);
      }
    };
    codeSubmit.addEventListener('click', tryActivate);
    codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryActivate(); });
  }

  if (ctaBtn) {
    ctaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isPremium()) {
        // Premium-tilassa nappi avaa 3-day forecastin
        const fp = document.getElementById('forecast-popup');
        if (fp) { fp.style.display = 'flex'; ensureChartJs().then(fetchAuroraForecast); }
      } else {
        window.RT_openPremium();
      }
    });
  }

  // Estä Leafletin click-propagaatio paneelilta
  const teaser = document.getElementById('premium-teaser');
  if (teaser && typeof L !== 'undefined' && L.DomEvent) {
    L.DomEvent.disableClickPropagation(teaser);
    L.DomEvent.disableScrollPropagation(teaser);
  }

  // FIX #5: Kaikki nämä elementit ovat valinnaisia — käytä `?.`-tarkistusta
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
      e.stopPropagation();
      helpPopup.style.display = 'flex';
    });
  }

  const forecastBtn = document.getElementById('forecast-btn');
  const forecastPopup = document.getElementById('forecast-popup');
  const closeForecast = document.getElementById('close-forecast');
  const locateBtn = document.getElementById('locate-btn');

  [forecastBtn, closeForecast, locateBtn, closePopupBtn].filter(Boolean).forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    if (typeof L !== 'undefined' && L.DomEvent) {
      L.DomEvent.disableClickPropagation(el);
    }
  });

  [forecastPopup, helpPopup].filter(Boolean).forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); });
    if (typeof L !== 'undefined' && L.DomEvent) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
    }
  });

  if (forecastBtn && forecastPopup) {
    forecastBtn.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      forecastPopup.style.display = 'flex';
      await ensureChartJs();
      fetchAuroraForecast();
    });
  }
  if (closeForecast && forecastPopup) {
    closeForecast.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      forecastPopup.style.display = 'none';
    });
  }

  if (locateBtn) {
    locateBtn.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!navigator.geolocation) { alert('Geolocation not supported in this browser.'); return; }

      const originalText = locateBtn.innerText;
      locateBtn.innerText = window.innerWidth <= 768 ? "⏳" : "Locating...";

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          locateBtn.innerText = window.innerWidth <= 768 ? "📍" : originalText;
          const lat = pos.coords.latitude, lon = pos.coords.longitude;
          map.setView([lat, lon], 6);
          if (!userMarker) userMarker = L.marker([lat, lon]).addTo(map);
          else userMarker.setLatLng([lat, lon]);
          await showAuroraPopup(lat, lon, userMarker, false);
        },
        (err) => {
          locateBtn.innerText = window.innerWidth <= 768 ? "📍" : originalText;
          if (err.code === 1) alert('Salli paikannus selaimen asetuksista.');
          else if (err.code === 3) alert('Paikannus aikakatkaistiin. Yritä uudelleen.');
          else alert('Location failed: ' + err.message);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    });
  }
}

// ------------------------
// NOAA (Ovation) overlay
// ------------------------
const AuroraLayer = L.Layer.extend({
  onAdd: function (map) {
    this._container = L.DomUtil.create('div', 'leaflet-aurora-layer');
    this._canvas = L.DomUtil.create('canvas', 'aurora-canvas', this._container);
    map.getPanes().overlayPane.appendChild(this._container);
    auroraCanvas = this._canvas;
    ctx = auroraCanvas.getContext('2d');
    map.on('move moveend zoomend', this._update, this);
    this._startAnimation();
    this._update();
  },
  onRemove: function () { cancelAnimationFrame(animationFrameId); },
  _startAnimation: function () {
    let lastFrameTime = 0;
    const fps = 25;
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
  _update: function () {
    const size = map.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
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
    g.addColorStop(0, `rgba(${color}, 0.9)`);
    g.addColorStop(0.4, `rgba(${color}, 0.2)`);
    g.addColorStop(1, `rgba(${color}, 0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, s.width, s.height);
    return s;
  };
  spriteGreen = create('50, 255, 150');
  spriteYellow = create('200, 255, 0');
  spriteRed = create('255, 0, 100');
}

function drawAuroraOverlay(points) {
  if (!ctx || !points || !auroraCanvas) return;
  ctx.clearRect(0, 0, auroraCanvas.width, auroraCanvas.height);

  const zoom = map.getZoom();
  const time = Date.now() * 0.001;
  const latShift = 1.4;

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
    const pos = map.latLngToContainerPoint([lat + offsetLat + latShift, lon + offsetLon]);

    let sprite = spriteGreen;
    if (intensity > 35) sprite = spriteYellow;
    if (intensity > 70) sprite = spriteRed;

    const zoomAlpha = zoom > 8 ? 0.6 : 0.4;
    ctx.globalAlpha = Math.min(zoomAlpha, (intensity / 100));
    ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height / 2);

    if (zoom > 8) {
      ctx.globalAlpha *= 0.4;
      const pulse = Math.sin(time * 2 + index) * 0.1 + 1;
      ctx.drawImage(sprite,
        pos.x - (sprite.width * 1.8 * pulse) / 2,
        pos.y - (sprite.height * 1.8 * pulse) / 2,
        sprite.width * 1.8 * pulse,
        sprite.height * 1.8 * pulse);
    }
  });
}

async function fetchAuroraData() {
  try {
    const res = await fetch('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json');
    const data = await res.json();
    currentData = data;

    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

    // FIX: Päivitä myös kelluva KP-arvo, jos hae onnistui (vaatii erillistä KP-hakua)
    if (ctx) drawAuroraOverlay(data.coordinates);

    // KP-badge
    fetchCurrentKp();
  } catch (err) {
    console.error('Aurora data error:', err);
  }
}

async function fetchCurrentKp() {
  try {
    const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
    const arr = await r.json();
    const last = arr[arr.length - 1];
    const kp = parseFloat(last[1]).toFixed(1);
    const el = document.getElementById('kpVal');
    if (el) el.textContent = kp;
  } catch (e) { /* ignore */ }
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
    script.onerror = () => { console.error('Chart.js load failed'); resolve(); };
    document.head.appendChild(script);
  });
}

// ------------------------
// Forecast (3-day)
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
    const chartCtx = ctxElement.getContext('2d');

    if (kpChartInstance) kpChartInstance.destroy();

    kpChartInstance = new Chart(chartCtx, {
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
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#fff' } },
          tooltip: {
            callbacks: {
              label: (c) => {
                const kp = c.parsed.y;
                if (kp >= 5) return `Kp ${kp} - High chance`;
                if (kp >= 3) return `Kp ${kp} - Moderate chance`;
                return `Kp ${kp} - Low chance`;
              }
            }
          }
        },
        scales: {
          y: { min: 0, max: 9, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' }, title: { display: true, text: 'Kp Index', color: '#fff' } },
          x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' }, title: { display: true, text: 'UT Time', color: '#fff' } }
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

// ------------------------
// Etusivun listapäivitys
// ------------------------
async function updateFrontPageForecasts() {
  const allPossiblePlaces = [
    { id: 'rovaniemi', name: 'Rovaniemi', lat: 66.50, lon: 25.72 },
    { id: 'levi', name: 'Levi', lat: 67.80, lon: 24.80 },
    { id: 'saariselka', name: 'Saariselkä', lat: 68.42, lon: 27.41 },
    { id: 'inari', name: 'Inari', lat: 68.90, lon: 27.02 },
    { id: 'kilpisjarvi', name: 'Kilpisjärvi', lat: 69.05, lon: 20.78 },
    { id: 'pallas', name: 'Pallas', lat: 68.05, lon: 24.06 },
    { id: 'utsjoki', name: 'Utsjoki', lat: 69.90, lon: 27.02 },
    { id: 'pyha', name: 'Pyhä', lat: 67.02, lon: 27.22 }
  ];

  const shuffled = allPossiblePlaces.sort(() => 0.5 - Math.random());
  const selectedPlaces = shuffled.slice(0, 3);

  const listContainer = document.querySelector('.locations-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  let currentKp = "--";
  try {
    const kpRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
    const kpData = await kpRes.json();
    currentKp = parseFloat(kpData[kpData.length - 1][1]).toFixed(1);
  } catch (e) { console.error("KP-haku epäonnistui"); }

  for (const place of selectedPlaces) {
    const row = document.createElement('div');
    row.className = 'place-row';
    row.id = `row-${place.id}`;
    // FIX: Linkki johtaa /map/ alikansioon
    row.onclick = () => window.location.href = `map/index.html?kohde=${place.id}`;

    row.innerHTML = `
      <div class="place-name">${place.name}</div>
      <div class="data-group">
        <div class="data-item"><span class="label">KP</span><span class="value kp-val">${currentKp}</span></div>
        <div class="data-item"><span class="label">PILVET</span><span class="value cloud-val">--</span></div>
        <div class="data-item"><span class="label">TEMP</span><span class="value temp-val">--</span></div>
      </div>
    `;
    listContainer.appendChild(row);

    getWeather(place.lat, place.lon).then(weather => {
      if (weather) {
        row.querySelector('.cloud-val').innerText = weather.clouds + "%";
        row.querySelector('.temp-val').innerText = weather.temp + "°C";
        const kpEl = row.querySelector('.kp-val');
        const kpNum = parseFloat(currentKp);
        if (kpNum >= 5) kpEl.style.color = "#ff3366";
        else if (kpNum >= 3) kpEl.style.color = "#ffcc00";
        else kpEl.style.color = "#00ffcc";
      }
    });
  }
}

// ------------------------
// Bootstrap
// ------------------------
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof initButtons === 'function') {
    try { initButtons(); } catch (e) { console.error('initButtons error:', e); }
  }

  if (document.querySelector('.locations-list')) {
    console.log("Etusivu tunnistettu.");
    updateFrontPageForecasts();
    setInterval(updateFrontPageForecasts, 900000);
  }

  const hasMap = !!document.getElementById('map');
  if (hasMap && typeof L !== 'undefined' && typeof initAppMap === 'function') {
    try {
      await initAppMap();
      setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    } catch (e) { console.error('initAppMap error:', e); }
  }

  // FIX #10: Resize + orientationchange (iOS-yhteensopivuus)
  const resizeMap = () => { if (typeof map !== 'undefined' && map) map.invalidateSize(); };
  window.addEventListener('resize', resizeMap);
  window.addEventListener('orientationchange', () => setTimeout(resizeMap, 200));
});
