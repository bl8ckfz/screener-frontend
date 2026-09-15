import { describe, it, expect } from 'vitest'
import { coinFromDojoSetup } from '@/types/dojo'
import type { DojoSetup } from '@/types/dojo'

/**
 * A symbol can hold an open Dojo zone for weeks while dropping out of the
 * tracked top-200 by volume. It then has no entry in the tickers hash, so
 * coinFromDojoSetup falls back to the zone's trigger_price — the close from
 * the day the zone armed.
 *
 * That fallback is fine for the table, which labels it via distanceIsLive.
 * It is NOT fine for the chart: TradingChart uses livePrice to overwrite the
 * last candle's close and stretch its high/low, so a stale value rewrites
 * today's bar into one that never happened.
 */
const setup = (over: Partial<DojoSetup> = {}): DojoSetup => ({
  id: 'z1', leg_id: '', fired_at: '2026-08-20T00:02:00Z',
  symbol: 'COMPUSDT', timeframe: '1d', direction: 'long',
  rule_type: 'futures_dojo_otz_long_1d',
  trigger_price: 25.4,
  otz_low: 21, otz_high: 23, entry: 22.1, stop_loss: 19.8,
  tp1: 30, tp2: 34, tp3: 40, rr: 3.1,
  confluence_band: 'HIGH', backings: [], outcome: 'unfilled',
  ...over,
})

describe('placeholder coin from a Dojo zone', () => {
  it('is marked as a placeholder so the UI can refuse its price', () => {
    const coin = coinFromDojoSetup(setup())
    expect(coin.isPlaceholder).toBe(true)
  })

  it('falls back to trigger_price when no live price exists', () => {
    // Documents the trap rather than endorsing it: lastPrice looks like a
    // current price and is not one. Consumers must gate on isPlaceholder.
    const coin = coinFromDojoSetup(setup())
    expect(coin.lastPrice).toBe(25.4)
  })

  it('uses the real live price when one is available', () => {
    const coin = coinFromDojoSetup(setup(), 18.76)
    expect(coin.lastPrice).toBe(18.76)
  })

  it('never invents 24h movement', () => {
    // A zeroed change rendered as "0.00%" would read as a flat day, which is
    // not what happened — it is an absence of data.
    const coin = coinFromDojoSetup(setup())
    expect(coin.priceChangePercent).toBe(0)
    expect(coin.isPlaceholder).toBe(true)
  })
})
