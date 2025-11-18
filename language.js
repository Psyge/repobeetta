let currentLang = 'fi';

// Turvallinen päivitysfunktio
function updateText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function loadLanguage(lang) {
  const response = await fetch('lang.json');
  const translations = await response.json();
  currentLang = lang;

  // Päivitä tekstit turvallisesti
  updateText('page-title', translations[lang].h1);
  updateText('menu-home', translations[lang].menu.home);
  updateText('menu-faq', translations[lang].menu.faq);
  updateText('menu-contact', translations[lang].menu.contact);
  updateText('show-help', translations[lang].menu.help);

  updateText('locate-btn', translations[lang].buttons.locate);
  updateText('markers-btn', translations[lang].buttons.markers);
  updateText('forecast-btn', translations[lang].buttons.forecast);

  updateText('help-title', translations[lang].helpPopup.title);
  updateText('help-text', translations[lang].helpPopup.text);
  updateText('dont-show-text', translations[lang].helpPopup.dontShow);
  updateText('close-popup', translations[lang].helpPopup.close);

  updateText('forecast-title', translations[lang].forecastPopup.title);
  updateText('kp-low', translations[lang].forecastPopup.kpLow);
  updateText('kp-mid', translations[lang].forecastPopup.kpMid);
  updateText('kp-high', translations[lang].forecastPopup.kpHigh);
  updateText('close-forecast', translations[lang].forecastPopup.close);

  updateText('info', translations[lang].loading);
}

function setLanguage(lang) {
  loadLanguage(lang);
}

// Lataa oletuskieli DOM:n latauksen jälkeen
document.addEventListener('DOMContentLoaded', () => {
  loadLanguage(currentLang);
});
