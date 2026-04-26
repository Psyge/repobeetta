/* ============================================================
   RepoTracker — Solar Wind Module (DSCOVR / ACE real-time)
   ------------------------------------------------------------
   NOAA SWPC tarjoaa CORS-otsikoilla varustettua dataa:
     • plasma  : nopeus (km/s), tiheys (p/cm³), lämpötila
     • mag     : Bz, Bt (nT)  — kaikkein tärkein revontulille!

   Päivitysväli: 1 minuutti.
   Cachen elinikä: 60 s (säästää kaistaa).
   ============================================================ */

(function (global) {
  'use strict';

  const PLASMA_URL = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';
  const MAG_URL    = 'https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json';
  const TTL_MS     = 60 * 1000;

  let cache = { ts: 0, data: null };

  async function fetchJson(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('Fetch failed: ' + url);
    return r.json();
  }

  /** Palauttaa { bz, bt, speed, density, ts } tai null jos epäonnistuu */
  async function getSolarWind() {
    if (cache.data && (Date.now() - cache.ts) < TTL_MS) return cache.data;

    try {
      const [plasma, mag] = await Promise.all([fetchJson(PLASMA_URL), fetchJson(MAG_URL)]);

      // SWPC-formaatti: ensimmäinen rivi = otsikot, loput = data.
      // plasma cols: time_tag, density, speed, temperature
      // mag    cols: time_tag, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm, bt
      const lastValidPlasma = findLastValid(plasma, [1, 2]);
      const lastValidMag    = findLastValid(mag,    [3, 6]);

      if (!lastValidPlasma || !lastValidMag) {
        console.warn('[solar-wind] Ei kelvollisia rivejä');
        return null;
      }

      const data = {
        density: parseFloat(lastValidPlasma[1]),
        speed:   parseFloat(lastValidPlasma[2]),
        bz:      parseFloat(lastValidMag[3]),
        bt:      parseFloat(lastValidMag[6]),
        ts:      lastValidMag[0]
      };

      cache = { ts: Date.now(), data };
      return data;
    } catch (err) {
      console.warn('[solar-wind] Virhe:', err);
      return null;
    }
  }

  function findLastValid(rows, cols) {
    if (!Array.isArray(rows) || rows.length < 2) return null;
    for (let i = rows.length - 1; i >= 1; i--) {
      const r = rows[i];
      if (cols.every(c => r[c] != null && r[c] !== '' && !isNaN(parseFloat(r[c])))) {
        return r;
      }
    }
    return null;
  }

  /**
   * Muuntaa raakadatan boost-kertoimeksi 0.5..1.4
   * jota AuroraEngine käyttää.
   *
   *  Bz < -10 nT  → vahva etelään suuntautunut → boost 1.4
   *  Bz < -5 nT   → boost 1.2
   *  Bz < 0 nT    → boost 1.05
   *  Bz > 0       → boost 0.85 (pohjoinen Bz tukkii reconnectionin)
   *  + nopeusbonus: > 600 km/s → +0.05, > 800 km/s → +0.1
   *  + tiheysbonus: > 10 p/cm³ → +0.05
   */
  function computeBoost(sw) {
    if (!sw) return { boost: 1.0, label: 'No data', detail: '' };

    let boost = 1.0;
    let parts = [];

    if (sw.bz <= -10)      { boost = 1.4;  parts.push('Bz erittäin negatiivinen ✨'); }
    else if (sw.bz <= -5)  { boost = 1.2;  parts.push('Bz vahvasti etelään'); }
    else if (sw.bz <  0)   { boost = 1.05; parts.push('Bz lievästi etelään'); }
    else if (sw.bz <  3)   { boost = 0.95; parts.push('Bz neutraali'); }
    else                   { boost = 0.85; parts.push('Bz pohjoiseen ❄️'); }

    if (sw.speed > 800)      { boost += 0.10; parts.push('nopeus > 800 km/s'); }
    else if (sw.speed > 600) { boost += 0.05; parts.push('nopeus > 600 km/s'); }

    if (sw.density > 10) { boost += 0.05; parts.push('tiheys korkea'); }

    boost = Math.max(0.5, Math.min(1.4, boost));

    let label = 'Heikko';
    if (boost >= 1.3) label = 'Erinomainen';
    else if (boost >= 1.15) label = 'Hyvä';
    else if (boost >= 1.0) label = 'Normaali';
    else if (boost >= 0.9) label = 'Lievä haitta';

    return { boost, label, detail: parts.join(' · ') };
  }

  global.SolarWind = { getSolarWind, computeBoost };
})(window);
