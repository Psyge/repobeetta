
// ===============================
// Markers (Leaflet) for RepoTracker
// ===============================

// Tee getWeather saataville myös tästä tiedostosta tarvittaessa.
// HUOM: jos getWeather on jo määritelty pääskriptissä (script.js),
// voit poistaa alla olevan varmistuksen.
if (!window.getWeather) {
  window.getWeather = async function (lat, lon) {
    const url = `https://repotracker.masto84.workers.dev/?lat=${lat}&lon=${lon}`;
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
  };
}

let markersLayer = null;

// ----------------------------------------------
// Julkinen API: window.initMarkers(...)
/// Luo markerit kartalle annetusta places-listasta
// ----------------------------------------------
window.initMarkers = function initMarkers(map, getWeather, showPlaceInfo, places = []) {
  if (!map || !Array.isArray(places)) return;

  // Luo/tyhjennä layerGroup oikein (ei array!)
  if (markersLayer) {
    markersLayer.clearLayers();
  } else {
    markersLayer = L.layerGroup().addTo(map);
  }

  places.forEach(place => {
    // Ikoni: pohjapin + kohdekuvake
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-wrapper">
          images/pinni.png
          ${place.icon}
        </div>
      `,
      iconSize: [32, 48],
      iconAnchor: [16, 48],
      popupAnchor: [0, -52]
    });

    // Popup: lyhyt kuvaus + Read more + sää + mahdollinen stream
    const popupContent = `
      <div class="popup-header">
        ${place.icon}
        <strong class="popup-title">${place.name}</strong>
      </div>

      <div style="font-size:0.9em; margin:6px 0; max-width:250px;">
        ${place.short || ''}
      </div>

      #Read more</a>

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

    // Kun popup avataan: päivitä sää + upota stream tarvittaessa
    marker.on('popupopen', async (e) => {
      const popupEl = e.popup.getElement();

      // Sääboksi
      const weatherBox = popupEl.querySelector('.weather-box');
      if (weatherBox && !weatherBox.dataset.loaded) {
        const weather = await getWeather(place.lat, place.lon);
        if (weather) {
          weatherBox.innerHTML = `
            <div class="weather-row">
              https://openweathermap.org/img/wn/${weather.icon}.png
              <span>${weather.temp}°C — ${weather.desc}</span>
            </div>
            <small>Feels like ${weather.feels}°C | Wind ${weather.wind} m/s</small>
          `;
        } else {
          weatherBox.textContent = 'Weather not available';
        }
        weatherBox.dataset.loaded = 'true';
      }

      // Stream upotus (YouTube tms.)
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

  // Delegoitu "Read more" -kuuntelija dokumentille (lisätään vain kerran)
  if (!document._readMoreBound) {
    document.addEventListener('click', function (e) {
      const link = e.target.closest('.read-more');
      if (!link) return;
      e.preventDefault();
      const placeName = link.dataset.place;
      const place = places.find(p => p.name === placeName);
      if (place && typeof showPlaceInfo === 'function') {
        showPlaceInfo(place);
      }
    });
    document._readMoreBound = true;
  }
};
