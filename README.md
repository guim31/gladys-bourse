# Yahoo Finance for Gladys Assistant

Stock market prices in [Gladys Assistant](https://gladysassistant.com): shares, indices (CAC 40,
S&P 500…), ETFs, currency pairs (EUR/USD…) and cryptocurrencies (BTC-EUR…), read from the public
pages of [Yahoo Finance](https://finance.yahoo.com). No account, no API key.

Prices are delayed (often by 15 minutes) and indicative: for keeping an eye on the markets from
home, not for trading. Not affiliated with Yahoo.

## Features

- **One device per symbol**, named after the instrument: price, change today (value and percent),
  previous close, currency, market open or closed; with history.
- **Scene triggers**: a price alert crossed (`AIR.PA > 200`, fired once, re-armed after the price
  came back), and a big daily move (1, 2, 3, 5 or 10 %, up or down, once per level and session);
  filtered by symbol and direction, with a ready-made sentence as variable.
- **Scene actions**: read one price, or every followed price, as a sentence to send by message or
  have read aloud.
- **Dashboard widget**: the followed symbols with their price and change, green up, red down.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1 or later.
- Internet access from the Gladys host (`query1.finance.yahoo.com`).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-bourse` (or install it from the catalog once it is listed).
2. In **Configuration**, list the symbols to follow (as shown by finance.yahoo.com, e.g.
   `^FCHI, AIR.PA, EURUSD=X, BTC-EUR`), optionally price alerts, then save. **Show the current
   prices** checks them.
3. Open the **Discover** tab and add the devices you want.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

```
Integration container ──HTTPS──▶ query1.finance.yahoo.com   /v8/finance/chart/<symbol>
      │ SDK (WebSocket + host API)
      ▼
Gladys core ── devices, states, scene events, scene actions, widget
```

- One request per symbol (`range=1d&interval=1d`, the smallest answer), spaced out, with a plain
  user agent: every 5 to 60 minutes while the market is open, every 30 minutes while it is closed,
  every 6 hours for a symbol Yahoo does not know. A refusal (HTTP 429) stops the cycle and doubles
  the wait, up to one hour. The devices are published with `should_poll: false`: the container
  reads by itself (GladysAssistant/Gladys#3198).
- The change is computed from the previous close Yahoo gives (`chartPreviousClose`); for a
  cryptocurrency, the price at 00:00 UTC.
- The state of the price alerts and the daily moves already announced are kept under `/data`, so
  a restart fires nothing twice.

## Limitations

- The "chart" endpoint is public but unofficial: Yahoo may change or refuse it without notice. If
  it stops working for good, the European Central Bank reference rates (open data, no key) are
  the documented fallback for currencies.
- Delayed and indicative prices, no history imported, no portfolio quantities, 20 symbols at
  most.
- Developed and tested against the real Yahoo Finance service and the SDK's fake Gladys; not yet
  on a real Gladys instance: feedback welcome.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake Yahoo serving real answers recorded on
16/10/2026 (`test/fixtures/yahoo/`, reduced to the fields used): never the network.

## Credits

- Data: [Yahoo Finance](https://finance.yahoo.com), under its
  [terms of service](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html).
- The Home Assistant community integration
  [yahoofinance](https://github.com/iprak/yahoofinance) by iprak showed what users expect from such
  an integration; no code is copied from it.
- [Bitcoin Monitor](https://github.com/Checconio/gladys-bitcoin-monitor) by Checconio covers
  Bitcoin in depth (fees, mempool, price) for Gladys; this integration follows any symbol, Bitcoin
  price included, without the network data.
- Built on the [Gladys integration SDK](https://github.com/GladysAssistant/integration-sdk-js) and
  the official JavaScript template.

## License

[Apache 2.0](LICENSE).
