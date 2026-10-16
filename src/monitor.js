// -----------------------------------------------------------------------------
// The monitor: reads the followed symbols from Yahoo Finance, publishes the
// devices and their states, fires the scene triggers and serves the widget and
// the actions.
//
// Cadence: one cycle every `refresh_interval` minutes, one request per symbol,
// spaced out. A symbol whose market is closed is read again every 30 minutes
// at most (its price does not move), an unknown symbol every 6 hours. A
// refusal of Yahoo (429) stops the cycle and spaces the next ones out, up to
// one hour.
//
// Triggers:
//   - price_threshold: a price alert of the configuration (`AIR.PA > 200`) is
//     crossed. Fired once, then re-armed when the price comes back past the
//     threshold by REARM_RATIO, so a price hovering around it fires nothing
//     more. An alert already crossed when it is first seen fires nothing.
//   - daily_move: the change of the day reaches 1, 2, 3, 5 or 10 % (up or
//     down), one event per level and per session. A reading made before the
//     first trade of a session (yesterday's change) is not a move of the day.
// What was fired is kept under /data: a restart fires nothing twice.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { MOVE_LEVELS } from './config.js';
import { buildDevice, deviceIds, instrumentName } from './device.js';
import { MARKET, PHRASES, STATUS, formatPercent, formatPrice, join, render } from './texts.js';
import { RefusedError, UnknownSymbolError, fetchQuote } from './yahoo.js';

const logger = createLogger({ name: 'bourse' });

export const WIDGET_KEY = 'quotes';
export const TRIGGERS = { THRESHOLD: 'price_threshold', MOVE: 'daily_move' };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const DEFAULT_TIMINGS = {
  heartbeatMs: 12 * HOUR,
  // A closed market is read again this often (the price does not move, but
  // the next session must be seen opening).
  closedMs: 30 * MINUTE,
  unknownMs: 6 * HOUR,
  // After a refusal of Yahoo, the wait doubles at each new refusal, up to this.
  maxBackoffMs: HOUR,
  // Between two requests of one cycle.
  spacingMs: 500,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
};

// Price back past the threshold by 0.5 % re-arms an alert.
export const REARM_RATIO = 0.005;
// Scene events fired by one cycle at most: the core takes 300 a minute.
export const MAX_EVENTS_PER_CYCLE = 20;
// Slack on the "is it due" checks, so a timer firing a little early still reads.
const SLACK_MS = MINUTE;

