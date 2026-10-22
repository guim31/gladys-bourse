# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-22

### Security

- Rebuilt on Node.js 24.22.1, the October 2026 security release (remote code
  execution in the Brotli decoder, CVE-2026-111497; TLS hostname and DNS
  fixes).

## [1.0.0] - 2026-10-16

### Added

- One device per followed Yahoo Finance symbol (share, index, ETF, currency pair, cryptocurrency):
  price, change today in value and in percent, previous close, currency and state of the market,
  with history. Up to 20 symbols, read every 5 to 60 minutes while the market is open, every 30
  minutes while it is closed.
- Scene trigger "Stock market: price alert": price alerts typed in the configuration
  (`AIR.PA > 200; BTC-EUR < 50000`), fired once, re-armed after the price came back by 0.5 %.
- Scene trigger "Stock market: big daily move": the change of the day reaches 1, 2, 3, 5 or 10 %,
  up or down, once per level and per session.
- Scene actions "Stock market: read a price" and "Stock market: read all prices", as a sentence to
  send or read aloud.
- Dashboard widget "Stock prices": the followed symbols with their price and change, green up, red
  down.
- "Show the current prices" in the Configuration screen, which also lists the symbols Yahoo does
  not know.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-bourse/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-bourse/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-bourse/releases/tag/v1.0.0
