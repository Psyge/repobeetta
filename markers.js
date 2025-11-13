const places = [
  { name: 'Rovaniemi', lat: 66.5, lon: 25.7, url: 'https://visitrovaniemi.fi', icon: 'roic.png' },
  { name: 'Joulupukin Pajakylä', lat: 66.54, lon: 25.84, url: 'https://santaclausvillage.info/', icon: 'pukki.png' },
  { name: 'Levi', lat: 67.80, lon: 24.80, url: 'https://www.levi.fi/', icon: 'levi.png' },
  { name: 'Ylläs', lat: 67.57, lon: 24.20, url: 'https://yllas.fi/', icon: 'yllas.png' }
];

const markersLayer = L.layerGroup();
markersLayer.addTo(map); // Varmista, että 'map' on jo luotu

function addMarkers() {
  places.forEach(place => {
    const customIcon = L.divIcon({
      className: 'drop-icon',
      html: `
     
      <svg width="40" height="50" viewBox="0 0 40 50">
      <!-- Kuvake pisaran yläosaan -->
      <image href="${place.icon}" x="4" y="2" width="32" height="32" />

      <!-- Vesipisaran muoto -->
      <path d="M20 0 C32 18, 32 36, 20 50 C8 36, 8 18, 20 0" fill="#00aaff" opacity="0.6">
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-5; 0,0" dur="3s" repeatCount="indefinite"/>
      </path>
    </svg>

      `,
      iconAnchor: [16, 40],
      popupAnchor: [0, -40]
    });

    const popupContent = `
      <strong>${place.name}</strong><br>
      <img src="${place.icon}" alt="${place.name}" class="popup-img"><br>
      <a href="${place.url}" target="_blank" rel="noopener noreferrer">More info</a>
    `;

    L.marker([place.lat, place.lon], { icon: customIcon })
      .bindPopup(popupContent)
      .addTo(markersLayer);
  });
}

addMarkers();
