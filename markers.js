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


const places = [
    { name: 'Rovaniemi', lat: 66.5, lon: 25.7, url: 'https://visitrovaniemi.fi', icon: 'roic.png',  short: 'Rovaniemi on Lapin pääkaupunki ja Joulupukin virallinen kotikaupunki.', 
     description: `
        <h2>Rovaniemi – Lapin pääkaupunki ja joulupukin koti</h2>

  <p>
    Rovaniemi on elinvoimainen kaupunki Suomen Lapissa, aivan Napapiirin tuntumassa. Kaupunki sijaitsee hyvien kulkuyhteyksien varrella – Rovaniemelle pääsee kätevästi sekä lentäen että junalla. Rovaniemeä pidetään yleisesti Lapin pääkaupunkina, ja se toimii koko pohjoisen Suomen tärkeänä hallinnollisena, kaupallisena ja kulttuurisena keskuksena.
  </p>

  <p>
    Rovaniemi tunnetaan kansainvälisesti joulupukin virallisena kotipaikkana, mikä tekee siitä yhden Suomen suosituimmista matkailukohteista. Erityisesti talvikuukausina turistit saapuvat ympäri maailmaa kokemaan Lapin taian ja ainutlaatuiset elämykset.
  </p>
<p>Yksi Rovaniemellä vierailevien suosikkikokemuksista on Napapiirin ylittäminen. Napapiiri kulkee kaupungin halki, ja sen voi ylittää esimerkiksi Joulupukin Pajakylässä, jossa raja on merkitty selkeästi maastoon. Napapiirin ylitys on monille matkailijoille unohtumaton hetki – se symboloi siirtymistä arktiselle alueelle.</p>

  <h3>Talvella suosituimpia aktiviteetteja on:</h3>
  <ul>
    <li>Poro- ja huskyajelut</li>
    <li>Moottorikelkkasafarit</li>
    <li>Revontuliretket</li>
    <li>Laskettelu, lumilautailu ja hiihtäminen Ounasvaaralla</li>
    <li>Jääveistokset, iglut ja muut lumiaktiviteetit</li>
    <li>Vierailut Joulupukin Pajakylässä ja Santa Parkissa</li>
  </ul>

  <h3>Tekemistä ympäri vuoden</h3>
  <p>
    Vaikka Rovaniemi on erityisen suosittu talvikohde, tarjoaa kaupunki runsaasti nähtävää ja koettavaa myös muina vuodenaikoina. Rovaniemellä voi tutustua upeisiin luontopoluihin, vierailla mielenkiintoisissa museoissa kuten Arktikum ja Pilke, sekä nauttia vilkkaasta kulttuuri- ja tapahtumatarjonnasta.
  </p>
    ` 
    },
    { name: 'Joulupukin Pajakylä', lat: 66.54, lon: 25.84, url: 'https://santaclausvillage.info/', icon: 'pukki.png', stream: 'https://www.youtube.com/embed/Cp4RRAEgpeU', streamWidth: 320, streamHeight: 180, short: 'Joulupukin pajakylä - Joulupukin virallinen kotipaikka', description: ` 
    <h2>Joulupukin Pajakylä – Taianomainen kohtaamispaikka Napapiirillä</h2>

  <p>
    Joulupukin Pajakylä on yksi Rovaniemen tunnetuimmista nähtävyyksistä. Se sijaitsee aivan Napapiirillä, vain lyhyen matkan päässä keskustasta, ja toimii joulupukin virallisena kohtaamispaikkana ympäri vuoden. Pajakylä on kansainvälinen matkailun vetonaula, jossa vierailee vuosittain tuhansia turisteja eri puolilta maailmaa.
  </p>

  <h3>Mitä Pajakylässä voi kokea?</h3>
  <ul>
    <li>Tapaa itse Joulupukki – Pajakylässä voit tavata Joulupukin henkilökohtaisesti vuoden jokaisena päivänä.</li>
    <li>Lähetä terveisiä Joulupukin pääpostista – Napapiirillä sijaitsevasta postista voi lähettää kirjeitä erikoisleimalla ja seurata tonttujen postinlajittelua.</li>
    <li>Ylitä Napapiiri – Pajakylässä kulkee Napapiirin virallinen linja, jonka ylittäminen on monille vierailijoille ikimuistoinen hetki.</li>
    <li>Tee ostoksia ja nauti Lapin herkuista – Pajakylästä löytyy runsaasti lahjatavarakauppoja sekä tunnelmallisia ravintoloita, joissa voi maistella paikallisia herkkuja.</li>
    </ul>

  <h3>Talven taikaa</h3>
  <p>
    Talvikaudella Pajakylä muuttuu satumaiseksi lumikeitaaksi. Vierailijat voivat nauttia poro- ja huskysafareista, moottorikelkka-ajeluista, jää- ja lumirakennelmista sekä mahdollisesti nähdä revontulet Napapiirin yllä.
  </p>

  <h3>Auki ympäri vuoden</h3>
  <p>
    Joulupukin Pajakylä ei ole vain joulusesongin kohde – se on avoinna joka päivä vuoden ympäri. Kesällä tunnelma on rauhallisempi, ja alueeseen voi tutustua ilman talvikauden suuria kävijämääriä.

  </p>

  <p>
    Oli vuodenaika mikä tahansa, Joulupukin Pajakylä tarjoaa ikimuistoisen elämyksen kaikenikäisille vierailijoille.
  </p>`
    },
    { name: 'Levi', lat: 67.80, lon: 24.80, url: 'https://www.levi.fi/', icon: 'levi.png', short: 'Levi - Suomen ehkä tunnetuin hiihtokeskus', description: 
        `
  <h2>Levi – Suomen tunnetuin hiihtokeskus</h2>

  <p>
    Levi sijaitsee Kittilässä, Lapissa, ja on yksi Suomen suosituimmista sekä kansainvälisimmistä matkailukohteista. Levi tunnetaan erityisesti laadukkaista rinteistään, monipuolisista aktiviteeteistaan ja vilkkaasta matkailuelämästään. Se on Suomen suurin hiihtokeskus, joka houkuttelee vierailijoita ympäri vuoden.
  </p>

  <h3>Talven parhaat elämykset</h3>
  <ul>
    <li>Hiihto ja lumilautailu: kymmenet rinteet ja huippuluokan latuverkostot tarjoavat vaihtoehtoja kaikentasoisille laskijoille.</li>
    <li>Alppihiihdon maailmancup: Levi isännöi vuosittain maailmancupin avauskilpailuja.</li>
    <li>Moottorikelkkasafarit: reittejä Lapin maisemissa niin aloittelijoille kuin kokeneille.</li>
    <li>Husky- ja poroajelut: unohtumattomia elämyksiä talvisessa luonnossa.</li>
    <li>Revontuliretket: mahdollisuus kokea pohjoisen taivas täydessä loistossaan.</li>
    <li>Lumikenkäily ja jäärakennelmat – liikuntaa ja elämyksiä lumen keskellä.</li>
  </ul>

  <h3>Kesän ja syksyn aktiviteetit</h3>
  <p>
    Levi on monipuolinen ympärivuotinen kohde. Kesällä ja ruska-aikaan alue houkuttelee retkeilijöitä, maastopyöräilijöitä, kalastajia ja golfaajia. Levin huipulle pääsee myös gondolihissillä, joka tarjoaa upeat maisemat jokaisena vuodenaikana.
  </p>

  <h3>Majoitus ja palvelut</h3>
  <p>
    Levin kylästä löytyy laaja valikoima majoitusvaihtoehtoja mökeistä laadukkaisiin hotelleihin. Alue tarjoaa myös runsaasti ravintoloita, kahviloita, kauppoja ja viihdepalveluita.
  </p>

  <h3>Hyvinvointi ja spa-elämykset</h3>
  <p>
    Levi tunnetaan myös hyvinvointipalveluistaan – tarjolla on spa-, wellness-, rentoutumis- ja hemmottelupalveluita niin lomailijoille kuin aktiiviurheilijoille.
  </p>

  <h3>Tapahtumat</h3>
  <p>
    Levillä järjestetään ympäri vuoden erilaisia tapahtumia urheilukilpailuista musiikkitapahtumiin. Tunnelma on usein nuorekas, energinen ja kansainvälinen.
  </p>

`
},
    { name: 'Ylläs', lat: 67.57, lon: 24.20, url: 'https://yllas.fi/', icon: 'yllas.png', short: 'Ylläs - Suomen suurin hiihtokeskus', description: `
  <h2>Ylläs – Tunturien rauhaa ja Lapin upeita elämyksiä</h2>

  <p>
    Ylläs sijaitsee Kolarin kunnassa, Lapissa, ja se on yksi Suomen 
    tunnetuimmista talvi- ja luontomatkailukohteista. Alue koostuu kahdesta 
    tunnelmallisesta kylästä: Äkäslompulosta ja Ylläsjärvestä, jotka tarjoavat 
    aidon lappilaisen ympäristön ja upeat tunturimaisemat.
  </p>

  <h3>Mikä tekee Ylläksestä erityisen?</h3>

  <h4>Suomen suurimmat rinne- ja hiihtoalueet</h4>
  <p>
    Ylläs tunnetaan laajoista ja monipuolisista laskettelurinteistään. Alueelta löytyy Suomen pisimmät rinteet sekä kattava latuverkosto, josta osa kulkee upeissa Pallas–Yllästunturin kansallispuiston maisemissa.
  </p>

  <h4>Kansallispuiston läheisyys</h4>
  <p>
   Ylläs toimii porttina yhteen Suomen kauneimmista kansallispuistoista. Pallas–Yllästunturin kansallispuisto tarjoaa kymmeniä kilometrejä merkittyjä vaellusreittejä, henkeäsalpaavat ruska- ja kesämaisemat sekä erinomaiset mahdollisuudet retkeilyyn ja marjastukseen.
  </p>

  <h4>3Talvikauden elämykset</h4>
 <p>Talvella Ylläksellä voi nauttia monipuolisista aktiviteeteista, kuten husky- ja porosafareista, moottorikelkkailusta, lumikenkäilystä, fatbike-pyöräilystä sekä revontuliretkistä ja valokuvauskursseista.</p>

  <h4>Aito lappilainen hiljaisuus</h4>
  <p>
    Ylläs tarjoaa rauhallisen ja luonnonläheisen tunnelman, joka eroaa vilkkaammista Lapin kohteista. Se on täydellinen paikka niille, jotka etsivät hiljaisuutta, puhdasta tunturi-ilmaa ja aitoja lappilaisia elämyksiä.
  </p>

  <h4>Kesän ja syksyn aktiviteetit</h4>
  <p>
    Ylläs on suosittu kohde myös talven ulkopuolella. Kesällä ja ruska-aikaan voi patikoida tuntureilla, pyöräillä monipuolisilla reiteillä, kalastaa, meloa sekä nauttia Lapin yöttömästä yöstä.
  </p>

  <h4>Kylien palvelut</h4>
  <p>
   Äkäslompolon ja Ylläsjärven kylät tarjoavat kattavat palvelut: majoitusvaihtoehtoja mökeistä hotelleihin, ravintoloita, kauppoja, välinevuokraamoja sekä paikallisia tapahtumia ja kulttuuria.
  </p>

  <p>
    Ylläs on täydellinen kohde niille, jotka etsivät yhdistelmää luonnon rauhaa, tunturien kauneutta ja monipuolisia aktiviteetteja ympäri vuoden.
  </p>`

 }
];

