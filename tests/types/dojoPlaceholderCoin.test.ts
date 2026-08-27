import { describe, it, expect } from 'vitest'
import { coinFromDojoSetup } from '@/types/dojo'
import type { DojoSetup } from '@/types/dojo'

function setup(over: Partial<DojoSetup> = {}): DojoSetup {
  return {
    id: 'z1',
    symbol: 'SUIUSDT',
    timeframe: '1d',
    direction: 'long',
    fired_at: '2026-08-26T00:02:00Z',
    trigger_price: 3.21,
    entry: 3.0,
    stop_loss: 2.8,
    tp1: 3.9, tp2: 4.1, tp3: 4.4,
    rr: 3,
    confluence_score: 2,
    otz_low: 2.9, otz_high: 3.1,
    leg_low: 2.8, leg_high: 4.4,
    backings: [],
    outcome: 'unfilled',
    ...over,
  } as DojoSetup
}

describe('coinFromDojoSetup', () => {
  // The chart needs exactly one thing to work: fullSymbol. /api/klines proxies
  // any Binance symbol, not only the tracked top ~200, which is why a
  // placeholder is enough to fix the missing chart.
  it('carries the full symbol through so klines can be fetched', () => {
    expect(coinFromDojoSetup(setup()).fullSymbol).toBe('SUIUSDT')
  })

  it('splits the base symbol from its pair', () => {
    expect(coinFromDojoSetup(setup()).symbol).toBe('SUI')
    expect(coinFromDojoSetup(setup()).pair).toBe('USDT')

    const usdc = coinFromDojoSetup(setup({ symbol: 'BTCUSDC' }))
    expect(usdc.symbol).toBe('BTC')
    expect(usdc.pair).toBe('USDC')
  })

  it('falls back to USDT for an unrecognised suffix without mangling the symbol', () => {
    const odd = coinFromDojoSetup(setup({ symbol: 'WEIRD' }))
    expect(odd.symbol).toBe('WEIRD')
    expect(odd.fullSymbol).toBe('WEIRD')
    expect(odd.pair).toBe('USDT')
  })

  // These symbols are usually absent from the Redis tickers hash too, since it
  // is written for the same tracked set — so the zone's own trigger_price is
  // the honest fallback.
  it('prefers a live price but falls back to the price when the zone armed', () => {
    expect(coinFromDojoSetup(setup(), 3.55).lastPrice).toBe(3.55)
    expect(coinFromDojoSetup(setup()).lastPrice).toBe(3.21)
    // A zero or missing live price must not win over a real stored one.
    expect(coinFromDojoSetup(setup(), 0).lastPrice).toBe(3.21)
  })

  // The important honesty property: no 24h window exists for this symbol, so
  // the change must not be invented. A fabricated value would render as a
  // confident green or red number in the chart header.
  it('zeroes the 24h fields and flags itself as a placeholder', () => {
    const c = coinFromDojoSetup(setup())
    expect(c.isPlaceholder).toBe(true)
    expect(c.priceChangePercent).toBe(0)
    expect(c.priceChange).toBe(0)
    expect(c.quoteVolume).toBe(0)
    expect(c.count).toBe(0)
  })

  // A missing nested field would crash any consumer that reads it without a
  // guard, which is the whole risk of hand-building a wide interface.
  it('fills the nested indicator structures rather than leaving them undefined', () => {
    const c = coinFromDojoSetup(setup())
    expect(c.indicators).toBeDefined()
    expect(c.indicators.vcp).toBe(0)
    expect(c.indicators.fibonacci).toBeDefined()
    expect(c.indicators.fibonacci.pivot).toBe(0)
  })
})
