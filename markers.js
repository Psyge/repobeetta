async function getWeather(lat, lon) {
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
  } catch (err) {
    console.error("Weather fetch failed:", err);
    return null;
  }
}

const places = [
  { name: 'Rovaniemi', lat: 66.5, lon: 25.7, url: 'https://visitrovaniemi.fi', icon: 'roic.png' },
  { name: 'Joulupukin Pajakylä', lat: 66.54, lon: 25.84, url: 'https://santaclausvillage.info/', icon: 'pukki.png', stream: 'https://www.youtube.com/embed/Cp4RRAEgpeU', streamWidth: 320, streamHeight: 180 },
  { name: 'Levi', lat: 67.80, lon: 24.80, url: 'https://www.levi.fi/', icon: 'levi.png' },
  { name: 'Ylläs', lat: 67.57, lon: 24.20, url: 'https://yllas.fi/', icon: 'yllas.png' }
];

let markersLayer;

function initMarkers() {
  if (typeof map !== 'undefined' && map) {
    markersLayer = L.layerGroup().addTo(map);
    addMarkers(markersLayer);
  } else {
    console.warn("Map is not ready yet. Markers not initialized.");
  }
}

function addMarkers(layer) {
  places.forEach(place => {
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-wrapper">
          <img src="pinni.png" class="pin">
          <img src="${place.icon}" class="pin-icon">
        </div>
      `,
      iconSize: [32, 48],
      iconAnchor: [16, 48],
      popupAnchor: [0, -52]
    });

    const popupContent = `
      <strong>${place.name}</strong><br>
      <img src="${place.icon}" alt="${place.name}" style="width:50px;height:50px;border-radius:50%;"><br>
      <a href="${place.url}" target="_blank">More info</a>
      <div class="weather-box" style="margin-top:10px;">
        <em>Retrieving weather data...</em>
      </div>
      ${place.stream ? `<div class="popup-stream" 
        data-stream="${place.stream}" 
        data-width="${place.streamWidth || 320}" 
        data-height="${place.streamHeight || 180}" 
        style="margin-top:10px;"></div>` : ''}
    `;

    const marker = L.marker([place.lat, place.lon], { icon: customIcon })
      .bindPopup(popupContent, { className: 'custom-popup' })
      .addTo(layer);

    marker.on('popupopen', async (e) => {
      const popup = e.popup;

      // Säädata
      const weatherBox = popup.getElement().querySelector('.weather-box');
      if (weatherBox && !weatherBox.dataset.loaded) {
        const weather = await getWeather(place.lat, place.lon);
        if (weather) {
          weatherBox.innerHTML = `
            <div class="weather-row">
              <img src="https://openweathermap.org/img/wn/${weather.icon}.png">
              <span>${weather.temp}°C — ${weather.desc}</span>
            </div>
            <small>Feels like ${weather.feels}°C | Wind ${weather.wind} m/s</small>
          `;
        } else {
          weatherBox.innerHTML = "Weather not available";
        }
        weatherBox.dataset.loaded = "true";
      }

      // Stream iframe
      const container = popup.getElement().querySelector('.popup-stream');
      if (container && !container.querySelector('iframe')) {
        const iframe = document.createElement('iframe');
        iframe.src = container.dataset.stream;
        iframe.width = container.dataset.width;
        iframe.height = container.dataset.height;
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        container.appendChild(iframe);

        setTimeout(() => {
          e.popup._updateLayout();
          e.popup._updatePosition();
          e.popup._adjustPan();
        }, 50);
      }
    });
  });

  // Animaatioviive
  document.querySelectorAll('.marker-wrapper').forEach(el => {
    el.style.animationDelay = `${Math.random() * 2}s`;
  });
}

// Käynnistä markerit
initMarkers();
