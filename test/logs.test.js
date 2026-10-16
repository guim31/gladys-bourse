// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, a price alert, Yahoo lost and back, a user action), never one
// line per refresh cycle; a failure that repeats at every cycle is logged
// once, plus one line when it is over.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureLogs, createAll, createApi, createWorld, cycle } from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function world(t, config = {}, options = {}) {
  const w = await createWorld({ config, ...options });
  t.after(() => w.app.stop());
  return w;
}

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  await world(t);
  assert.deepEqual(lines.map(strip), ['[INFO] [bourse] Started: 3 symbol(s) read every 10 min']);
});

test('normal refresh cycles write nothing at info, daily moves included', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  await createAll(w);
  const lines = captureLogs(t, 'info');
  api.trade('BTC-EUR', 70000);
  for (let i = 0; i < 4; i += 1) {
    await cycle(w);
  }
  assert.ok(w.fake.sceneEvents.length > 0);
  assert.deepEqual(lines, []);
});

test('a price alert is one info line', async (t) => {
  const api = createApi();
  const w = await world(t, { price_alerts: 'BTC-EUR > 75000' }, { api });
  const lines = captureLogs(t, 'info');
  api.trade('BTC-EUR', 76000);
  await cycle(w);
  await cycle(w);
  assert.deepEqual(lines.map(strip), ['[INFO] [bourse] Price alert: BTC-EUR above 75000 (76000)']);
});

test('Yahoo down at every cycle: one warning, then one line at recovery', async (t) => {
  const api = createApi();
  const w = await world(t, {}, { api });
  const lines = captureLogs(t, 'info');
  api.down = 503;
  for (let i = 0; i < 4; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', '[bourse] Yahoo Finance answered HTTP 503']],
  );
  api.down = false;
  await cycle(w);
  assert.deepEqual(lines.slice(1).map(strip), ['[INFO] [bourse] Yahoo Finance answers again']);
});

test('an unknown symbol is said once, a configuration problem at the start', async (t) => {
  const lines = captureLogs(t, 'info');
  const w = await world(t, { symbols: 'NOPE, eur/usd', price_alerts: 'AIR.PA > 1; what' });
  for (let i = 0; i < 3; i += 1) {
    await cycle(w, 6 * 60);
  }
  assert.deepEqual(lines.map(strip), [
    '[WARN] [bourse] Not a symbol, ignored: eur/usd',
    '[WARN] [bourse] Price alert not understood, ignored: what',
    '[WARN] [bourse] Price alert on a symbol not followed: AIR.PA',
    '[INFO] [bourse] Started: 1 symbol(s) read every 10 min',
    '[WARN] [bourse] Yahoo Finance does not know NOPE',
  ]);
});
