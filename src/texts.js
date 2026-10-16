// -----------------------------------------------------------------------------
// Texts produced by the container, in the four languages of Gladys (the
// language of the configuration for the device names and the scene texts, the
// language of the dashboard for the widget), and the number formats.
// -----------------------------------------------------------------------------

export const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

// Feature names, frozen at creation in Gladys.
export const NAMES = {
  en: {
    price: 'Price',
    change: 'Change today',
    change_percent: 'Change today (%)',
    previous_close: 'Previous close',
    currency: 'Currency',
    market: 'Market',
  },
  fr: {
    price: 'Cours',
    change: 'Variation du jour',
    change_percent: 'Variation du jour (%)',
    previous_close: 'Clôture précédente',
    currency: 'Devise',
    market: 'Marché',
  },
  de: {
    price: 'Kurs',
    change: 'Veränderung heute',
    change_percent: 'Veränderung heute (%)',
    previous_close: 'Vortagesschluss',
    currency: 'Währung',
    market: 'Markt',
  },
  es: {
    price: 'Cotización',
    change: 'Variación del día',
    change_percent: 'Variación del día (%)',
    previous_close: 'Cierre anterior',
    currency: 'Divisa',
    market: 'Mercado',
  },
};

export const MARKET = {
  en: { open: 'Open', closed: 'Closed' },
  fr: { open: 'Ouvert', closed: 'Fermé' },
  de: { open: 'Geöffnet', closed: 'Geschlossen' },
  es: { open: 'Abierto', closed: 'Cerrado' },
};

// Sentences of the actions and of the scene triggers. Functions take `p`.
export const PHRASES = {
  en: {
    quote: (p) => `${p.name}: ${p.price} (${p.percent} today)`,
    quoteClosed: (p) => `${p.name}: ${p.price} (${p.percent} at the last session, market closed)`,
    none: 'No symbol followed.',
    above: (p) => `${p.name} rose above ${p.threshold}: ${p.price}.`,
    below: (p) => `${p.name} fell below ${p.threshold}: ${p.price}.`,
    up: (p) => `${p.name} is up ${p.percent} today: ${p.price}.`,
    down: (p) => `${p.name} is down ${p.percent} today: ${p.price}.`,
  },
  fr: {
    quote: (p) => `${p.name} : ${p.price} (${p.percent} aujourd'hui)`,
    quoteClosed: (p) => `${p.name} : ${p.price} (${p.percent} à la dernière séance, marché fermé)`,
    none: 'Aucun symbole suivi.',
    above: (p) => `${p.name} est passé au-dessus de ${p.threshold} : ${p.price}.`,
    below: (p) => `${p.name} est passé sous ${p.threshold} : ${p.price}.`,
    up: (p) => `${p.name} gagne ${p.percent} aujourd'hui : ${p.price}.`,
    down: (p) => `${p.name} perd ${p.percent} aujourd'hui : ${p.price}.`,
  },
  de: {
    quote: (p) => `${p.name}: ${p.price} (${p.percent} heute)`,
    quoteClosed: (p) =>
      `${p.name}: ${p.price} (${p.percent} am letzten Handelstag, Markt geschlossen)`,
    none: 'Kein Symbol verfolgt.',
    above: (p) => `${p.name} ist über ${p.threshold} gestiegen: ${p.price}.`,
    below: (p) => `${p.name} ist unter ${p.threshold} gefallen: ${p.price}.`,
    up: (p) => `${p.name} steigt heute um ${p.percent}: ${p.price}.`,
    down: (p) => `${p.name} fällt heute um ${p.percent}: ${p.price}.`,
  },
  es: {
    quote: (p) => `${p.name}: ${p.price} (${p.percent} hoy)`,
    quoteClosed: (p) => `${p.name}: ${p.price} (${p.percent} en la última sesión, mercado cerrado)`,
    none: 'Ningún símbolo seguido.',
    above: (p) => `${p.name} ha subido por encima de ${p.threshold}: ${p.price}.`,
    below: (p) => `${p.name} ha bajado por debajo de ${p.threshold}: ${p.price}.`,
    up: (p) => `${p.name} sube un ${p.percent} hoy: ${p.price}.`,
    down: (p) => `${p.name} baja un ${p.percent} hoy: ${p.price}.`,
  },
};

