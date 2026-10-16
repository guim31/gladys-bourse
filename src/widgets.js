// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `quotes`.
//
// The followed symbols as a `card-list` (8 rows at most, the core's cap), in
// the order of the configuration: the instrument as title, the price and the
// state of the market as subtitle, the change of the day as a badge, green up,
// red down. Tapping a row opens the core's detail panel: symbol, previous
// close, change, market and time of the price, and a link to Yahoo Finance.
// The footer cites the source and says the prices are delayed.
// Budget: 2 texts, 1 card-list.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from './monitor.js';
import { MARKET, formatDate, formatPercent, formatPrice } from './texts.js';
import { YAHOO_SITE } from './yahoo.js';

export const MAX_ITEMS = 8;
export const TTL_SECONDS = 300;

export const TEXT = {
  waiting: {
    en: 'Waiting for Yahoo Finance…',
    fr: 'En attente de Yahoo Finance…',
    de: 'Warte auf Yahoo Finance…',
    es: 'Esperando a Yahoo Finance…',
  },
  none: {
    en: 'No symbol followed',
    fr: 'Aucun symbole suivi',
    de: 'Kein Symbol verfolgt',
    es: 'Ningún símbolo seguido',
  },
  unknown: {
    en: 'Unknown symbols:',
    fr: 'Symboles inconnus :',
    de: 'Unbekannte Symbole:',
    es: 'Símbolos desconocidos:',
  },
  shown: { en: 'shown', fr: 'affichés', de: 'angezeigt', es: 'mostrados' },
  source: {
    en: 'Yahoo Finance, delayed',
    fr: 'Yahoo Finance, différé',
    de: 'Yahoo Finance, verzögert',
    es: 'Yahoo Finance, diferido',
  },
  previous: {
    en: 'Previous close',
    fr: 'Clôture précédente',
    de: 'Vortagesschluss',
    es: 'Cierre anterior',
  },
  change: { en: 'Change', fr: 'Variation', de: 'Veränderung', es: 'Variación' },
  priceAt: { en: 'Price at', fr: 'Cours à', de: 'Kurs um', es: 'Cotización a' },
  link: {
    en: 'On Yahoo Finance',
    fr: 'Sur Yahoo Finance',
    de: 'Auf Yahoo Finance',
    es: 'En Yahoo Finance',
  },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** The colour of a change: green up, red down, neutral flat or unknown. */
export function changeColor(percent) {
  if (!percent) {
    return WIDGET_COLORS.NEUTRAL;
  }
  return percent > 0 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.DANGER;
}

/** One row of the list, and its detail panel. */
export function itemOf(quote, language) {
  const price = formatPrice(quote.price, quote.currency, quote.decimals, language);
  const market = MARKET[language][quote.open ? 'open' : 'closed'];
  const change = [
    formatPrice(quote.change, quote.currency, quote.decimals, language),
    formatPercent(quote.changePercent, language),
  ].join(' · ');
  // Only French puts a space before the colon.
  const colon = language === 'fr' ? ' : ' : ': ';
  const description = [
    quote.symbol + (quote.exchange ? ` · ${quote.exchange}` : ''),
    `${t(TEXT.previous, language)}${colon}${formatPrice(quote.previousClose, quote.currency, quote.decimals, language)}`,
    `${t(TEXT.change, language)}${colon}${change}`,
    quote.marketTime === null
      ? null
      : `${t(TEXT.priceAt, language)} ${formatDate(quote.marketTime, language)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return {
    title: clip(quote.displayName, 60),
    subtitle: clip(`${price} · ${market}`, 60),
    badge: {
      text: formatPercent(quote.changePercent, language),
      color: changeColor(quote.changePercent),
    },
    description,
    links: [
      {
        url: `${YAHOO_SITE}/quote/${encodeURIComponent(quote.symbol)}`,
        label: t(TEXT.link, language),
      },
    ],
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { language = 'en' } = {}) {
      const lang = MARKET[language] ? language : 'en';
      const quotes = monitor.list();
      const components = [];
      if (quotes.length === 0) {
        const unknown = monitor.config.symbols.filter((symbol) => monitor.unknown.has(symbol));
        const text =
          monitor.config.symbols.length === 0
            ? t(TEXT.none, lang)
            : unknown.length === monitor.config.symbols.length
              ? clip(`${t(TEXT.unknown, lang)} ${unknown.join(', ')}`, 100)
              : t(TEXT.waiting, lang);
        components.push({ type: 'text', variant: 'heading', text });
      } else {
        components.push({
          type: 'card-list',
          display: 'list',
          items: quotes.slice(0, MAX_ITEMS).map((quote) => itemOf(quote, lang)),
        });
      }
      const shown =
        quotes.length > MAX_ITEMS ? ` · ${MAX_ITEMS}/${quotes.length} ${t(TEXT.shown, lang)}` : '';
      const updated = monitor.lastSuccessAt;
      components.push({
        type: 'text',
        variant: 'caption',
        text: `${t(TEXT.source, lang)}${updated === null ? '' : ` · ${formatDate(updated, lang)}`}${shown}`,
      });
      return { ttl_seconds: TTL_SECONDS, components };
    },
  },
};
