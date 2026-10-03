/* Shared by every layout. No borrower data is sent to Treasury. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TreasuryRates = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SOURCE = 'https://home.treasury.gov/treasury-daily-interest-rate-xml-feed';
  const THROTTLE = 15 * 60 * 1000;
  const MAX_AGE = 7 * 86400000;
  function today(now) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  }
  function valid(row, now) {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return false;
    const date = Date.parse(row.date + 'T00:00:00Z');
    return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === row.date && row.date <= today(now)
      && typeof row.value === 'number' && Number.isFinite(row.value) && row.value > 0 && row.value <= 20;
  }
  function selectObservation(rows, now = Date.now()) {
    const candidates = rows.filter(row => valid(row, now)).sort((a, b) => b.date.localeCompare(a.date));
    if (!candidates.length) throw Error('No valid 10-year CMT observation.');
    const latest = candidates[0];
    if (candidates.some(row => row.date === latest.date && row.value !== latest.value)) throw Error('Conflicting CMT observations.');
    return { date: latest.date, value: latest.value };
  }
  function parseFeed(xml, now = Date.now()) {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.getElementsByTagName('parsererror').length) throw Error('Invalid Treasury XML.');
    const ns = 'http://schemas.microsoft.com/ado/2007/08/dataservices';
    const rows = Array.from(document.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'entry'), entry => {
      const date = entry.getElementsByTagNameNS(ns, 'NEW_DATE')[0]?.textContent.slice(0, 10);
      const value = entry.getElementsByTagNameNS(ns, 'BC_10YEAR')[0]?.textContent.trim();
      return { date, value: value ? Number(value) : NaN };
    });
    return selectObservation(rows, now);
  }
  async function loadTreasury(now = Date.now()) {
    const year = Number(today(now).slice(0, 4));
    async function loadYear(year) {
      const url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=' + year;
      let error;
      for (let attempt = 0; attempt < 2; attempt++) {
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 10000);
        try {
          const response = await fetch(url, { signal: abort.signal, cache: 'no-store', credentials: 'omit' });
          if (!response.ok) throw Error('Treasury response ' + response.status);
          return parseFeed(await response.text(), now);
        } catch (failure) { error = failure; }
        finally { clearTimeout(timeout); }
        if (!attempt) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw error;
    }
    try { return await loadYear(year); }
    catch (error) {
      // January's first trading observation may not yet have been published.
      if (today(now).slice(5, 7) === '01') return loadYear(year - 1);
      throw error;
    }
  }
  function createRateController({ load = loadTreasury, now = Date.now, cached = null, onChange = () => {}, save = () => {} } = {}) {
    const observation = valid(cached, now()) && Number.isFinite(cached.retrievedAt) && cached.retrievedAt <= now()
      ? { date: cached.date, value: cached.value, retrievedAt: cached.retrievedAt, source: SOURCE } : null;
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
        if (state.observation && (latest.date < state.observation.date ||
          (latest.date === state.observation.date && latest.value !== state.observation.value))) throw Error('Regressed or conflicting rate.');
        state.observation = { ...latest, retrievedAt: now(), source: SOURCE };
        state.status = Date.parse(today(now())) - Date.parse(latest.date) > MAX_AGE ? 'stale' : 'ready';
        try { save(state.observation); } catch (_) { /* session state remains authoritative */ }
      }).catch(() => { state.status = 'error'; }).finally(() => {
        inFlight = null;
        onChange(state);
      });
      return inFlight;
    }
    return { state, refresh };
  }
  return { SOURCE, parseFeed, selectObservation, createRateController };
});
