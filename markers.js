const places = [
  { name: 'Rovaniemi', lat: 66.5, lon: 25.7, url: 'https://visitrovaniemi.fi', icon: 'roic.png' },
  { name: 'Joulupukin Pajakylä', lat: 66.54, lon: 25.84, url: 'https://santaclausvillage.info/', icon: 'pukki.png' },
  { name: 'Levi', lat: 67.80, lon: 24.80, url: 'https://www.levi.fi/', icon: 'levi.png' },
  { name: 'Ylläs', lat: 67.57, lon: 24.20, url: 'https://yllas.fi/', icon: 'yllas.png' }
];

const markersLayer = L.layerGroup().addTo(map);

function addMarkers() {
  places.forEach(place => {
    
const customIcon = L.divIcon({
  className: '',
  html: `
    <div class="marker-wrapper">
      <img src="images/pin.png" class="pin">
      <img src="${place.icon}" class="pin-icon">
    </div>
  `,
  iconSize: [50, 70],
  iconAnchor: [25, 70],
  popupAnchor: [0, -70]
});


    const popupContent = `
      <strong>${place.name}</strong><br>
      <img src="${place.icon}" alt="${place.name}" style="width:50px;height:50px;border-radius:50%;"><br>
      <a href="${place.url}" target="_blank">More info</a>
    `;

    L.marker([place.lat, place.lon], { icon: customIcon })
      .bindPopup(popupContent)
      .addTo(markersLayer);
  });
}

addMarkers();
