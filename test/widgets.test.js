// -----------------------------------------------------------------------------
// The `quotes` widget and the actions: contents within the core budget
// (validateWidgetContent: an empty array means rendered as sent), the texts of
// every language, the outputs of the scene actions and the configuration
// action.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { MAX_ITEMS } from '../src/widgets.js';
import { RECORDED, createApi, createWorld, deviceOf } from './helpers/world.js';

const plain = (text) => text.replace(/[\u202f\u00a0]/g, ' ');

async function world(t, config = {}, options = {}) {
  const w = await createWorld({ config, ...options });
  t.after(() => w.app.stop());
  return w;
}

const content = async (w, language) =>
  (await w.fake.widgetGet('quotes', { settings: {}, language })).data.content;

test('the widget lists the symbols in order, within the budget, coloured by the change', async (t) => {
  const w = await world(t, { symbols: 'AIR.PA, CW8.PA, ^FCHI' });
  for (const language of LANGUAGES) {
    const widget = await content(w, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
    const list = widget.components.find((c) => c.type === 'card-list');
    assert.deepEqual(
      list.items.map((item) => item.title),
      ['Airbus SE', 'Amundi MSCI World Swap UCITS ET', 'CAC 40'],
    );
    assert.deepEqual(
      list.items.map((item) => item.badge.color),
      ['success', 'danger', 'success'],
    );
    assert.match(list.items[0].links[0].url, /^https:\/\/finance\.yahoo\.com\/quote\/AIR\.PA$/);
  }
  const fr = await content(w, 'fr');
  const [airbus] = fr.components[0].items;
  assert.equal(plain(airbus.subtitle), '194,78 € · Fermé');
  assert.equal(plain(airbus.badge.text), '+2,40 %');
  assert.match(plain(airbus.description), /Clôture précédente : 190,22 €/);
  assert.match(fr.components.at(-1).text, /^Yahoo Finance, différé · 16\/10/);
});

test('more symbols than rows: the caption says how many are shown', async (t) => {
  const w = await world(t, { symbols: `${RECORDED.join(',')}, SAP.DE` });
  // SAP.DE is not recorded: unknown, 8 quotes for 8 rows.
  assert.equal((await content(w, 'en')).components[0].items.length, MAX_ITEMS);
  w.monitor.quotes.set('SAP.DE', { ...w.monitor.quotes.get('AIR.PA'), symbol: 'SAP.DE' });
  const widget = await content(w, 'en');
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.match(widget.components.at(-1).text, / · 8\/9 shown$/);
});

test('no symbol, and Yahoo never reached: a heading, no empty list', async (t) => {
  const none = await world(t, { symbols: '' });
  assert.equal((await content(none, 'de')).components[0].text, 'Kein Symbol verfolgt');
  const api = createApi();
  api.down = 503;
  const down = await world(t, { symbols: 'AIR.PA' }, { api });
  const widget = await content(down, 'es');
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.equal(widget.components[0].text, 'Esperando a Yahoo Finance…');
});

test('read_quote: the sentence and the numbers of one symbol', async (t) => {
  const w = await world(t, { symbols: 'EURUSD=X, AIR.PA', language: 'en' });
  const eurusd = await w.fake.sceneAction('read_quote', {
    device: deviceOf(w, 'EURUSD=X').external_id,
  });
  assert.deepEqual(eurusd.data.outputs, {
    text: 'EUR/USD: $1.1220 (-0.01% today)',
    price: 1.122,
    change_percent: -0.01,
    currency: 'USD',
  });
  const airbus = await w.fake.sceneAction('read_quote', {
    device: deviceOf(w, 'AIR.PA').external_id,
  });
  assert.equal(
    airbus.data.outputs.text,
    'Airbus SE: €194.78 (+2.40% at the last session, market closed)',
  );
  const other = await w.fake.sceneAction('read_quote', { device: 'ext:other:device' });
  assert.equal(other.success, false);
});

test('read_portfolio and check_now: every symbol in one text', async (t) => {
  const w = await world(t, { symbols: 'BTC-EUR, NOPE', language: 'es' });
  const { data } = await w.fake.sceneAction('read_portfolio', {});
  assert.equal(data.outputs.count, 1);
  assert.equal(plain(data.outputs.text), 'Bitcoin EUR: 72.878,16 € (-0,51 % hoy).');
  const check = await w.fake.action('check_now');
  assert.deepEqual(Object.keys(check.data.message), LANGUAGES);
  assert.match(
    check.data.message.fr,
    /lu à 05:40 ; cours différés\) Inconnus de Yahoo Finance : NOPE\./,
  );
});

test('Yahoo never reached: the scene actions fail, the configuration action says why', async (t) => {
  const api = createApi();
  api.down = 'network';
  const w = await world(t, { symbols: 'BTC-EUR' }, { api });
  assert.equal((await w.fake.sceneAction('read_portfolio', {})).success, false);
  const check = await w.fake.action('check_now');
  assert.match(check.data.message.en, /Yahoo Finance does not answer/);
});

test('every symbol unknown: the widget says which, the action says why', async (t) => {
  const w = await world(t, { symbols: 'NOPE, ZZZ1', language: 'en' });
  const widget = await content(w, 'fr');
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.equal(widget.components[0].text, 'Symboles inconnus : NOPE, ZZZ1');
  const read = await w.fake.sceneAction('read_quote', {
    device: 'ext:test-integration:symbol:NOPE',
  });
  assert.equal(read.success, false);
});
