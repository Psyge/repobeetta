/* ============================================================
   RepoTracker — Multi-Factor Aurora Visibility Engine
   ------------------------------------------------------------
   Lopullinen pistemäärä (0–100 %) lasketaan kaavalla:

     finalScore = OVATION
                  × CloudFactor
                  × DarknessFactor
                  × MoonFactor
                  × SolarWindBoost
                  × LatitudeFactor

   Kaikki tekijät palautuvat välillä 0..1 (paitsi SolarWindBoost
   joka voi olla 0.5..1.4 — eli huono aurinkotuuli jopa puolittaa
   ja erinomainen kohottaa 40 %).
   ============================================================ */

(function (global) {
  'use strict';

  // -----------------------------------------------------------
  // 1) ASTRONOMIA — pimeys ja kuun vaihe (kevyt SunCalc-pohja)
  // -----------------------------------------------------------
  const PI = Math.PI, rad = PI / 180;
  const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;

  function toJulian(date) { return date.valueOf() / dayMs - 0.5 + J1970; }
  function toDays(date)   { return toJulian(date) - J2000; }

  function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }
  function eclipticLongitude(M) {
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2*M) + 0.0003 * Math.sin(3*M));
    return M + C + rad * 102.9372 + PI;
  }
  function sunCoords(d) {
    const M = solarMeanAnomaly(d);
    const L = eclipticLongitude(M);
    const e = rad * 23.4397;
    return {
      dec: Math.asin(Math.sin(0) * Math.cos(e) + Math.cos(0) * Math.sin(e) * Math.sin(L)),
      ra:  Math.atan2(Math.sin(L) * Math.cos(e) - Math.tan(0) * Math.sin(e), Math.cos(L))
    };
  }
  function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }
  function sunAltitude(date, lat, lon) {
    const lw = rad * -lon, phi = rad * lat;
    const d = toDays(date), c = sunCoords(d);
    const H = siderealTime(d, lw) - c.ra;
    return Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
  }

  /**
   * DarknessFactor 0..1:
   *  - aurinko korkeammalla kuin -6°  → 0   (päivä / sivilihämärä)
   *  - aurinko -6° … -12°             → 0..0.6 (sivilihämärä)
   *  - aurinko -12° … -18°            → 0.6..1 (nautt./astron. hämärä)
   *  - aurinko alle -18°              → 1   (täysi yö)
   */
  function darknessFactor(date, lat, lon) {
    const altDeg = sunAltitude(date, lat, lon) / rad;
    if (altDeg >= -6)  return 0;
    if (altDeg >= -12) return 0.6 * ((-6 - altDeg) / 6);
    if (altDeg >= -18) return 0.6 + 0.4 * ((-12 - altDeg) / 6);
    return 1;
  }

  /** Kuun vaihe 0..1 (0 = uusikuu, 0.5 = täysikuu) */
  function moonPhase(date) {
    const d = toDays(date);
    const M = rad * (134.963 + 13.064993 * d);
    const F = rad * (93.272  + 13.229350 * d);
    const l = rad * (218.316 + 13.176396 * d);
    // sun longitude approx
    const sM = solarMeanAnomaly(d);
    const sL = eclipticLongitude(sM);
    const phi = Math.acos(Math.cos(l - sL));
    return phi / PI; // 0..1
  }

  /**
   * MoonFactor 0..1:
   *  - uusikuu (vaihe 0)  → 1
   *  - täysikuu (vaihe 1) → 0.55
   *  Lineaarinen interpolaatio. (Kuu ei estä revontulia, mutta
   *  himmentää heikkoja näkyvyyksiä.)
   */
  function moonFactor(date) {
    const phase = moonPhase(date); // 0..1
    return 1 - 0.45 * phase;
  }

  // -----------------------------------------------------------
  // 2) MAGNEETTINEN LEVEYSASTE
  // -----------------------------------------------------------
  // Yksinkertaistettu IGRF: pohjoismagneettinen napa ~ 80.7°N, 72.7°W
  const MAG_POLE_LAT = 80.7, MAG_POLE_LON = -72.7;
  function magneticLatitude(lat, lon) {
    const φ1 = lat * rad, φ2 = MAG_POLE_LAT * rad;
    const Δλ = (lon - MAG_POLE_LON) * rad;
    const cosTheta = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return 90 - Math.acos(Math.max(-1, Math.min(1, cosTheta))) / rad;
  }

  /**
   * LatitudeFactor 0..1:
   *  - magneettinen lat ≥ 65°  → 1.0  (auroran ovaalin sisällä jo Kp 2)
   *  - 60..65°                 → 0.85
   *  - 55..60°                 → 0.70
   *  - alle 55°                → 0.40 (vaatii myrskyn)
   */
  function latitudeFactor(lat, lon) {
    const mlat = Math.abs(magneticLatitude(lat, lon));
    if (mlat >= 65) return 1.0;
    if (mlat >= 60) return 0.85;
    if (mlat >= 55) return 0.70;
    if (mlat >= 50) return 0.55;
    return 0.40;
  }

  // -----------------------------------------------------------
  // 3) PILVISYYS
  // -----------------------------------------------------------
  function cloudFactor(cloudsPercent) {
    if (cloudsPercent == null) return 0.5;
    // ei lineaarinen: jo 50 % pilviä haittaa merkittävästi
    const c = Math.max(0, Math.min(100, cloudsPercent)) / 100;
    return Math.pow(1 - c, 1.3);
  }

  // -----------------------------------------------------------
  // 4) PÄÄFUNKTIO
  // -----------------------------------------------------------
  /**
   * @param {object} params
   *   ovation  : 0..100   NOAA OVATION-todennäköisyys lähimmästä gridistä
   *   clouds   : 0..100   Pilvisyysprosentti
   *   lat, lon : Sijainti
   *   date     : Date-olio (oletus: nyt)
   *   solarWind: { boost: 0.5..1.4 } optional, solar-wind.js:stä
   *
   * @returns {object} {
   *   score: 0..100,
   *   status: 'low'|'moderate'|'high'|'extreme',
   *   factors: { ovation, clouds, darkness, moon, latitude, solarWind, magLat },
   *   advice: string
   * }
   */
  function computeAuroraScore(params) {
    const { ovation, clouds, lat, lon, date = new Date(), solarWind = null } = params;

    const fOv   = Math.max(0, Math.min(100, ovation || 0)) / 100;
    const fCld  = cloudFactor(clouds);
    const fDark = darknessFactor(date, lat, lon);
    const fMoon = moonFactor(date);
    const fLat  = latitudeFactor(lat, lon);
    const fSW   = solarWind && typeof solarWind.boost === 'number'
                    ? Math.max(0.5, Math.min(1.4, solarWind.boost))
                    : 1.0;

    let score = fOv * fCld * fDark * fMoon * fLat * fSW * 100;
    score = Math.max(0, Math.min(100, Math.round(score)));

    let status = 'low';
    if (score >= 70) status = 'high';
    else if (score >= 40) status = 'moderate';
    if (score >= 90) status = 'extreme';

    // Dynaaminen ohje
    let advice = '';
    if (fDark === 0) advice = '☀️ Liian valoisaa — odota auringonlaskun jälkeistä hämärää.';
    else if (clouds > 80) advice = '☁️ Pilvet peittävät taivaan. Etsi aukeampaa aluetta.';
    else if (fOv < 0.1) advice = '🌌 Auroraktivisuus matalalla — seuraa Bz-arvoa.';
    else if (fMoon < 0.7) advice = '🌕 Kuu kirkas — heikot revontulet jäävät piiloon.';
    else if (score >= 70) advice = '✨ Erinomaiset olosuhteet — ulos heti!';
    else if (score >= 40) advice = '👀 Kohtalaiset olot — tarkkaile pohjoista.';
    else advice = '⏳ Olot heikot juuri nyt.';

    return {
      score,
      status,
      factors: {
        ovation:    Math.round(fOv * 100),
        clouds:     Math.round(fCld * 100),
        darkness:   Math.round(fDark * 100),
        moon:       Math.round(fMoon * 100),
        latitude:   Math.round(fLat * 100),
        solarWind:  Math.round(fSW * 100),
        magLat:     +magneticLatitude(lat, lon).toFixed(1)
      },
      advice
    };
  }

  // Public API
  global.AuroraEngine = {
    computeAuroraScore,
    darknessFactor,
    moonFactor,
    moonPhase,
    latitudeFactor,
    magneticLatitude,
    cloudFactor
  };
})(window);
