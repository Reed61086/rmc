const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectObservation, createRateController } = require('../rates.js');
const now = Date.parse('2026-10-03T17:00:00Z');
const row = (date, value) => ({ date, oneYear: value, tenYear: value, checkedAt: new Date(now-1000).toISOString() });
test('selects latest valid observation independent of feed order', () => {
  assert.deepEqual(selectObservation([row('2026-09-25', 4.2), row('2026-10-02', 4.3)], now), row('2026-10-02', 4.3));
});
test('rejects absent, nonfinite, future and impossible dates', () => {
  for (const candidate of [row('2026-10-02', ''), row('2026-10-02', NaN), row('2026-10-04', 4), row('2026-02-30', 4)]) {
    assert.throws(() => selectObservation([candidate], now));
  }
});
test('contradictory observations for latest date fail closed', () => {
  assert.throws(() => selectObservation([row('2026-10-02', 4.2), row('2026-10-02', 4.3)], now));
});
test('refresh is single-flight, throttled, and retains provenance', async () => {
  let calls = 0, resolve;
  const controller = createRateController({ now: () => now, load: () => { calls++; return new Promise(r => resolve = r); } });
  const first = controller.refresh();
  const second = controller.refresh();
  assert.equal(calls, 1);
  resolve(row('2026-10-02', 4.3));
  await Promise.all([first, second]);
  assert.equal(controller.state.status, 'ready');
  assert.equal(controller.state.observation.oneYear, 4.3);
  await controller.refresh();
  assert.equal(calls, 1);
});
test('failed refresh retains historical rate and never marks it current', async () => {
  const controller = createRateController({ now: () => now, cached: { ...row('2026-10-02', 4.3), retrievedAt: now - 1000 }, load: async () => { throw Error('offline'); } });
  await controller.refresh();
  assert.equal(controller.state.status, 'error');
  assert.equal(controller.state.observation.oneYear, 4.3);
});
test('older feed cannot overwrite newer cached observation', async () => {
  const controller = createRateController({ now: () => now, cached: { ...row('2026-10-02', 4.3), retrievedAt: now - 1000 }, load: async () => row('2026-09-25', 4.2) });
  await controller.refresh();
  assert.equal(controller.state.status, 'error');
  assert.equal(controller.state.observation.date, '2026-10-02');
});
test('old observations and tampered caches cannot become current', async () => {
  const controller = createRateController({ now: () => now, cached: { date: '2026-10-04', oneYear: 4, tenYear:4 }, load: async () => row('2026-09-18', 4.2) });
  assert.equal(controller.state.observation, null);
  await controller.refresh();
  assert.equal(controller.state.status, 'stale');
});
test('synchronous provider failure is surfaced without crashing refresh', async () => {
  const controller = createRateController({ now: () => now, load: () => { throw Error('failure'); } });
  await controller.refresh();
  assert.equal(controller.state.status, 'error');
  assert.equal(controller.state.observation, null);
});

test('both weekly maturities and source check freshness are required', async () => {
  assert.throws(() => selectObservation([{...row('2026-10-02',4.3), tenYear:undefined}],now));
  assert.throws(() => selectObservation([{...row('2026-10-02',4.3), checkedAt:'invalid'}],now));
  const controller=createRateController({now:()=>now,load:async()=>({...row('2026-10-02',4.3),checkedAt:'2026-09-25T12:00:00Z'})});
  await controller.refresh();
  assert.equal(controller.state.status,'stale');
});
