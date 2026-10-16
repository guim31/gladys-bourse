# Yahoo Finance

Verfolge Kurse in Gladys: Aktien, Indizes (DAX, S&P 500…), ETFs, Währungspaare (EUR/USD…) und
Kryptowährungen (BTC-EUR…), gelesen von den öffentlichen Seiten von
[Yahoo Finance](https://finance.yahoo.com). Kein Konto, kein API-Schlüssel.

Die Kurse sind **verzögert** (oft um 15 Minuten, je nach Börse) und **unverbindlich**: Diese Integration
dient dazu, die Märkte von zu Hause im Blick zu behalten, nicht zum Handeln. Nicht mit Yahoo verbunden.

## Was du bekommst

- Ein **Gerät pro Symbol**, benannt nach dem Wertpapier (`DAX (^GDAXI)`): Kurs, Veränderung heute (als Wert
  und in Prozent), Vortagesschluss, Währung und Zustand des Marktes (geöffnet oder geschlossen), mit ihrem
  Verlauf.
- Ein **Dashboard-Widget** mit den verfolgten Symbolen, ihrem Kurs und ihrer Tagesveränderung, grün steigend,
  rot fallend.
- Zwei **Szenenauslöser**: ein überschrittener Kursalarm (`SAP.DE > 250`) und eine starke Tagesbewegung (1, 2,
  3, 5 oder 10 %, nach oben oder unten).
- Zwei **Szenenaktionen**: den Kurs eines Symbols oder aller verfolgten Symbole als Satz lesen, zum Senden
  per Nachricht oder zum Vorlesen.

## Voraussetzungen

- Gladys Assistant 5.1 oder neuer.
- Internetzugang vom Gladys-Rechner (die Integration liest `query1.finance.yahoo.com`).

## Konfiguration

### Einstellungen

| Einstellung              | Wirkung                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Symbole                  | Yahoo-Finance-Symbole durch Kommas getrennt, höchstens 20. Standard: `^FCHI, EURUSD=X, BTC-EUR`.                 |
| Kursalarme               | Für den Auslöser „Kursalarm“, durch Semikolons getrennt: `SAP.DE > 250; BTC-EUR < 50000` (Dezimalkomma erlaubt). |
| Aktualisierungsintervall | 5 bis 60 Minuten (Standard 10), während der Markt geöffnet ist.                                                  |
| Sprache der Texte        | Namen der Funktionen (bei ihrer Erstellung) und Texte für die Szenen. Standard: Französisch.                     |

Speichere, öffne dann den Tab **Entdecken** der Integration und lege die gewünschten Geräte an. Ein später
hinzugefügtes Symbol erscheint dort nach der nächsten Abfrage.

Die Schaltfläche **Aktuelle Kurse anzeigen** der Konfiguration liest alle Symbole auf einmal und sagt, welche
Yahoo nicht kennt.

### Ein Symbol finden

Suche den Namen auf [finance.yahoo.com](https://finance.yahoo.com): Das Symbol steht daneben. Einige
Beispiele:

| Art             | Symbole                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| Aktien          | `AIR.PA` (Airbus, Paris), `SAP.DE` (SAP, Xetra), `AAPL` (Apple, Nasdaq) |
| Indizes         | `^FCHI` (CAC 40), `^GDAXI` (DAX), `^IBEX` (IBEX 35), `^GSPC` (S&P 500)  |
| ETFs            | `CW8.PA` (Amundi MSCI World), `IWDA.AS` (iShares Core MSCI World)       |
| Währungspaare   | `EURUSD=X` (ein Euro in Dollar), `EURGBP=X`, `EURCHF=X`                 |
| Kryptowährungen | `BTC-EUR`, `ETH-EUR`, `BTC-USD`                                         |

Londoner Aktien werden in Pence notiert (`GBp`): Die Kursfunktion hat dann keine Einheit, und die
Währungsfunktion zeigt `GBp`.

## Geräte

| Funktion              | Inhalt                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Kurs                  | Letzter Kurs, in Euro, Dollar oder Pfund, wenn das die Währung ist.                                            |
| Veränderung heute     | Kurs minus Vortagesschluss.                                                                                    |
| Veränderung heute (%) | Dieselbe, in Prozent.                                                                                          |
| Vortagesschluss       | Die Referenz der Veränderung. Bei einer Kryptowährung der Kurs um 00:00 UTC.                                   |
| Währung               | Der Währungscode von Yahoo (`EUR`, `USD`, `GBp`, `JPY`…).                                                      |
| Markt                 | Geöffnet oder Geschlossen. Ein Währungspaar wird werktags rund um die Uhr gehandelt, eine Kryptowährung immer. |

Die Namen der Funktionen werden beim Anlegen des Geräts festgelegt: Ändere die Sprache, bevor du es anlegst.

## Dashboard-Widget

**Börsenkurse** listet die verfolgten Symbole (höchstens 8) in der Reihenfolge der Konfiguration: das
Wertpapier, sein Kurs und der Zustand des Marktes, und die Tagesveränderung als farbiges Abzeichen. Tippe auf
eine Zeile, um Symbol, Vortagesschluss, Veränderung und Uhrzeit des Kurses zu sehen, mit einem Link zu Yahoo
Finance.

## Szenenauslöser

**Börse: Kursalarm** — ein Kursalarm der Konfiguration wird überschritten. Filter: das Symbol (ein Gerät) und
die Richtung (steigt über, fällt unter). Er löst einmal aus, dann erst wieder, nachdem der Kurs um 0,5 % auf
die andere Seite der Schwelle zurückkam: Ein Kurs, der um die Schwelle schwankt, überflutet dein Handy nicht.
Ein Alarm, der beim Speichern schon überschritten ist, löst nichts aus, bis er erneut überschritten wird.

**Börse: starke Tagesbewegung** — die Veränderung seit dem Vortagesschluss erreicht die gewählte Stufe: 1, 2,
3, 5 oder 10 %, nach oben oder unten. Einmal pro Stufe und Handelstag. Filter: das Symbol, die Richtung und
die Stufe.

Beide geben an die Aktionen weiter: das Symbol, den Namen des Wertpapiers, den Kurs, die Währung, die Schwelle
oder Stufe, die Richtung und einen fertigen Satz. Was schon ausgelöst wurde, bleibt gespeichert: Ein Neustart
löst nichts doppelt aus.

## Szenenaktionen

**Börse: einen Kurs lesen** — wähle ein Symbol; die Aktion liefert einen Satz („DAX: 24.100,50 € (+0,78 %
heute)“), den Kurs, die Veränderung in Prozent und die Währung.

**Börse: alle Kurse lesen** — alle verfolgten Symbole in einem Text, und ihre Anzahl.

Beide fragen Yahoo erneut ab, wenn die letzte Abfrage älter als das Aktualisierungsintervall ist.

## Szenenbeispiele

- **Morgenübersicht**: werktags um 9:30 _alle Kurse lesen_ und den Text per Telegram senden.
- **Ziel erreicht**: mit dem Alarm `SAP.DE > 250`, bei _Kursalarm_ für SAP „{{text}}“ an dein Handy senden.
- **Krypto-Sturm**: bei _starke Tagesbewegung_ für BTC-EUR, nach unten, 10 %, die Wohnzimmerlampe rot blinken
  lassen.

## Datenquelle, Bedingungen und Nutzungsgrenzen

Die Integration liest den öffentlichen „chart“-Endpunkt von Yahoo Finance, eine Anfrage pro Symbol, mit
Abstand:

- während ein Markt geöffnet ist, in jedem Aktualisierungsintervall;
- während er geschlossen ist, alle 30 Minuten (sein Kurs bewegt sich nicht);
- ein unbekanntes Symbol alle 6 Stunden.

Dieser Zugang ist **inoffiziell**: Yahoo veröffentlicht dafür keine API und kann ihn jederzeit ändern oder
sperren. Lehnt Yahoo die Anfragen ab (HTTP 429), wartet die Integration zwei Intervalle, dann bei jeder neuen
Ablehnung länger, bis zu einer Stunde. Die Daten sind für den persönlichen Gebrauch, gemäß den
[Nutzungsbedingungen von Yahoo](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html): Kurse verzögert
und unverbindlich, nicht zum Handeln.

## Fehlerbehebung

- **Kein Gerät im Tab „Entdecken“**: Prüfe die Symbole und nutze dann **Aktuelle Kurse anzeigen**: Es listet
  die, die Yahoo nicht kennt. Der Status der Integration sagt es auch.
- **„Yahoo Finance lehnt die Anfragen derzeit ab“**: Warte, die Abfragen laufen von selbst wieder an.
  Verringere die Zahl der Symbole oder verlängere das Intervall, wenn es oft vorkommt.
- **Der Markt bleibt während der Handelszeit „Geschlossen“**: Die Börse hat vielleicht Feiertag, oder das
  Wertpapier wurde heute noch nicht gehandelt.
- **Ein Kursalarm löst nicht aus**: Das Symbol muss auch in der Liste der Symbole stehen, und der Alarm muss
  nach dem Speichern überschritten werden.
- Protokolle: `LOG_LEVEL=debug` zeigt jede Abfrage.

## Grenzen

- Verzögerte und unverbindliche Kurse; kein Verlauf importiert (der Verlauf beginnt mit dem Anlegen des
  Geräts).
- Ein Kurs pro Symbol: weder Stückzahlen noch Depotwert.
- Höchstens 20 Symbole.
- Die Veränderung einer Kryptowährung zählt ab 00:00 UTC, nicht über 24 Stunden.
- Am ersten Tag eines Symbols löst eine Bewegung, die bei der ersten Abfrage des Handelstags schon da ist,
  nichts aus.
- Inoffizieller Zugang zu Yahoo: Er kann ohne Vorwarnung aufhören zu funktionieren.
