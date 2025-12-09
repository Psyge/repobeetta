// Tee getWeather globaaliksi
window.getWeather = async function (lat, lon) {
    const url = `https://repotracker.masto84.workers.dev/?lat=${lat}&lon=${lon}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return {
            temp: Math.round(data.main.temp),
            feels: Math.round(data.main.feels_like),
            wind: data.wind.speed,
            desc: data.weather[0].description,
            icon: data.weather[0].icon,
            clouds: data.clouds.all
        };
    } catch {
        return null;
    }
};

let markersLayer = null;

/**
 * Luo markerit kartalle annetusta places-listasta
 */
function initMarkers(map, getWeather, showPlaceInfo, places = []) {
  if (!map) return;

  if (markersLayer) {
    markersLayer.clearLayers();
  } else {
    markersLayer = L.layerGroup().addTo(map);
  }

  places.forEach(place => {
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-wrapper">
               <img src="images/pinni.png" class="pin">
con}
             </div>`,
      iconSize: [32, 48],
      iconAnchor: [16, 48],
      popupAnchor: [0, -52]
    });

    const popupContent = `
      <div class="popup-header">
        <img src="${place.icon}" alt="${place.name}">
le">${place.name}</strong>
      </div>
      <div style="font-size:0.9em;margin:6px 0;max-width:250px;">
        ${place.short || ''}
      </div>
      <a href="#" class="read-more" data-place="${place.name}">Read more</a>
<em>Retrieving weather data...</em></div>
      ${place.stream ? `<div class="popup-stream"
                          data-stream="${place.stream}"
                          data-width="${place.streamWidth}"
                          data-height="${place.streamHeight}"
                          style="margin-top:10px;"></div>` : ''}
    `;

    const marker = L.marker([place.lat, place.lon], { icon: customIcon })
      .bindPopup(popupContent, { className: 'custom-popup' })
      .addTo(markersLayer);

    marker.on('popupopen', async e => {
      const popup = e.popup;
      const weatherBox = popup.getElement().querySelector('.weather-box');
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

      const container = popup.getElement().querySelector('.popup-stream');
      if (container && !container.querySelector('iframe')) {
        const iframe = document.createElement('iframe');
        iframe.src = container.dataset.stream;
        iframe.width = container.dataset.width;
        iframe.height = container.dataset.height;
        iframe.style.border = 'none';
        container.appendChild(iframe);
      }
    });
  });

  // "Read more" -linkki avaa nykyisen showPlaceInfo:n
  document.addEventListener('click', function (e) {
    const a = e.target.closest('.read-more');
    if (!a) return;
    e.preventDefault();
    const placeName = a.dataset.place;
    const place = places.find(p => p.name === placeName);
    if (place) showPlaceInfo(place);
  });
}



document.addEventListener('languageReady', initMarkers);
document.addEventListener('mapReady', initMarkers);