// Connection status and configuration action messages, keyed by message.
export const STATUS = {
  en: {
    initFailed: 'The integration could not start: see its logs.',
    yahooDown: 'Yahoo Finance does not answer: the last prices are kept.',
    refused: 'Yahoo Finance refuses the requests for now: readings are spaced out.',
    noSymbol: 'No symbol to follow: add some in the configuration.',
    unknown: (p) => `Unknown to Yahoo Finance: ${p.values}.`,
    invalid: (p) => `Not understood in the configuration: ${p.values}.`,
    dropped: (p) => `${p.count} symbol(s) beyond the limit of 20 ignored.`,
    notFollowed: (p) => `Price alert on a symbol not followed: ${p.values}.`,
    summary: (p) => `${p.text} (read at ${p.time}; delayed prices)`,
  },
  fr: {
    initFailed: "L'intégration n'a pas pu démarrer : voir ses journaux.",
    yahooDown: 'Yahoo Finance ne répond pas : les derniers cours sont gardés.',
    refused: 'Yahoo Finance refuse les requêtes pour le moment : lectures espacées.',
    noSymbol: 'Aucun symbole à suivre : ajoutez-en dans la configuration.',
    unknown: (p) => `Inconnus de Yahoo Finance : ${p.values}.`,
    invalid: (p) => `Non compris dans la configuration : ${p.values}.`,
    dropped: (p) => `${p.count} symbole(s) au-delà de la limite de 20 ignoré(s).`,
    notFollowed: (p) => `Alerte de cours sur un symbole non suivi : ${p.values}.`,
    summary: (p) => `${p.text} (lu à ${p.time} ; cours différés)`,
  },
  de: {
    initFailed: 'Die Integration konnte nicht starten: siehe ihre Protokolle.',
    yahooDown: 'Yahoo Finance antwortet nicht: die letzten Kurse bleiben erhalten.',
    refused: 'Yahoo Finance lehnt die Anfragen derzeit ab: Abfragen werden seltener.',
    noSymbol: 'Kein Symbol zu verfolgen: füge welche in der Konfiguration hinzu.',
    unknown: (p) => `Yahoo Finance unbekannt: ${p.values}.`,
    invalid: (p) => `In der Konfiguration nicht verstanden: ${p.values}.`,
    dropped: (p) => `${p.count} Symbol(e) über dem Limit von 20 ignoriert.`,
    notFollowed: (p) => `Kursalarm für ein nicht verfolgtes Symbol: ${p.values}.`,
    summary: (p) => `${p.text} (gelesen um ${p.time}; verzögerte Kurse)`,
  },
  es: {
    initFailed: 'La integración no pudo iniciarse: consulte sus registros.',
    yahooDown: 'Yahoo Finance no responde: se conservan las últimas cotizaciones.',
    refused: 'Yahoo Finance rechaza las solicitudes por ahora: lecturas espaciadas.',
    noSymbol: 'Ningún símbolo que seguir: añada algunos en la configuración.',
    unknown: (p) => `Desconocidos para Yahoo Finance: ${p.values}.`,
    invalid: (p) => `No entendido en la configuración: ${p.values}.`,
    dropped: (p) => `${p.count} símbolo(s) por encima del límite de 20 ignorado(s).`,
    notFollowed: (p) => `Alerta de cotización sobre un símbolo no seguido: ${p.values}.`,
    summary: (p) => `${p.text} (leído a las ${p.time}; cotizaciones diferidas)`,
  },
};

export const LANGS = Object.keys(LOCALES);

/** A STATUS (or PHRASES) entry as a multi-language object. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGS.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Joins several multi-language messages, sentence after sentence. */
export function join(...messages) {
  return Object.fromEntries(
    LANGS.map((language) => [language, messages.map((message) => message[language]).join(' ')]),
  );
}

const locale = (language) => LOCALES[language] ?? LOCALES.en;

// Yahoo quotes London shares in pence ("GBp"), and a few others in a
// sub-unit: not an ISO code, shown as is after the number.
const ISO_CURRENCY = /^[A-Z]{3}$/;

/** A price with its currency: "7 934,70 €", "120,20 GBp". */
export function formatPrice(value, currency, decimals, language) {
  if (value === null || value === undefined) {
    return '–';
  }
  const digits = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  if (currency && ISO_CURRENCY.test(currency)) {
    try {
      return new Intl.NumberFormat(locale(language), {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        ...digits,
      }).format(value);
    } catch {
      // An unknown code falls back on the plain number.
    }
  }
  const number = new Intl.NumberFormat(locale(language), digits).format(value);
  return currency ? `${number} ${currency}` : number;
}

/** A signed percentage: "+0,78 %", "−1.20%". */
export function formatPercent(value, language) {
  if (value === null || value === undefined) {
    return '–';
  }
  return new Intl.NumberFormat(locale(language), {
    style: 'percent',
    signDisplay: 'exceptZero',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

/** Date and time in the time zone of Gladys (TZ): "15/10 17:38". */
export function formatDate(ms, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

/** Time only, in the time zone of Gladys: "17:38". */
export function formatTime(ms, language) {
  return new Intl.DateTimeFormat(locale(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

/** One quote in words, for a message or a voice. */
export function describeQuote(quote, language) {
  const phrases = PHRASES[language] ?? PHRASES.en;
  const params = {
    name: quote.displayName,
    price: formatPrice(quote.price, quote.currency, quote.decimals, language),
    percent: formatPercent(quote.changePercent, language),
  };
  return quote.open ? phrases.quote(params) : phrases.quoteClosed(params);
}

/** Every followed quote, in one text: "CAC 40: … . EUR/USD: … ." */
export function describePortfolio(quotes, language) {
  if (quotes.length === 0) {
    return (PHRASES[language] ?? PHRASES.en).none;
  }
  return quotes.map((quote) => `${describeQuote(quote, language)}.`).join(' ');
}
