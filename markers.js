async function getWeather(lat, lon) {
  const apiKey = "a47a0bead08bf387f1a629376bb96319";

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fi`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    return {
      temp: Math.round(data.main.temp),
      feels: Math.round(data.main.feels_like),
      wind: data.wind.speed,
      desc: data.weather[0].description,
      icon: data.weather[0].icon
    };

  } catch (err) {
    console.error("Weather fetch failed:", err);
    return null;
  }
}

const places = [
  { name: 'Rovaniemi', lat: 66.5, lon: 25.7, url: 'https://visitrovaniemi.fi', icon: 'roic.png' },
  { name: 'Joulupukin Pajakylä', lat: 66.54, lon: 25.84, url: 'https://santaclausvillage.info/', icon: 'pukki.png', stream: 'https://www.youtube.com/embed/Cp4RRAEgpeU', streamWidth: 320, streamHeight: 180},
  { name: 'Levi', lat: 67.80, lon: 24.80, url: 'https://www.levi.fi/', icon: 'levi.png' },
  { name: 'Ylläs', lat: 67.57, lon: 24.20, url: 'https://yllas.fi/', icon: 'yllas.png' }
];

const markersLayer = L.layerGroup().addTo(map);

function addMarkers() {
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

    // Popupin perussisältö
    const popupContent = `
      <strong>${place.name}</strong><br>
      <img src="${place.icon}" alt="${place.name}" style="width:50px;height:50px;border-radius:50%;"><br>
      <a href="${place.url}" target="_blank">More info</a>

      <div class="weather-box" style="margin-top:10px;">
        <em>Haetaan säätietoja…</em>
      </div>

      ${place.stream ? `<div class="popup-stream" 
        data-stream="${place.stream}" 
        data-width="${place.streamWidth || 320}" 
        data-height="${place.streamHeight || 180}" 
        style="margin-top:10px;"></div>` : ''}
    `;

    // ❗️Tämä puuttui: marker pitää luoda ENNEN marker.on(...)
    const marker = L.marker([place.lat, place.lon], { icon: customIcon })
      .bindPopup(popupContent, { className: 'custom-popup' })
      .addTo(markersLayer);

    // Popup avautuessa: hae sää + luo iframe
    marker.on('popupopen', async (e) => {
      const popup = e.popup;

      // 1) Lataa sää
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

      // 2) Lataa YouTube-iframe (lazy load)
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

  // Satunnainen animaatioviive markereille
  document.querySelectorAll('.marker-wrapper').forEach(el => {
    el.style.animationDelay = `${Math.random() * 2}s`;
  });
}


addMarkers();

