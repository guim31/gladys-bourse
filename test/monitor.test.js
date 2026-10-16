// -----------------------------------------------------------------------------
// The monitor: cadence (closed markets and unknown symbols read less often, a
// refusal of Yahoo spaces the cycles out), states (only the changes, all again
// when a device is created), and the two scene triggers with their memory
// under /data.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REARM_RATIO, TRIGGERS } from '../src/monitor.js';
import {
  PARIS_OPEN,
  createAll,
  createApi,
  createClock,
  createWorld,
  cycle,
  deviceOf,
  featureId,
} from './helpers/world.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

async function world(t, config = {}, options = {}) {
  const w = await createWorld({ config, ...options });
  t.after(() => w.app.stop());
  return w;
}

// Intl separates thousands and units with (narrow) no-break spaces.
const plain = (text) => text.replace(/[\u202f\u00a0]/g, ' ');
const events = (w, key) => w.fake.sceneEvents.filter((event) => event.key === key);

test('closed markets are read every 30 minutes, open ones at every cycle', async (t) => {
  const api = createApi();
  const w = await world(t, { symbols: 'AIR.PA, BTC-EUR' }, { api });
  assert.deepEqual(api.symbols(), ['AIR.PA', 'BTC-EUR']);
  await cycle(w); // +10 min
  await cycle(w); // +20 min
  assert.deepEqual(api.symbols().slice(2), ['BTC-EUR', 'BTC-EUR']);
  await cycle(w); // +30 min: Paris again
  assert.deepEqual(api.symbols().slice(4), ['AIR.PA', 'BTC-EUR']);
});

test('the session of Paris starts: read at once, then at every cycle', async (t) => {
  const api = createApi();
  const clock = createClock();
  const w = await world(t, { symbols: 'AIR.PA' }, { api, clock });
  clock.set(PARIS_OPEN + 5 * MINUTE);
  api.trade('AIR.PA', 195.1, PARIS_OPEN + 4 * MINUTE);
  await w.monitor.runCycle();
  assert.equal(api.symbols().length, 2);
  assert.equal(w.monitor.quotes.get('AIR.PA').open, true);
  await cycle(w);
  assert.equal(api.symbols().length, 3);
});

test('an unknown symbol is said, has no device, and is asked again after 6 hours only', async (t) => {
  const api = createApi();
  const w = await world(t, { symbols: 'NOPE, EURUSD=X' }, { api });
  assert.deepEqual(
    w.fake.discoveredDevices.map((device) => device.name),
    ['EUR/USD (EURUSD=X)'],
  );
  assert.match(w.fake.connectionStatus.message.en, /Unknown to Yahoo Finance: NOPE/);
  assert.equal(w.fake.connectionStatus.connected, true);
  for (let i = 0; i < 6; i += 1) {
    await cycle(w);
  }
  assert.equal(api.symbols().filter((s) => s === 'NOPE').length, 1);
  await cycle(w, 6 * 60);
  assert.equal(api.symbols().filter((s) => s === 'NOPE').length, 2);
});

test('a refusal (429) stops the cycle and spaces the next ones out', async (t) => {
  const api = createApi();
  const w = await world(t, { symbols: 'EURUSD=X, BTC-EUR' }, { api });
  api.down = 429;
  await cycle(w);
  assert.equal(api.requests.length, 3, 'the second symbol is not asked');
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /refuses the requests/);
  await cycle(w);
  assert.equal(api.requests.length, 3, 'skipped: 20 minutes of wait after one refusal');
  api.down = false;
  await cycle(w, 15);
  assert.equal(api.requests.length, 5);
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('states: all at creation, then only the changes', async (t) => {
  const api = createApi();
  const w = await world(t, { symbols: 'BTC-EUR' }, { api });
  assert.equal(w.fake.states.length, 0, 'nothing before the device exists');
  const [device] = await createAll(w);
  assert.equal(w.fake.states.length, 6);
  assert.equal(w.fake.lastState(featureId(device, 'price')), 72878.16);
  assert.equal(w.fake.lastState(featureId(device, 'currency')), 'EUR');
  assert.equal(w.fake.lastState(featureId(device, 'market')), 'Ouvert');
  assert.ok(w.fake.widgetRefreshes.includes('quotes'));
  await cycle(w);
  assert.equal(w.fake.states.length, 6, 'nothing changed, nothing sent');
  api.trade('BTC-EUR', 72900.5);
  await cycle(w);
  assert.equal(w.fake.states.length, 9, 'price, change and percent');
  assert.equal(w.fake.lastState(featureId(device, 'price')), 72900.5);
});

test('the container reads by itself, without onPoll (own timer)', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const api = createApi();
  const gladysWorld = await createWorld({ config: { symbols: 'BTC-EUR' }, api });
  t.after(() => gladysWorld.app.stop());
  // timers: false in the test world; a monitor with its timer is checked here.
  const { Monitor } = await import('../src/monitor.js');
  const { normalizeConfig } = await import('../src/config.js');
  const monitor = new Monitor({
    gladys: gladysWorld.gladys,
    store: gladysWorld.store,
    fetch: api.fetch,
    timers: true,
  });
  await monitor.start(normalizeConfig({ symbols: 'BTC-EUR', refresh_interval: '5' }));
  await monitor.running;
  const before = api.requests.length;
  t.mock.timers.tick(5 * MINUTE);
  await monitor.running;
  assert.equal(api.requests.length, before + 1);
  await monitor.stop();
});

