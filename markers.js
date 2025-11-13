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
        <svg width="50" height="70" viewBox="0 0 50 70" xmlns="http://www.w3.org/2000/svg">
          <!-- Pisaran muoto -->
          <path d="M25 0 C40 20, 40 45, 25 70 C10 45, 10 20, 25 0" fill="#007bff" stroke="#0056b3" stroke-width="2"/>
          
          <!-- Valkoinen ympyrä taustaksi -->
          <circle cx="25" cy="20" r="14" fill="white" stroke="#0056b3" stroke-width="2"/>
          
          <!-- Paikan ikoni ympyrän sisään -->
          <image href="${place.icon}" x="11" y="6" width="28" height="28" clip-path="circle(14px at 25px 20px)"/>
        </svg>
      `,
      iconAnchor: [25, 70],
      popupAnchor: [0, -70]
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
