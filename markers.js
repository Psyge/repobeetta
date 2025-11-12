const places = [
  { name: 'Rovaniemi', lat: 66.5, lon: 25.7, url: 'https://visitrovaniemi.fi', icon: 'roic.png' },
  { name: 'Joulupukin Pajakylä', lat: 66.54, lon: 25.84, url: 'https://santaclausvillage.info/', icon: 'pukki.png' },
  { name: 'Levi', lat: 67.80, lon: 24.81, url: 'https://www.levi.fi/', icon: 'levi.png' },
  { name: 'Ylläs', lat: 57.56, lon: 24.22, url: 'https://yllas.fi/', icon: 'yllas.png' },
];


const markersLayer = L.layerGroup();

function addMarkers() {
  places.forEach(place => {
    const customIcon = L.icon({
      iconUrl: place.icon,
      iconSize: [32, 32],
      className: 'circle-icon',
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
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
