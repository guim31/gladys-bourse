// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake Yahoo Finance serving
// the recorded chart answers of test/fixtures/yahoo (one file per symbol), a
// manual clock, a temporary /data, and the integration wired on top through
// registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

/** The fixture file of a symbol (^ and = are not kept in file names). */
export const fileOf = (symbol) => `yahoo/${symbol.replace(/[\^=]/g, '_')}.json`;

export const RECORDED = [
  'AIR.PA',
  '^FCHI',
  'CW8.PA',
  'VOD.L',
  '^GSPC',
  'EURUSD=X',
  'USDJPY=X',
  'BTC-EUR',
];

// The answers were recorded on 16/10/2026 around 03:38 UTC: Paris, London and
// New York closed, currencies and crypto trading.
export const START = Date.parse('2026-10-16T03:40:00Z');
// The Paris session of 16/10/2026 (07:00 to 15:30 UTC).
export const PARIS_OPEN = Date.parse('2026-10-16T07:00:00Z');

/**
 * Fake Yahoo Finance. `api.down`: 'network' (connection refused), a status
 * (429, 503) or false.
 */
export function createApi() {
  const charts = new Map();
  const api = {
    down: false,
    requests: [],

    /** The meta block of a symbol, to change its answer. */
    meta(symbol) {
      if (!charts.has(symbol)) {
        charts.set(symbol, fixture(fileOf(symbol)));
      }
      return charts.get(symbol).chart.result[0].meta;
    },

    /** A new trade: price (and time, ms) of a symbol. */
    trade(symbol, price, time) {
      const meta = api.meta(symbol);
      meta.regularMarketPrice = price;
      if (time !== undefined) {
        meta.regularMarketTime = time / 1000;
      }
    },

    /** Move the regular session of a symbol (ms). */
    session(symbol, start, end) {
      const regular = api.meta(symbol).currentTradingPeriod.regular;
      regular.start = start / 1000;
      regular.end = end / 1000;
    },

    async fetch(input, init = {}) {
      const url = new URL(input);
      api.requests.push({ url, headers: init.headers ?? {} });
      if (api.down === 'network') {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
      }
      if (api.down) {
        return { status: api.down, text: async () => 'Too Many Requests' };
      }
      const symbol = decodeURIComponent(url.pathname.split('/').pop());
      if (!RECORDED.includes(symbol)) {
        const body = fixture('yahoo/NOPE123XYZ.json');
        return { status: 404, text: async () => JSON.stringify(body) };
      }
      api.meta(symbol);
      return { status: 200, text: async () => JSON.stringify(charts.get(symbol)) };
    },

    /** Symbols requested so far, in order. */
    symbols() {
      return api.requests.map(({ url }) => decodeURIComponent(url.pathname.split('/').pop()));
    },
  };
  return api;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
    set(ms) {
      clock.time = ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 */
export async function createWorld({
  config = {},
  devices = [],
  api = createApi(),
  connect = true,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-bourse-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, { store, fetch: api.fetch, timers: false, now: clock.now });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** Create every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
  return world.fake.discoveredDevices;
}

/** The discovered device of a symbol. */
export const deviceOf = (world, symbol) =>
  world.fake.discoveredDevices.find((device) => device.name.endsWith(`(${symbol})`));

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 10) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