let markersLayer;


function initMarkers() {
    if (!translations[currentLang]) {
        console.warn("Translations not ready, waiting...");
        return;
    }
    if (!map) {
        console.warn("Map not ready, waiting...");
        return;
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
            <div class="popup-header">
                <img src="${place.icon}" alt="${place.name}">
                <strong class="popup-title">${place.name}</strong>
            </div>

            <div style="font-size: 0.9em; margin: 6px 0; max-width:250px;">
               ${place.short || place.description}
            </div>

            <a href="#" class="read-more" data-place="${place.name}">
   ${translations[currentLang].weather.moreInfo}
</a>

            <div class="weather-box" style="margin-top:10px;">
                <em>${translations[currentLang].weather.loading}</em>
            </div>
            
            ${place.stream
                ? `<div class="popup-stream" 
                        data-stream="${place.stream}" 
                        data-width="${place.streamWidth}" 
                        data-height="${place.streamHeight}" 
                        style="margin-top:10px;">
                   </div>`
                : ''
            }
        `;

        const marker = L.marker([place.lat, place.lon], { icon: customIcon })
            .bindPopup(popupContent, { className: 'custom-popup' })
            .addTo(layer);


        // Popup avautuu
        marker.on('popupopen', async (e) => {
            const popup = e.popup;
            const weatherBox = popup.getElement().querySelector('.weather-box');

            // Lataa sää vain kerran
            if (weatherBox && !weatherBox.dataset.loaded) {
                const weather = await getWeather(place.lat, place.lon);

                if (weather) {
                    weatherBox.innerHTML = `
                        <div class="weather-row">
                            <img src="https://openweathermap.org/img/wn/${weather.icon}.png">
                            <span>${weather.temp}°C — ${weather.desc}</span>
                        </div>
                        <small>
                            ${translations[currentLang].weather.feels} ${weather.feels}°C |
                            ${translations[currentLang].weather.wind} ${weather.wind} m/s
                        </small>
                    `;
                } else {
                    weatherBox.innerHTML = translations[currentLang].weather.error;
                }

                weatherBox.dataset.loaded = "true";
            }

            // Lisää videostream vain kerran
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
function showPlaceInfo(place) {
    const defaultSection = document.getElementById("aurora-default");
    const infoSection = document.getElementById("place-info");

    // Piilotetaan oletussisältö
    defaultSection.style.display = "none";

    // Näytetään paikan sisältö
    infoSection.style.display = "block";

    infoSection.innerHTML = `
        
        <p>${place.description || ''}</p>
        ${place.url ? `<p><a href="${place.url}" target="_blank">Visit website</a></p>` : ''}
        ${place.stream ? 
            `<iframe src="${place.stream}" width="100%" height="250" style="border:none;margin-top:10px;"></iframe>` : ''}
        <button id="back-to-default" style="margin-top:15px;">Takaisin ohjeisiin</button>
    `;

    // Scrollataan osioon
    infoSection.scrollIntoView({ behavior: "smooth" });

    // Lisää takaisin-napin toiminto
    document.getElementById("back-to-default").onclick = () => {
        infoSection.style.display = "none";
        defaultSection.style.display = "block";
        defaultSection.scrollIntoView({ behavior: "smooth" });
    };
}


document.addEventListener('languageReady', initMarkers);
document.addEventListener('mapReady', initMarkers);