const LEVELS = MOVE_LEVELS.map(Number);

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] fetch
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.fetch = fetchImpl ?? ((...args) => fetch(...args));
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // symbol -> last quote read (with displayName and readAt)
    this.quotes = new Map();
    // symbol -> time Yahoo said it does not know it
    this.unknown = new Map();
    this.lastSuccessAt = null;
    this.lastCycleAt = -Infinity;
    this.refusals = 0;
    this.refusedUntil = -Infinity;
    this.discovered = null;
    this.statusMessage = undefined;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.signature = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1) {
      this.data = { ...emptyData(), ...saved };
    }
    this.warnAboutConfig();
    logger.info(
      `Started: ${config.symbols.length} symbol(s) read every ${config.refreshMinutes} min`,
    );
    this.schedule();
    this.runCycle();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    this.discovered = null;
    await this.publishDiscovered();
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates();
    this.requestRefresh();
  }

  async reconfigure(config) {
    await this.running;
    this.config = config;
    // A symbol given again is tried again at once.
    this.unknown.clear();
    for (const key of [...this.failing].filter((k) => k.startsWith('unknown:'))) {
      this.failing.delete(key);
    }
    for (const symbol of this.quotes.keys()) {
      if (!config.symbols.includes(symbol)) {
        this.quotes.delete(symbol);
      }
    }
    logger.info('Configuration saved');
    this.warnAboutConfig();
    // The language may have changed: the names of the next devices with it.
    this.discovered = null;
    this.schedule();
    await this.runCycle();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  warnAboutConfig() {
    const { symbols, invalidSymbols, droppedSymbols, invalidAlerts } = this.config;
    if (symbols.length === 0) {
      logger.warn('No symbol to follow');
    }
    if (invalidSymbols.length > 0) {
      logger.warn(`Not a symbol, ignored: ${invalidSymbols.join(', ')}`);
    }
    if (droppedSymbols > 0) {
      logger.warn(`${droppedSymbols} symbol(s) beyond the limit ignored`);
    }
    if (invalidAlerts.length > 0) {
      logger.warn(`Price alert not understood, ignored: ${invalidAlerts.join(' ; ')}`);
    }
    const orphans = this.orphanAlerts();
    if (orphans.length > 0) {
      logger.warn(`Price alert on a symbol not followed: ${orphans.join(', ')}`);
    }
  }

  orphanAlerts() {
    const { alerts, symbols } = this.config;
    return [...new Set(alerts.map((a) => a.symbol).filter((s) => !symbols.includes(s)))];
  }

  // --- Quotes ------------------------------------------------------------------

  /** The quotes read so far, in the order of the configuration. */
  list() {
    return this.config.symbols.map((symbol) => this.quotes.get(symbol)).filter(Boolean);
  }

  /** The symbol of a device external id, or null. */
  symbolOf(externalId) {
    return (
      this.config.symbols.find((symbol) => deviceIds(this.gladys, symbol).device === externalId) ??
      null
    );
  }

  isCreated(symbol) {
    const id = deviceIds(this.gladys, symbol).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** Whether a symbol is to be read in this cycle. */
  due(symbol, now) {
    if (this.unknown.has(symbol)) {
      return now - this.unknown.get(symbol) >= this.timings.unknownMs - SLACK_MS;
    }
    const quote = this.quotes.get(symbol);
    if (!quote || quote.open) {
      return true;
    }
    const { start, end } = quote.session;
    if (start !== null && start <= now && (quote.readAt < start || end === null || now < end)) {
      // Within the session hours (no trade yet at the opening, or a holiday),
      // or a session started since the last reading.
      return true;
    }
    const every = Math.max(this.timings.closedMs, this.config.refreshMinutes * MINUTE);
    return now - quote.readAt >= every - SLACK_MS;
  }

  // --- Cycles ------------------------------------------------------------------

  runCycle() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle()
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async cycle() {
    const now = this.now();
    this.lastCycleAt = now;
    if (now < this.refusedUntil) {
      logger.debug('Yahoo Finance refused the last requests: this cycle is skipped');
      return;
    }
    const events = [];
    let read = 0;
    let ok = true;
    for (const symbol of this.config.symbols) {
      if (this.stopped || !this.due(symbol, now)) {
        continue;
      }
      if (read > 0 && this.timers) {
        await sleep(this.timings.spacingMs);
      }
      read += 1;
      try {
        const quote = await fetchQuote(this.fetch, symbol, this.now());
        this.accept(symbol, quote, events);
      } catch (err) {
        if (err instanceof UnknownSymbolError) {
          this.unknown.set(symbol, now);
          this.quotes.delete(symbol);
          this.failed(`unknown:${symbol}`, 'warn', `Yahoo Finance does not know ${symbol}`);
          continue;
        }
        ok = false;
        if (err instanceof RefusedError) {
          this.refusals += 1;
          const wait = Math.min(
            this.timings.maxBackoffMs,
            this.config.refreshMinutes * MINUTE * 2 ** this.refusals,
          );
          this.refusedUntil = now + wait;
          this.failed('yahoo', 'warn', `${err.message}: next try in ${wait / MINUTE} min`);
        } else {
          this.failed('yahoo', 'warn', err.message);
        }
        break; // the next symbols would meet the same answer
      }
    }
    if (ok && read > 0) {
      this.refusals = 0;
      this.lastSuccessAt = this.now();
      this.recovered('yahoo', 'Yahoo Finance answers again');
    }
    logger.debug(`Refresh cycle: ${read} symbol(s) read, ${events.length} scene event(s)`);
    this.recovered('cycle', 'Refresh cycles work again');
    this.store.save(this.data);
    await this.publishDiscovered();
    await this.publishStates();
    await this.fireAll(events);
    await this.updateConnectionStatus();
    const signature = this.list()
      .map((q) => `${q.symbol}:${q.price}:${q.changePercent}:${q.open}`)
      .join(',');
    if (signature !== this.signature) {
      this.signature = signature;
      this.requestRefresh();
    }
  }

  /** A new quote: kept, and the triggers it crosses collected in `events`. */
  accept(symbol, quote, events) {
    if (this.unknown.delete(symbol)) {
      this.recovered(`unknown:${symbol}`, `Yahoo Finance knows ${symbol} again`);
    }
    // The key stays the symbol typed by the user (Yahoo may answer in another case).
    const kept = { ...quote, symbol, displayName: instrumentName(quote), readAt: this.now() };
    this.quotes.set(symbol, kept);
    this.checkAlerts(kept, events);
    this.checkMove(kept, events);
  }

  checkAlerts(quote, events) {
    const states = this.data.alerts;
    for (const alert of this.config.alerts) {
      if (alert.symbol !== quote.symbol) {
        continue;
      }
      const { threshold, direction, key } = alert;
      const above = direction === 'above';
      const beyond = above ? quote.price >= threshold : quote.price <= threshold;
      const back = above
        ? quote.price < threshold * (1 - REARM_RATIO)
        : quote.price > threshold * (1 + REARM_RATIO);
      const state = states[key];
      if (state === undefined) {
        // First seen: already crossed is the starting point, not news.
        states[key] = beyond ? 'fired' : 'armed';
      } else if (state === 'armed' && beyond) {
        states[key] = 'fired';
        events.push({ key: TRIGGERS.THRESHOLD, quote, direction, threshold });
      } else if (state === 'fired' && back) {
        states[key] = 'armed';
      }
    }
    // Alerts removed from the configuration are forgotten.
    const keys = new Set(this.config.alerts.map((alert) => alert.key));
    for (const key of Object.keys(states)) {
      if (!keys.has(key)) {
        delete states[key];
      }
    }
  }

  checkMove(quote, events) {
    const { changePercent, session, marketTime } = quote;
    // Before the first trade of a session, the change is yesterday's.
    if (changePercent === null || session.start === null || marketTime < session.start) {
      return;
    }
    const reached = (sign) =>
      Math.max(0, ...LEVELS.filter((level) => sign * changePercent >= level));
    const moves = this.data.moves;
    const record = moves[quote.symbol];
    if (!record) {
      // First reading of this symbol: the change already there is not news.
      moves[quote.symbol] = { day: session.start, up: reached(1), down: reached(-1) };
      return;
    }
    if (record.day !== session.start) {
      Object.assign(record, { day: session.start, up: 0, down: 0 });
    }
    for (const [direction, sign] of [
      ['up', 1],
      ['down', -1],
    ]) {
      for (const level of LEVELS) {
        if (sign * changePercent >= level && level > record[direction]) {
          events.push({ key: TRIGGERS.MOVE, quote, direction, threshold: level });
        }
      }
      record[direction] = Math.max(record[direction], reached(sign));
    }
    for (const symbol of Object.keys(moves)) {
      if (!this.config.symbols.includes(symbol)) {
        delete moves[symbol];
      }
    }
  }

  // --- Scene events ------------------------------------------------------------

  async fireAll(events) {
    for (const [index, event] of events.entries()) {
      if (index >= MAX_EVENTS_PER_CYCLE) {
        logger.debug(`${events.length - index} more scene event(s) not sent`);
        break;
      }
      await this.fire(event);
    }
  }

  async fire({ key, quote, direction, threshold }) {
    const data = this.eventData(key, quote, direction, threshold);
    const line =
      key === TRIGGERS.THRESHOLD
        ? `Price alert: ${quote.symbol} ${direction} ${threshold} (${quote.price})`
        : `Daily move: ${quote.symbol} ${direction} ${threshold} % (${quote.changePercent} %)`;
    // A price alert is set by the user and rare; daily moves can be many.
    if (key === TRIGGERS.THRESHOLD) {
      logger.info(line);
    } else {
      logger.debug(line);
    }
    try {
      await this.gladys.publishSceneEvent(key, data);
      this.recovered('scene', 'Scene triggers work again');
    } catch (err) {
      this.failed('scene', 'warn', `Firing the scene trigger failed: ${err.message}`);
    }
  }

  /** The flat data of a scene event (fields, then variables of the manifest). */
  eventData(key, quote, direction, threshold) {
    const language = this.config.language;
    const phrases = PHRASES[language];
    const params = {
      name: quote.displayName,
      price: formatPrice(quote.price, quote.currency, quote.decimals, language),
      threshold: formatPrice(threshold, quote.currency, quote.decimals, language),
      percent: formatPercent(Math.abs(quote.changePercent ?? 0), language).replace(/^\+/, ''),
    };
    const data = {
      device: deviceIds(this.gladys, quote.symbol).device,
      direction,
      symbol: quote.symbol,
      name: quote.displayName,
      price: quote.price,
      currency: quote.currency,
      threshold,
      text: phrases[direction](params),
    };
    if (key === TRIGGERS.MOVE) {
      data.change_percent = quote.changePercent;
    }
    return data;
  }

  // --- Devices and states --------------------------------------------------------

  async publishDiscovered() {
    if (!this.config) {
      return;
    }
    const devices = this.list().map((quote) =>
      buildDevice(this.gladys, quote, this.config.language),
    );
    const signature = JSON.stringify(devices);
    if (signature === this.discovered) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.discovered = signature;
      this.recovered('discovery', 'Publishing the devices works again');
    } catch (err) {
      this.failed('discovery', 'warn', `Publishing the devices failed: ${err.message}`);
    }
  }

  statesOf(quote) {
    const ids = deviceIds(this.gladys, quote.symbol);
    const states = [];
    const number = (key, value) => {
      if (value !== null) {
        states.push({ device_feature_external_id: ids[key], state: value });
      }
    };
    number('price', quote.price);
    number('change', quote.change);
    number('change_percent', quote.changePercent);
    number('previous_close', quote.previousClose);
    if (quote.currency) {
      states.push({ device_feature_external_id: ids.currency, text: quote.currency });
    }
    const market = MARKET[this.config.language] ?? MARKET.fr;
    states.push({
      device_feature_external_id: ids.market,
      text: quote.open ? market.open : market.closed,
    });
    return states;
  }

  async publishStates() {
    const states = this.list()
      .filter((quote) => this.isCreated(quote.symbol))
      .flatMap((quote) => this.statesOf(quote));
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  async updateConnectionStatus() {
    const { symbols, invalidSymbols, invalidAlerts, droppedSymbols } = this.config;
    const parts = [];
    if (this.failing.has('yahoo')) {
      parts.push(render(STATUS, this.now() < this.refusedUntil ? 'refused' : 'yahooDown'));
    }
    if (symbols.length === 0) {
      parts.push(render(STATUS, 'noSymbol'));
    }
    const unknown = symbols.filter((symbol) => this.unknown.has(symbol));
    if (unknown.length > 0) {
      parts.push(render(STATUS, 'unknown', { values: unknown.join(', ') }));
    }
    const invalid = [...invalidSymbols, ...invalidAlerts];
    if (invalid.length > 0) {
      parts.push(render(STATUS, 'invalid', { values: invalid.join(' ; ') }));
    }
    if (droppedSymbols > 0) {
      parts.push(render(STATUS, 'dropped', { count: droppedSymbols }));
    }
    const orphans = this.orphanAlerts();
    if (orphans.length > 0) {
      parts.push(render(STATUS, 'notFollowed', { values: orphans.join(', ') }));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = !this.failing.has('yahoo') && this.lastSuccessAt !== null;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  async onDeviceCreated(device) {
    if (this.symbolOf(device?.external_id) === null) {
      return;
    }
    // The SDK forgot the states of the device: everything is published again.
    await this.publishStates();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    if (this.symbolOf(device?.external_id) === null) {
      return;
    }
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates();
    }
  }

  /** The quotes, read again if the last cycle is older than one interval. */
  async fresh() {
    if (this.now() - this.lastCycleAt >= this.config.refreshMinutes * MINUTE) {
      await this.runCycle();
    } else {
      await this.running;
    }
    return this.list();
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }
}

function emptyData() {
  return { version: 1, alerts: {}, moves: {} };
}

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });
