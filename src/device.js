// -----------------------------------------------------------------------------
// One Gladys device per followed symbol (a share, an index, a fund, a currency
// pair, a cryptocurrency), named after the instrument.
//
// Features (couples checked against the Gladys front, see
// test/gladys-rules.test.js):
//   - price           currency/decimal, unit euro, dollar or pound-sterling
//                     when the currency is EUR, USD or GBP (no unit otherwise:
//                     the currency feature says which);
//   - change          currency/decimal: price minus the previous close;
//   - change_percent  currency/decimal, unit percent: the same, in percent;
//   - previous_close  currency/decimal: the reference of the change;
//   - currency        text/text: the currency code given by Yahoo (EUR, GBp…);
//   - market          text/text: open or closed, in words.
//
// The platform id is the symbol, escaped so it holds no character Gladys or a
// URL could mind (^FCHI -> _5EFCHI). Published with should_poll: false: the
// readings run in the container (src/monitor.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './texts.js';

export const DEVICE_TYPE = 'symbol';
export const FEATURE_KEYS = [
  'price',
  'change',
  'change_percent',
  'previous_close',
  'currency',
  'market',
];

// Display bounds only (the core never applies them): wide enough for a
// bitcoin in yen or a rate in Indonesian rupiah.
const MAX_PRICE = 1e12;

const CURRENCY_UNITS = { EUR: UNITS.EURO, USD: UNITS.DOLLAR, GBP: UNITS.POUND_STERLING };

/** The unit of a price in this currency, or undefined. */
export const unitOf = (currency) => CURRENCY_UNITS[currency];

/** The platform id of a symbol: letters, digits, dot and dash kept, the rest escaped. */
export const platformIdOf = (symbol) =>
  symbol.replace(
    /[^A-Z0-9.-]/g,
    (char) => `_${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  );

/** External ids of the device of a symbol and of its features. */
export function deviceIds(gladys, symbol) {
  const ids = gladys.externalIds(DEVICE_TYPE, platformIdOf(symbol));
  return {
    device: ids.device,
    ...Object.fromEntries(FEATURE_KEYS.map((key) => [key, ids.feature(key)])),
  };
}

/** The name of the instrument, short enough for a dashboard. */
export function instrumentName(quote) {
  const long = quote.longName;
  if (long && long.length <= 40) {
    return long;
  }
  return quote.shortName || long || quote.symbol;
}

/** The device name: "CAC 40 (^FCHI)", or the symbol alone when it is the name. */
export function deviceName(quote) {
  const name = instrumentName(quote);
  return name.toUpperCase() === quote.symbol ? quote.symbol : `${name} (${quote.symbol})`;
}

const feature = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

/** The discovery payload of the device of a quote. */
export function buildDevice(gladys, quote, language = 'fr') {
  const ids = deviceIds(gladys, quote.symbol);
  const names = NAMES[language] ?? NAMES.fr;
  const unit = unitOf(quote.currency);
  const money = (key, min, extra = {}) =>
    feature(names[key], ids[key], CATEGORIES.CURRENCY, TYPES.CURRENCY.DECIMAL, {
      keep_history: true,
      min,
      max: MAX_PRICE,
      ...(unit ? { unit } : {}),
      ...extra,
    });
  const text = (key) =>
    feature(names[key], ids[key], CATEGORIES.TEXT, TYPES.TEXT.TEXT, {
      keep_history: false,
      min: 0,
      max: 0,
    });
  return {
    name: deviceName(quote),
    external_id: ids.device,
    model: 'Yahoo Finance',
    should_poll: false,
    params: [],
    features: [
      money('price', 0),
      money('change', -MAX_PRICE),
      feature(
        names.change_percent,
        ids.change_percent,
        CATEGORIES.CURRENCY,
        TYPES.CURRENCY.DECIMAL,
        {
          unit: UNITS.PERCENT,
          keep_history: true,
          min: -100,
          max: 100000,
        },
      ),
      money('previous_close', 0),
      text('currency'),
      text('market'),
    ],
  };
}
