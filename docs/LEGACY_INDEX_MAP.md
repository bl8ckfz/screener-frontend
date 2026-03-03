# Legacy FAST_DIZI Index Mapping

This reference maps indices from `fast.html` monolithic array `FAST_DIZI[t][index]` to the structured fields used in the refactored TypeScript architecture.

| FAST_DIZI Index | Meaning (Legacy)            | New Source / Field                                   |
|-----------------|-----------------------------|------------------------------------------------------|
| 6               | Current price               | `coin.lastPrice`                                     |
| 10              | Previous close price        | `coin.prevClosePrice`                                |
| 16              | Current quote volume        | `coin.quoteVolume`                                   |
| 22              | Current VCP value           | `coin.indicators.vcp`                                |
| 23              | Current Price/WA ratio      | `coin.indicators.priceToWeightedAvg`                 |
| 46/51/61/97/102/107 | Historical prices (15s/30s/1m/3m/5m/15m) | `coin.history[timeframe].price`                     |
| 45/50/60/96/101/106 | Historical volumes (15s/30s/1m/3m/5m/15m)| `coin.history[timeframe].volume`                    |
| 63/99/104        | Price/WA ratios (1m/3m/5m)  | `coin.history[timeframe].priceToWA` (derived)        |
| 66               | 5m reference price          | `coin.history['5m'].price`                           |
| 69/100/105/110   | VCP historical snapshots    | `coin.history[timeframe].vcp`                        |
| 111/114/115      | Ultra-short snapshots (5s)  | `coin.history['5s'].*`                               |
| 112              | 5s price                    | `coin.history['5s'].price`                           |
|
> Note: Some ultra-short (5s/10s/15s) mappings are approximations; legacy code used densely packed arrays with overlapping semantics. Only indices required for Scout / volume / VCP alerts are documented here.

## Scout Alert Formula (Refactored)

Bull:
- priceRatio5m = current / price5m > 1.01
- priceRatio15m = current / price15m > 1.01
- 3 * (current / price5m) > current / prevClose
- Volume ratio: (2 * currentVolume / volume5m) > (currentVolume / volume15m)
- Gating: (currentVolume - volume5m) > 5000

Bear (inverted ratios):
- price5m / current > 1.01
- price15m / current > 1.01
- 3 * (price5m / current) > prevClose / current
- Volume ratio: (2 * currentVolume / volume5m) > (currentVolume / volume15m)
- Gating: (currentVolume - volume5m) > 1000

## Rationale for Gating Thresholds
Legacy fast.html required minimum volume deltas (>5000 bull, >1000 bear) and broader momentum context. The refactored engine applies simplified gating to reduce false positives while preserving intent.

## Updating This Document
Add additional indices only when directly needed for migrating a legacy alert condition. Avoid exhaustive mapping to keep focus tight.
