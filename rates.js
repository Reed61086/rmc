/* Weekly Federal Reserve H.15 rates via a validated same-origin asset. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TreasuryRates = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SOURCE = 'https://fred.stlouisfed.org/series/WGS1YR';
  const THROTTLE = 15 * 60 * 1000;
  const MAX_AGE = 10 * 86400000;
  function today(now) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  }
  function valid(row, now) {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return false;
    const date = Date.parse(row.date + 'T00:00:00Z');
    return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === row.date && row.date <= today(now)
      && [row.oneYear,row.tenYear].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 20) && new Date(date).getUTCDay() === 5 && Number.isFinite(Date.parse(row.checkedAt)) && Date.parse(row.checkedAt) <= now;
  }
  function selectObservation(rows, now = Date.now()) {
    const candidates = rows.filter(row => valid(row, now)).sort((a, b) => b.date.localeCompare(a.date));
    if (!candidates.length) throw Error('No valid 10-year CMT observation.');
    const latest = candidates[0];
    if (candidates.some(row => row.date === latest.date && (row.oneYear !== latest.oneYear || row.tenYear !== latest.tenYear))) throw Error('Conflicting CMT observations.');
    return { date: latest.date, oneYear: latest.oneYear, tenYear: latest.tenYear, checkedAt: latest.checkedAt };
  }
  async function loadTreasury() {
    const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetch('data/cmt-weekly.json', {signal: abort.signal, cache: 'no-store', credentials: 'omit'});
      if (!response.ok) throw Error('Weekly CMT response ' + response.status);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  function createRateController({ load = loadTreasury, now = Date.now, cached = null, onChange = () => {}, save = () => {} } = {}) {
    const observation = valid(cached, now()) && Number.isFinite(cached.retrievedAt) && cached.retrievedAt <= now()
      ? { ...cached, source: SOURCE } : null;
    const state = { observation, status: observation ? 'cached' : 'unavailable' };
    let inFlight = null, lastAttempt = -Infinity;
    function refresh() {
      if (inFlight) return inFlight;
      if (now() - lastAttempt < THROTTLE) return Promise.resolve(state);
      lastAttempt = now();
      state.status = 'loading';
      onChange(state);
      // Start immediately; all callers share this promise.
      let loading;
      try { loading = load(now()); } catch (error) { loading = Promise.reject(error); }
      inFlight = Promise.resolve(loading).then(candidate => {
        const latest = selectObservation([candidate], now());
        if (state.observation && (latest.date < state.observation.date || Date.parse(latest.checkedAt) < Date.parse(state.observation.checkedAt) ||
          (latest.date === state.observation.date && (latest.oneYear !== state.observation.oneYear || latest.tenYear !== state.observation.tenYear)))) throw Error('Regressed or conflicting rate.');
        state.observation = { ...latest, retrievedAt: now(), source: SOURCE };
        state.status = Date.parse(today(now())) - Date.parse(latest.date) > MAX_AGE || now() - Date.parse(latest.checkedAt) > 4 * 86400000 ? 'stale' : 'ready';
        try { save(state.observation); } catch (_) { /* session state remains authoritative */ }
      }).catch(() => { state.status = 'error'; }).finally(() => {
        inFlight = null;
        onChange(state);
      });
      return inFlight;
    }
    return { state, refresh };
  }
  return { SOURCE, selectObservation, createRateController };
});
