// ===============================
// Markers (Leaflet) for RepoTracker — FIXED
// ===============================
(function () {
  // FIX #1: Käytetään SAMAA Worker-URL:ää kuin script.js:ssä.
  // Päivitä molemmat tarvittaessa. Vaihda alla oleva URL omaksi tuotanto-Workeriksi.
  const WEATHER_WORKER_URL = 'https://proud-union-1e84.masto84.workers.dev';

  const getWeatherGlobal = window.getWeather || (async function (lat, lon) {
    const url = `${WEATHER_WORKER_URL}/?lat=${lat}&lon=${lon}`;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        temp: Math.round(data.main?.temp ?? 0),
        feels: Math.round(data.main?.feels_like ?? 0),
        wind: data.wind?.speed ?? 0,
        desc: data.weather?.[0]?.description ?? '',
        icon: data.weather?.[0]?.icon ?? '01d',
        clouds: data.clouds?.all ?? 100
      };
    } catch {
      return null;
    }
  });

  let markersLayer = null;
  let readMoreBound = false;

  function initMarkers(map, getWeatherFn, showPlaceInfoFn, places = []) {
    if (!map || !Array.isArray(places)) return;

    const prefix = window.location.pathname.includes('/map/') ? '../' : '';

    if (markersLayer) {
      markersLayer.clearLayers();
    } else {
      markersLayer = L.layerGroup();
      // FIX #3: Tallennetaan oikealla nimellä jotta script.js löytää sen.
      window.markersLayer = markersLayer;
    }

    places.forEach(place => {
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="marker-wrapper">
            <img src="${prefix}pinni.png" class="pin" alt="pin">
            <img src="${place.icon}" class="pin-icon" alt="${place.name}">
          </div>
        `,
        iconSize: [32, 48],
        iconAnchor: [16, 48],
        popupAnchor: [0, -52]
      });

      const popupContent = `
        <div class="popup-header">
          <img src="${place.icon}" alt="${place.name}">
          <strong class="popup-title">${place.name}</strong>
        </div>
        <div style="font-size:0.9em; margin:6px 0; max-width:250px;">
          ${place.short || ''}
        </div>
        <a href="#" class="read-more" data-place="${place.name}">Read more</a>
        <div class="weather-box" style="margin-top:10px;">
          <em>Retrieving weather data...</em>
        </div>
        ${
          place.stream
            ? `<div class="popup-stream"
                   data-stream="${place.stream}"
                   data-width="${place.streamWidth || 320}"
                   data-height="${place.streamHeight || 180}"
                   style="margin-top:10px;"></div>`
            : ''
        }
      `;

      const marker = L.marker([place.lat, place.lon], { icon: customIcon })
        .bindPopup(popupContent, { className: 'custom-popup' })
        .addTo(markersLayer);

      // Tallennetaan id → marker, jotta openPlaceFromUrlParam löytää sen
      if (place.id && window.placeMarkers instanceof Map) {
        window.placeMarkers.set(String(place.id).toLowerCase(), marker);
      }

      marker.on('popupopen', async (e) => {
        const popupEl = e.popup.getElement();
        const weatherBox = popupEl.querySelector('.weather-box');
        if (weatherBox && !weatherBox.dataset.loaded) {
          const weather = await (getWeatherFn || getWeatherGlobal)(place.lat, place.lon);
          if (weather) {
            weatherBox.innerHTML = `
              <div class="weather-row">
                <img src="https://openweathermap.org/img/wn/${weather.icon}.png" alt="">
                <span>${weather.temp}°C — ${weather.desc}</span>
              </div>
              <small>Feels like ${weather.feels}°C | Wind ${weather.wind} m/s</small>
            `;
          } else {
            weatherBox.textContent = 'Weather not available';
          }
          weatherBox.dataset.loaded = 'true';
        }

        const container = popupEl.querySelector('.popup-stream');
        if (container && !container.querySelector('iframe')) {
          const iframe = document.createElement('iframe');
          iframe.src = container.dataset.stream;
          iframe.width = container.dataset.width;
          iframe.height = container.dataset.height;
          iframe.style.border = 'none';
          iframe.setAttribute('allowfullscreen', 'true');
          container.appendChild(iframe);
        }
      });
    });

    if (!readMoreBound) {
      document.addEventListener('click', function (e) {
        const link = e.target.closest('.read-more');
        if (!link) return;
        e.preventDefault();
        const placeName = link.dataset.place;
        const place = places.find(p => p.name === placeName);
        if (place && typeof showPlaceInfoFn === 'function') {
          showPlaceInfoFn(place);
        }
      });
      readMoreBound = true;
    }
  }

  function togglePlaces(visible, map) {
    if (!markersLayer || !map) return; 
    if (visible) {
      markersLayer.addTo(map);
    } else {
      map.removeLayer(markersLayer);
    }
  }

  window.initMarkers = initMarkers;
  window.togglePlaces = togglePlaces;
})();
