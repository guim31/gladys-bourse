// -----------------------------------------------------------------------------
// The scene actions `read_quote` (one symbol) and `read_portfolio` (every
// followed symbol), and the configuration action `check_now`. They read Yahoo
// again when the last cycle is older than one interval, and answer with a
// sentence a scene can send by message or read aloud.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { STATUS, describePortfolio, describeQuote, formatTime, render } from './texts.js';

const logger = createLogger({ name: 'bourse-actions' });

export const SCENE_ACTIONS = { QUOTE: 'read_quote', PORTFOLIO: 'read_portfolio' };
export const CONFIG_ACTION = 'check_now';

const UNKNOWN_DEVICE = {
  en: 'This device is not a symbol followed by the integration.',
  fr: "Cet appareil n'est pas un symbole suivi par l'intégration.",
  de: 'Dieses Gerät ist kein von der Integration verfolgtes Symbol.',
  es: 'Este dispositivo no es un símbolo seguido por la integración.',
};
export const ACTION_ERRORS = { UNKNOWN_DEVICE };

/** Scene action: one quote. Outputs `text`, `price`, `change_percent`, `currency`. */
export async function readQuote(monitor, fields = {}) {
  const language = monitor.config.language;
  const symbol = monitor.symbolOf(fields.device);
  if (symbol === null) {
    throw new Error(UNKNOWN_DEVICE[language]);
  }
  await monitor.fresh();
  const quote = monitor.quotes.get(symbol);
  if (!quote) {
    throw new Error(STATUS[language].yahooDown);
  }
  return {
    text: describeQuote(quote, language),
    price: quote.price,
    change_percent: quote.changePercent ?? 0,
    currency: quote.currency ?? '',
  };
}

/** Scene action: every followed quote. Outputs `text` and `count`. */
export async function readPortfolio(monitor) {
  const language = monitor.config.language;
  const quotes = await monitor.fresh();
  if (quotes.length === 0 && monitor.config.symbols.length > 0 && monitor.lastSuccessAt === null) {
    throw new Error(STATUS[language].yahooDown);
  }
  return { text: describePortfolio(quotes, language), count: quotes.length };
}

/** Configuration action: the quotes now, and what is wrong, in every language. */
export async function checkNow(monitor) {
  const quotes = await monitor.fresh();
  logger.info(`Check requested: ${quotes.length} quote(s) read`);
  if (quotes.length === 0 && monitor.lastSuccessAt === null) {
    return render(STATUS, monitor.config.symbols.length === 0 ? 'noSymbol' : 'yahooDown');
  }
  const unknown = monitor.config.symbols.filter((symbol) => monitor.unknown.has(symbol));
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const summary = render(STATUS, 'summary', {
        text: describePortfolio(quotes, language),
        time: formatTime(monitor.lastSuccessAt, language),
      })[language];
      const extra =
        unknown.length > 0
          ? ` ${render(STATUS, 'unknown', { values: unknown.join(', ') })[language]}`
          : '';
      return [language, `${summary}${extra}`];
    }),
  );
}
