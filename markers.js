// Tee getWeather globaaliksi
window.getWeather = async function(lat, lon) {
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

const places = [
    { name: 'Rovaniemi', lat: 66.5, lon: 25.7, url: 'https://visitrovaniemi.fi', icon: 'roic.png', description: 'Rovaniemi on Lapin pääkaupunki ja tunnettu Joulupukin virallisena kotikaupunkina.' },
    { name: 'Joulupukin Pajakylä', lat: 66.54, lon: 25.84, url: 'https://santaclausvillage.info/', icon: 'pukki.png', stream: 'https://www.youtube.com/embed/Cp4RRAEgpeU', streamWidth: 320, streamHeight: 180 },
    { name: 'Levi', lat: 67.80, lon: 24.80, url: 'https://www.levi.fi/', icon: 'levi.png' },
    { name: 'Ylläs', lat: 67.57, lon: 24.20, url: 'https://yllas.fi/', icon: 'yllas.png' }
];

let markersLayer;

function initMarkers() {
    if (!translations[currentLang]) {
        console.warn("Translations not ready, waiting...");
        return; // odotetaan languageReady-eventtiä
    }
    if (!map) {
        console.warn("Map not ready, waiting...");
        return; // odotetaan mapReady-eventtiä
    }

    // Jos markersLayer on jo luotu, tyhjennä se
    if (markersLayer) markersLayer.clearLayers();
    else markersLayer = L.layerGroup().addTo(map);

    addMarkers(markersLayer);

    document.querySelectorAll('.marker-wrapper').forEach(el => {
        el.style.animationDelay = `${Math.random() * 2}s`;
    });
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
      <img src="${place.icon}" alt="${place.name}" style="width:30px;height:30px;border-radius:50%;"><br>
        <div style="font-size: 0.9em; margin: 6px 0; max-width:200px;">
        ${place.description || ''}
    </div>
      <a href="${place.url}" target="_blank">${translations[currentLang].weather.moreInfo}</a>
      <div class="weather-box" style="margin-top:10px;">
        <em>${translations[currentLang].weather.loading}</em>
      </div>
      ${place.stream ? `<div class="popup-stream" data-stream="${place.stream}" data-width="${place.streamWidth}" data-height="${place.streamHeight}" style="margin-top:10px;"></div>` : ''}
    `;

        const marker = L.marker([place.lat, place.lon], { icon: customIcon })
            .bindPopup(popupContent, { className: 'custom-popup'})
            .addTo(layer);

        marker.on('popupopen', async (e) => {
            const popup = e.popup;
            const weatherBox = popup.getElement().querySelector('.weather-box');
            if (weatherBox && !weatherBox.dataset.loaded) {
                const weather = await getWeather(place.lat, place.lon);
                if (weather) {
                    weatherBox.innerHTML = `
            <div class="weather-row">
              <img src="https://openweathermap.org/img/wn/${weather.icon}.png">
              <span>${weather.temp}°C — ${weather.desc}</span>
            </div>
            <small>${translations[currentLang].weather.feels} ${weather.feels}°C | ${translations[currentLang].weather.wind} ${weather.wind} m/s</small>
          `;
                } else {
                    weatherBox.innerHTML = translations[currentLang].weather.error;
                }
                weatherBox.dataset.loaded = "true";
            }

            const container = popup.getElement().querySelector('.popup-stream');
            if (container && !container.querySelector('iframe')) {
                const iframe = document.createElement('iframe');
                iframe.src = container.dataset.stream;
                iframe.width = container.dataset.width;
                iframe.height = container.dataset.height;
                iframe.style.border = 'none';
                iframe.style.display = 'block';
                container.appendChild(iframe);
            }
        });
    });
}

document.addEventListener('languageReady', initMarkers);
document.addEventListener('mapReady', initMarkers);