test('price alert: fires once, re-armed past the margin, nothing at the first sight', async (t) => {
  const api = createApi();
  const config = { symbols: 'BTC-EUR', price_alerts: 'BTC-EUR > 75000; BTC-EUR > 70000' };
  const w = await world(t, config, { api });
  await createAll(w);
  // 72 878 at the start: above 70 000 already, which is no news.
  assert.equal(w.fake.sceneEvents.length, 0);
  api.trade('BTC-EUR', 75100);
  await cycle(w);
  api.trade('BTC-EUR', 75200);
  await cycle(w);
  api.trade('BTC-EUR', 75000 * (1 - REARM_RATIO / 2)); // back, within the margin
  await cycle(w);
  api.trade('BTC-EUR', 75500);
  await cycle(w);
  assert.equal(events(w, TRIGGERS.THRESHOLD).length, 1);
  api.trade('BTC-EUR', 74000); // re-armed
  await cycle(w);
  api.trade('BTC-EUR', 75001);
  await cycle(w);
  const fired = events(w, TRIGGERS.THRESHOLD);
  assert.equal(fired.length, 2);
  assert.equal(fired[1].data.device, deviceOf(w, 'BTC-EUR').external_id);
  assert.equal(fired[1].data.direction, 'above');
  assert.equal(fired[1].data.threshold, 75000);
  assert.equal(fired[1].data.price, 75001);
  assert.match(
    plain(fired[1].data.text),
    /^Bitcoin EUR est passé au-dessus de 75 000,00 € : 75 001,00 €\.$/,
  );
});

test('price alert below, and a restart does not fire it again', async (t) => {
  const api = createApi();
  const config = { symbols: 'BTC-EUR', price_alerts: 'BTC-EUR < 72000' };
  const w = await world(t, config, { api });
  api.trade('BTC-EUR', 71000);
  await cycle(w);
  assert.equal(events(w, TRIGGERS.THRESHOLD).length, 1);
  await w.app.stop();
  const again = await world(t, config, { api, dataDir: w.dataDir });
  await cycle(again);
  assert.equal(events(again, TRIGGERS.THRESHOLD).length, 0);
});

test('daily move: one event per level reached, per direction, per session', async (t) => {
  const api = createApi();
  const w = await world(t, { symbols: 'BTC-EUR' }, { api });
  // Previous close 73 249.95: -0.51 % at the start, the starting point.
  api.trade('BTC-EUR', 71700); // -2.12 %
  await cycle(w);
  api.trade('BTC-EUR', 71500); // -2.39 %, no new level
  await cycle(w);
  api.trade('BTC-EUR', 69000); // -5.8 %
  await cycle(w);
  const moves = events(w, TRIGGERS.MOVE).map((e) => [e.data.direction, e.data.threshold]);
  assert.deepEqual(moves, [
    ['down', 1],
    ['down', 2],
    ['down', 3],
    ['down', 5],
  ]);
  const last = events(w, TRIGGERS.MOVE).at(-1).data;
  assert.equal(last.change_percent, -5.8);
  assert.equal(plain(last.text), "Bitcoin EUR perd 5,80 % aujourd'hui : 69 000,00 €.");
  // Next UTC day: a new session, the levels start again.
  const day = 24 * HOUR;
  const meta = api.meta('BTC-EUR');
  api.session('BTC-EUR', meta.currentTradingPeriod.regular.start * 1000 + day, Infinity);
  meta.chartPreviousClose = 69000;
  api.trade('BTC-EUR', 70500, w.clock.now() + day); // +2.17 %
  await cycle(w, 24 * 60);
  assert.deepEqual(
    events(w, TRIGGERS.MOVE)
      .slice(4)
      .map((e) => [e.data.direction, e.data.threshold]),
    [
      ['up', 1],
      ['up', 2],
    ],
  );
});

test('daily move: yesterday change seen before the first trade is not a move', async (t) => {
  const api = createApi();
  const clock = createClock();
  const w = await world(t, { symbols: 'AIR.PA' }, { api, clock });
  // Airbus closed at +2.40 % yesterday; the session of today has started, no trade yet.
  clock.set(PARIS_OPEN + MINUTE);
  await w.monitor.runCycle();
  assert.equal(w.monitor.data.moves['AIR.PA'], undefined);
  api.trade('AIR.PA', 190.5, PARIS_OPEN + 2 * MINUTE); // +0.15 %: the starting point
  await cycle(w);
  api.trade('AIR.PA', 186, PARIS_OPEN + 15 * MINUTE); // -2.22 %
  await cycle(w);
  assert.deepEqual(
    events(w, TRIGGERS.MOVE).map((e) => [e.data.symbol, e.data.direction, e.data.threshold]),
    [
      ['AIR.PA', 'down', 1],
      ['AIR.PA', 'down', 2],
    ],
  );
});
