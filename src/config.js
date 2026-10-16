// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Minutes between two readings while a market is open. The chart endpoint of
// Yahoo is public but unofficial: faster would only invite a refusal.
export const REFRESH_INTERVALS = ['5', '10', '15', '30', '60'];

// Levels of the "daily move" trigger, in percent. A select of the trigger: the
// scene filter only compares values, so each level crossed is its own event.
export const MOVE_LEVELS = ['1', '2', '3', '5', '10'];

// One device per symbol; more would be a portfolio tracker, not a home sensor,
// and as many requests to Yahoo at every cycle.
export const MAX_SYMBOLS = 20;

export const DEFAULT_CONFIG = {
  symbols: '^FCHI, EURUSD=X, BTC-EUR',
  price_alerts: '',
  refresh_interval: '10',
  language: 'fr',
};

const tokens = (text) =>
  String(text ?? '')
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);

// What Yahoo accepts in a symbol: letters, digits and . - ^ = (index, currency).
const SYMBOL = /^\^?[A-Z0-9][A-Z0-9.\-=]{0,19}$/;

/** A symbol typed by the user, uppercased; null if it cannot be a Yahoo symbol. */
export function parseSymbol(text) {
  const symbol = String(text ?? '')
    .trim()
    .toUpperCase();
  return SYMBOL.test(symbol) ? symbol : null;
}

/** The followed symbols of a free text; `invalid` lists the rest, `dropped` the excess. */
export function parseSymbols(text) {
  const symbols = [];
  const invalid = [];
  let dropped = 0;
  for (const token of tokens(text)) {
    const symbol = parseSymbol(token);
    if (symbol === null) {
      invalid.push(token);
    } else if (symbols.includes(symbol)) {
      continue;
    } else if (symbols.length >= MAX_SYMBOLS) {
      dropped += 1;
    } else {
      symbols.push(symbol);
    }
  }
  return { symbols, invalid, dropped };
}

/** A price typed by the user (decimal comma accepted), null if not a positive number. */
export function parsePrice(text) {
  const value = String(text ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    return null;
  }
  const number = Number(value);
  return number > 0 && Number.isFinite(number) ? number : null;
}

/**
 * Price alerts, one per line or separated by `;`: `AIR.PA > 200`, `BTC-EUR < 50000`.
 * `invalid` lists the entries that are not of this form.
 */
export function parseAlerts(text) {
  const alerts = [];
  const invalid = [];
  const entries = String(text ?? '')
    .split(/[;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const match = /^(\S+)\s*([<>])=?\s*(.+)$/.exec(entry);
    const symbol = match ? parseSymbol(match[1]) : null;
    const threshold = match ? parsePrice(match[3]) : null;
    if (symbol === null || threshold === null) {
      invalid.push(entry);
      continue;
    }
    const direction = match[2] === '>' ? 'above' : 'below';
    const key = `${symbol}|${direction}|${threshold}`;
    if (!alerts.some((alert) => alert.key === key)) {
      alerts.push({ key, symbol, direction, threshold });
    }
  }
  return { alerts, invalid };
}

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  // An unset field keeps the default list; a field emptied by the user follows nothing.
  const symbols = parseSymbols(source.symbols ?? DEFAULT_CONFIG.symbols);
  const alerts = parseAlerts(source.price_alerts);
  return {
    symbols: symbols.symbols,
    invalidSymbols: symbols.invalid,
    droppedSymbols: symbols.dropped,
    alerts: alerts.alerts,
    invalidAlerts: alerts.invalid,
    refreshMinutes: pick(
      source.refresh_interval,
      REFRESH_INTERVALS,
      DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
