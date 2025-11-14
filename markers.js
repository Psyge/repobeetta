const places = [
  { name: 'Rovaniemi', lat: 66.5, lon: 25.7, url: 'https://visitrovaniemi.fi', icon: 'roic.png' },
  { name: 'Joulupukin Pajakylä', lat: 66.54, lon: 25.84, url: 'https://santaclausvillage.info/', icon: 'pukki.png', stream: 'https://www.youtube.com/embed/Cp4RRAEgpeU'},
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
        popupAnchor: [0, -48]
      });

      // Popupin perussisältö
      const popupContent = `
        <strong>${place.name}</strong><br>
        <img src="${place.icon}" alt="${place.name}" style="width:50px;height:50px;border-radius:50%;"><br>
        <a href="${place.url}" target="_blank">More info</a>
        ${place.stream ? `<div class="popup-stream" data-stream="${place.stream}" style="margin-top:10px;"></div>` : ''}
      `;

      const marker = L.marker([place.lat, place.lon], { icon: customIcon })
        .bindPopup(popupContent, { 
              maxWidth: 'auto',
              className: 'custom-popup'
         })
        .addTo(markersLayer);

      // Lazy load stream iframe kun popup avataan
      marker.on('popupopen', (e) => {
        const container = e.popup.getElement().querySelector('.popup-stream');
        if (container && !container.querySelector('iframe')) {
          const iframe = document.createElement('iframe');
          iframe.src = container.dataset.stream;
          container.appendChild(iframe);
        }
      });
    });

    // Satunnainen animaatioviive markereille
    document.querySelectorAll('.marker-wrapper').forEach(el => {
      el.style.animationDelay = `${Math.random() * 2}s`;
    });
  }

  addMarkers();

