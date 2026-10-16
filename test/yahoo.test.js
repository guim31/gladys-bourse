// -----------------------------------------------------------------------------
// The Yahoo Finance client on the recorded answers (test/fixtures/yahoo): the
// quote of each kind of instrument, the state of the market, the refusals, and
// the parsing of the configuration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseAlerts, parseSymbols } from '../src/config.js';
import { platformIdOf, unitOf } from '../src/device.js';
import {
  RefusedError,
  USER_AGENT,
  UnknownSymbolError,
  fetchQuote,
  parseChart,
} from '../src/yahoo.js';
import { PARIS_OPEN, START, createApi, fileOf, fixture } from './helpers/world.js';

const chart = (symbol) => fixture(fileOf(symbol));

test('a Paris share at night: price, change from the previous close, market closed', () => {
  const quote = parseChart(chart('AIR.PA'), 'AIR.PA', START);
  assert.equal(quote.longName, 'Airbus SE');
  assert.equal(quote.currency, 'EUR');
  assert.equal(quote.price, 194.78);
  assert.equal(quote.previousClose, 190.22);
  assert.equal(quote.change, 4.56);
  assert.equal(quote.changePercent, 2.4);
  assert.equal(quote.open, false);
});

test('the same share during the session, once it traded: open', () => {
  const body = chart('AIR.PA');
  body.chart.result[0].meta.regularMarketTime = (PARIS_OPEN + 60000) / 1000;
  assert.equal(parseChart(body, 'AIR.PA', PARIS_OPEN + 120000).open, true);
  // A holiday: the usual hours, but no trade since they started.
  assert.equal(parseChart(chart('AIR.PA'), 'AIR.PA', PARIS_OPEN + 120000).open, false);
});

test('currencies and crypto trade at night; decimals follow priceHint', () => {
  const eurusd = parseChart(chart('EURUSD=X'), 'EURUSD=X', START);
  assert.equal(eurusd.open, true);
  assert.equal(eurusd.decimals, 4);
  assert.equal(eurusd.currency, 'USD');
  assert.equal(eurusd.change, -0.0001);
  const btc = parseChart(chart('BTC-EUR'), 'BTC-EUR', START);
  assert.equal(btc.open, true);
  assert.equal(btc.type, 'CRYPTOCURRENCY');
  // Since 00:00 UTC (the previous close of Yahoo for crypto), not over 24 hours.
  assert.equal(btc.changePercent, -0.51);
});

test('London shares are quoted in pence: no unit, the code says GBp', () => {
  const vod = parseChart(chart('VOD.L'), 'VOD.L', START);
  assert.equal(vod.currency, 'GBp');
  assert.equal(unitOf(vod.currency), undefined);
  assert.equal(unitOf('GBP'), 'pound-sterling');
  assert.equal(unitOf('EUR'), 'euro');
  assert.equal(unitOf('JPY'), undefined);
});

test('an answer without data is an unknown symbol', () => {
  assert.throws(
    () => parseChart(fixture('yahoo/NOPE123XYZ.json'), 'NOPE', START),
    UnknownSymbolError,
  );
});

test('fetchQuote: honest user agent, 404 unknown, 429 refused, network error', async () => {
  const api = createApi();
  const quote = await fetchQuote(api.fetch, '^FCHI', START);
  assert.equal(quote.longName, 'CAC 40');
  assert.equal(api.requests[0].url.pathname, '/v8/finance/chart/%5EFCHI');
  assert.equal(api.requests[0].headers['user-agent'], USER_AGENT);
  await assert.rejects(fetchQuote(api.fetch, 'NOPE', START), UnknownSymbolError);
  api.down = 429;
  await assert.rejects(fetchQuote(api.fetch, 'AIR.PA', START), RefusedError);
  api.down = 503;
  await assert.rejects(fetchQuote(api.fetch, 'AIR.PA', START), /HTTP 503/);
  api.down = 'network';
  await assert.rejects(fetchQuote(api.fetch, 'AIR.PA', START), /unreachable: ECONNREFUSED/);
});

test('symbols: uppercased, deduplicated, 20 at most, the rest reported', () => {
  const many = Array.from({ length: 22 }, (_, i) => `S${i}`).join(' ');
  assert.deepEqual(parseSymbols('air.pa; ^fchi, AIR.PA eur/usd'), {
    symbols: ['AIR.PA', '^FCHI'],
    invalid: ['eur/usd'],
    dropped: 0,
  });
  const parsed = parseSymbols(many);
  assert.equal(parsed.symbols.length, 20);
  assert.equal(parsed.dropped, 2);
});

test('price alerts: > or <, decimal comma, one per entry', () => {
  const { alerts, invalid } = parseAlerts('air.pa > 200; BTC-EUR<50 000\nEURUSD=X >= 1,15; oops');
  assert.deepEqual(
    alerts.map(({ symbol, direction, threshold }) => [symbol, direction, threshold]),
    [
      ['AIR.PA', 'above', 200],
      ['BTC-EUR', 'below', 50000],
      ['EURUSD=X', 'above', 1.15],
    ],
  );
  assert.deepEqual(invalid, ['oops']);
});

test('configuration: defaults, an emptied list follows nothing', () => {
  const defaults = normalizeConfig({});
  assert.deepEqual(defaults.symbols, ['^FCHI', 'EURUSD=X', 'BTC-EUR']);
  assert.equal(defaults.refreshMinutes, 10);
  assert.equal(defaults.language, 'fr');
  assert.deepEqual(normalizeConfig({ symbols: '' }).symbols, []);
  assert.equal(normalizeConfig({ refresh_interval: '7', language: 'it' }).refreshMinutes, 10);
});

test('platform ids: stable, without ^ nor =', () => {
  assert.equal(platformIdOf('^FCHI'), '_5EFCHI');
  assert.equal(platformIdOf('EURUSD=X'), 'EURUSD_3DX');
  assert.equal(platformIdOf('BTC-EUR'), 'BTC-EUR');
  assert.equal(platformIdOf('AIR.PA'), 'AIR.PA');
});
