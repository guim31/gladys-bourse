# Yahoo Finance

Siga cotizaciones en Gladys: acciones, índices (IBEX 35, S&P 500…), ETF, pares de divisas (EUR/USD…) y
criptomonedas (BTC-EUR…), leídas de las páginas públicas de [Yahoo Finance](https://finance.yahoo.com). Sin
cuenta, sin clave de API.

Las cotizaciones son **diferidas** (a menudo 15 minutos, según la bolsa) e **indicativas**: esta integración
sirve para vigilar los mercados desde casa, no para operar. Sin afiliación con Yahoo.

## Lo que obtiene

- Un **dispositivo por símbolo**, con el nombre del instrumento (`IBEX 35 (^IBEX)`): cotización, variación del
  día (en valor y en porcentaje), cierre anterior, divisa y estado del mercado (abierto o cerrado), con su
  historial.
- Un **widget del panel** con los símbolos seguidos, su cotización y su variación del día, verde al alza,
  rojo a la baja.
- Dos **desencadenantes de escena**: una alerta de cotización cruzada (`SAN.MC > 10`) y una fuerte variación
  del día (1, 2, 3, 5 o 10 %, al alza o a la baja).
- Dos **acciones de escena**: leer la cotización de un símbolo, o de todos los símbolos seguidos, en una frase
  para enviar por mensaje o leer en voz alta.

## Requisitos

- Gladys Assistant 5.1 o posterior.
- Acceso a Internet desde el equipo de Gladys (la integración lee `query1.finance.yahoo.com`).

## Configuración

### Ajustes

| Ajuste                     | Efecto                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Símbolos                   | Símbolos de Yahoo Finance separados por comas, 20 como máximo. Por defecto: `^FCHI, EURUSD=X, BTC-EUR`.                            |
| Alertas de cotización      | Para el desencadenante «alerta de cotización», separadas por punto y coma: `SAN.MC > 10; BTC-EUR < 50000` (coma decimal aceptada). |
| Intervalo de actualización | De 5 a 60 minutos (10 por defecto) mientras el mercado está abierto.                                                               |
| Idioma de los textos       | Nombres de las funciones (al crearlas) y textos enviados a las escenas. Francés por defecto.                                       |

Guarde, abra la pestaña **Descubrir** de la integración y cree los dispositivos que desee. Un símbolo añadido
más tarde aparece allí tras la siguiente lectura.

El botón **Mostrar las cotizaciones actuales** de la configuración lee todos los símbolos a la vez e indica
cuáles no conoce Yahoo.

### Encontrar un símbolo

Busque el nombre en [finance.yahoo.com](https://finance.yahoo.com): el símbolo aparece a su lado. Algunos
ejemplos:

| Tipo             | Símbolos                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| Acciones         | `SAN.MC` (Santander, Madrid), `AIR.PA` (Airbus, París), `AAPL` (Apple) |
| Índices          | `^IBEX` (IBEX 35), `^FCHI` (CAC 40), `^GDAXI` (DAX), `^GSPC` (S&P 500) |
| ETF              | `CW8.PA` (Amundi MSCI World), `IWDA.AS` (iShares Core MSCI World)      |
| Pares de divisas | `EURUSD=X` (un euro en dólares), `EURGBP=X`, `EURCHF=X`                |
| Criptomonedas    | `BTC-EUR`, `ETH-EUR`, `BTC-USD`                                        |

Las acciones de Londres cotizan en peniques (`GBp`): la función de cotización no tiene entonces unidad, y la
función de divisa indica `GBp`.

## Dispositivos

| Función               | Contenido                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Cotización            | Último precio, en euros, dólares o libras cuando es la divisa.                                     |
| Variación del día     | Cotización menos el cierre anterior.                                                               |
| Variación del día (%) | La misma, en porcentaje.                                                                           |
| Cierre anterior       | La referencia de la variación. Para una criptomoneda, el precio a las 00:00 UTC.                   |
| Divisa                | El código de divisa dado por Yahoo (`EUR`, `USD`, `GBp`, `JPY`…).                                  |
| Mercado               | Abierto o Cerrado. Un par de divisas cotiza 24 horas en días laborables, una criptomoneda siempre. |

Los nombres de las funciones se fijan al crear el dispositivo: cambie el idioma antes de crearlo.

## Widget del panel

**Cotizaciones** lista los símbolos seguidos (8 como máximo) en el orden de la configuración: el instrumento,
su cotización y el estado del mercado, y la variación del día como insignia de color. Toque una línea para
ver el símbolo, el cierre anterior, la variación y la hora de la cotización, con un enlace a Yahoo Finance.

## Desencadenantes de escena

**Bolsa: alerta de cotización** — se cruza una alerta de cotización de la configuración. Filtros: el símbolo
(un dispositivo) y el sentido (sube por encima, baja por debajo). Se activa una vez, y de nuevo solo cuando
el precio ha vuelto un 0,5 % al otro lado del umbral: un precio que oscila alrededor del umbral no inunda su
teléfono. Una alerta ya cruzada al guardarla no activa nada hasta que se cruce de nuevo.

**Bolsa: fuerte variación del día** — la variación desde el cierre anterior alcanza el nivel elegido: 1, 2, 3,
5 o 10 %, al alza o a la baja. Una vez por nivel y por sesión. Filtros: el símbolo, el sentido y el nivel.

Ambos pasan a las acciones: el símbolo, el nombre del instrumento, la cotización, la divisa, el umbral o
nivel, el sentido y una frase lista para usar. Lo ya activado se conserva: un reinicio no activa nada dos
veces.

## Acciones de escena

**Bolsa: leer una cotización** — elija un símbolo; la acción da una frase («IBEX 35: 15.100,20 € (+0,78 %
hoy)»), la cotización, la variación en porcentaje y la divisa.

**Bolsa: leer todas las cotizaciones** — todos los símbolos seguidos en un texto, y su número.

Ambas vuelven a leer Yahoo cuando la última lectura es más antigua que el intervalo de actualización.

## Ejemplos de escenas

- **Resumen de la mañana**: a las 9:30 en días laborables, _leer todas las cotizaciones_ y enviar el texto por
  Telegram.
- **Objetivo alcanzado**: con la alerta `SAN.MC > 10`, en _alerta de cotización_ para Santander, enviar
  «{{text}}» a su teléfono.
- **Tormenta cripto**: en _fuerte variación del día_ para BTC-EUR, a la baja, 10 %, hacer parpadear en rojo la
  lámpara del salón.

## Fuente de los datos, condiciones y límites de uso

La integración lee el punto de acceso público «chart» de Yahoo Finance, una solicitud por símbolo,
espaciadas:

- mientras un mercado está abierto, en cada intervalo de actualización;
- mientras está cerrado, cada 30 minutos (su precio no se mueve);
- un símbolo desconocido, cada 6 horas.

Este acceso es **no oficial**: Yahoo no publica una API para él y puede cambiarlo o rechazarlo en cualquier
momento. Cuando Yahoo rechaza las solicitudes (HTTP 429), la integración espera dos intervalos, y más en cada
nuevo rechazo, hasta una hora. Los datos son para uso personal, según las
[condiciones de servicio de Yahoo](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html): cotizaciones
diferidas e indicativas, no para operar.

## Solución de problemas

- **Ningún dispositivo en la pestaña Descubrir**: revise los símbolos y use **Mostrar las cotizaciones
  actuales**: indica los que Yahoo no conoce. El estado de la integración también lo dice.
- **«Yahoo Finance rechaza las solicitudes por ahora»**: espere, las lecturas se reanudan solas. Reduzca el
  número de símbolos o alargue el intervalo si ocurre a menudo.
- **El mercado sigue «Cerrado» durante la sesión**: la bolsa puede estar en festivo, o el instrumento aún no
  ha cotizado hoy.
- **Una alerta de cotización no se activa**: el símbolo también debe estar en la lista de símbolos, y la
  alerta debe cruzarse después de guardarla.
- Registros: `LOG_LEVEL=debug` muestra cada lectura.

## Límites

- Cotizaciones diferidas e indicativas; no se importa historial (el historial empieza al crear el
  dispositivo).
- Una cotización por símbolo: ni cantidades ni valor de cartera.
- 20 símbolos como máximo.
- La variación de una criptomoneda se cuenta desde las 00:00 UTC, no sobre 24 horas.
- El primer día de un símbolo, una variación ya presente en la primera lectura de la sesión no activa nada.
- Acceso no oficial a Yahoo: puede dejar de funcionar sin previo aviso.
