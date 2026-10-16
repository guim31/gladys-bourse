// -----------------------------------------------------------------------------
// Yahoo Finance client: the public "chart" endpoint, one symbol per request,
// without key nor cookie. It is not an official API: an honest user agent, a
// few requests every few minutes, and a refusal (429) stops the cycle at once.
//
// `range=1d&interval=1d` asks for the smallest answer: the `meta` block holds
// everything needed (price, previous close, currency, trading period).
// -----------------------------------------------------------------------------

export const YAHOO_SITE = 'https://finance.yahoo.com';
const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
// A browser user agent is refused (429) more often than a plain one.
export const USER_AGENT = 'gladys-bourse (+https://github.com/guim31/gladys-bourse)';
const TIMEOUT_MS = 15000;

/** The symbol is not known to Yahoo (HTTP 404, or an answer without data). */
export class UnknownSymbolError extends Error {
  constructor(symbol) {
    super(`unknown symbol ${symbol}`);
    this.name = 'UnknownSymbolError';
  }
}

/** Yahoo refuses to answer for now (HTTP 429, or 401/403 asking for a cookie). */
export class RefusedError extends Error {
  constructor(status) {
    super(`Yahoo Finance refused the request: HTTP ${status}`);
    this.name = 'RefusedError';
    this.status = status;
  }
}

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const seconds = (value) => (finite(value) === null ? null : value * 1000);

/** Rounded to `decimals`, without the float noise of the JSON (194.77999877929688). */
export const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * The quote of one symbol from a chart answer, or throws UnknownSymbolError.
 * `now` (ms) decides whether the market is open.
 */
export function parseChart(body, symbol, now) {
  const meta = body?.chart?.result?.[0]?.meta;
  const price = finite(meta?.regularMarketPrice);
  if (!meta || price === null) {
    throw new UnknownSymbolError(symbol);
  }
  // priceHint is the number of decimals Yahoo shows (2 for a share, 4 for a rate).
  const decimals = Math.min(8, Math.max(2, finite(meta.priceHint) ?? 2));
  const previousClose = finite(meta.chartPreviousClose) ?? finite(meta.previousClose);
  const change = previousClose === null ? null : round(price - previousClose, decimals);
  const changePercent =
    previousClose === null || previousClose === 0
      ? null
      : round(((price - previousClose) / previousClose) * 100, 2);
  const regular = meta.currentTradingPeriod?.regular ?? {};
  const session = { start: seconds(regular.start), end: seconds(regular.end) };
  const marketTime = seconds(meta.regularMarketTime);
  // Open: within the regular session, and a trade seen since it started (a
  // holiday keeps the usual hours in currentTradingPeriod, without any trade).
  const open =
    session.start !== null &&
    session.end !== null &&
    now >= session.start &&
    now < session.end &&
    marketTime !== null &&
    marketTime >= session.start;
  return {
    symbol: String(meta.symbol ?? symbol).toUpperCase(),
    longName: typeof meta.longName === 'string' ? meta.longName.trim() : null,
    shortName: typeof meta.shortName === 'string' ? meta.shortName.trim() : null,
    currency: typeof meta.currency === 'string' && meta.currency ? meta.currency : null,
    type: typeof meta.instrumentType === 'string' ? meta.instrumentType : null,
    exchange: typeof meta.fullExchangeName === 'string' ? meta.fullExchangeName : null,
    decimals,
    price: round(price, decimals),
    previousClose: previousClose === null ? null : round(previousClose, decimals),
    change,
    changePercent,
    marketTime,
    session,
    open,
  };
}

/**
 * Reads one symbol. Throws UnknownSymbolError (404), RefusedError (429, 401,
 * 403) or an Error (network, 5xx, not JSON).
 */
export async function fetchQuote(fetchImpl, symbol, now = Date.now()) {
  const url = `${BASE_URL}${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`Yahoo Finance unreachable: ${err.cause?.code ?? err.message}`, {
      cause: err,
    });
  }
  const { status } = response;
  if (status === 404) {
    throw new UnknownSymbolError(symbol);
  }
  if (status === 429 || status === 401 || status === 403) {
    throw new RefusedError(status);
  }
  if (status !== 200) {
    throw new Error(`Yahoo Finance answered HTTP ${status}`);
  }
  let body;
  try {
    body = JSON.parse(await response.text());
  } catch {
    throw new Error('Yahoo Finance answered something else than JSON');
  }
  return parseChart(body, symbol, now);
}
