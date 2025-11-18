let currentLang = 'fi';

async function loadLanguage(lang) {
  const response = await fetch('lang.json');
  const translations = await response.json();
  currentLang = lang;

  // Päivitä tekstit
  document.querySelector('h1').textContent = translations[lang].h1;
  document.querySelector('#menu a[href="index.html"]').textContent = translations[lang].menu.home;
  document.querySelector('#menu a[href="faq.html"]').textContent = translations[lang].menu.faq;
  document.querySelector('#menu a[href="contact.html"]').textContent = translations[lang].menu.contact;
  document.querySelector('#show-help').textContent = translations[lang].menu.help;

  // Napit
  document.getElementById('locate-btn').textContent = translations[lang].buttons.locate;
  document.getElementById('markers-btn').textContent = translations[lang].buttons.markers;
  document.getElementById('forecast-btn').textContent = translations[lang].buttons.forecast;

  // Help-popup
  document.querySelector('#help-popup h2').textContent = translations[lang].helpPopup.title;
  document.querySelector('#help-popup p').textContent = translations[lang].helpPopup.text;
  document.querySelector('#dont-show-again').nextSibling.textContent = translations[lang].helpPopup.dontShow;
  document.getElementById('close-popup').textContent = translations[lang].helpPopup.close;

  // Forecast-popup
  document.querySelector('#forecast-popup h2').textContent = translations[lang].forecastPopup.title;
  const kpLegend = document.querySelectorAll('.kp-legend p');
  kpLegend[0].innerHTML = `<span class="kp-dot" style="color:green;">●</span> ${translations[lang].forecastPopup.kpLow}`;
  kpLegend[1].innerHTML = `<span class="kp-dot" style="color:orange;">●</span> ${translations[lang].forecastPopup.kpMid}`;
  kpLegend[2].innerHTML = `<span class="kp-dot" style="color:red;">●</span> ${translations[lang].forecastPopup.kpHigh}`;
  document.getElementById('close-forecast').textContent = translations[lang].forecastPopup.close;

  // Latausinfo
  document.getElementById('info').textContent = translations[lang].loading;
}

function setLanguage(lang) {
  loadLanguage(lang);
}

// Lataa oletuskieli
document.addEventListener('DOMContentLoaded', () => {
  loadLanguage(currentLang);
});
