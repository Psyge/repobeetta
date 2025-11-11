const places = [
  { name: 'Rovaniemi', lat: 66.5, lon: 25.7, url: 'https://visitrovaniemi.fi', icon: 'roic.png' },
  
];


const markersLayer = L.layerGroup();

function addMarkers() {
  places.forEach(place => {
    const customIcon = L.icon({
      iconUrl: place.icon,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    const popupContent = `
      <strong>${place.name}</strong><br>
      ${place.url}More info</a>
    `;

    L.marker([place.lat, place.lon], { icon: customIcon })
      .bindPopup(popupContent)
      .addTo(markersLayer);
  });
}
