import { describe, it, expect } from 'vitest'
import { withLivePlanRows } from '@/hooks/useAlertStats'
import type { CoinAlertStats } from '@/types/alertHistory'
import type { Coin } from '@/types/coin'
import type { DojoSetup } from '@/types/dojo'

/**
 * A coin with a plan in play must have a row in the alert table.
 *
 * THE BUG THIS PINS. Every other row comes from an alert, read over 48 hours
 * from a table kept for seven days. A Dojo plan outlives both — a weekly zone
 * can wait months for price, firing nothing the whole time — so a quietly
 * waiting plan had no row at all, and pinning a badge to a row that does not
 * exist shows nothing.
 *
 * The coins affected were the worst possible ones: a plan that has been waiting
 * longest is the one most easily forgotten, and it was the first to vanish.
 */

function planRow(over: Partial<DojoSetup> = {}): DojoSetup {
  return {
    id: 'setup-1',
    leg_id: 'leg-1',
    fired_at: '2026-09-01T00:02:00Z',
    symbol: 'ZETAUSDT',
    timeframe: '1w',
    direction: 'short',
    rule_type: 'futures_dojo_otz_short_1w',
    trigger_price: 0.5,
    otz_low: 0.5,
    otz_high: 0.56,
    entry: 0.52,
    stop_loss: 0.58,
    tp1: 0.4,
    tp2: 0.35,
    tp3: 0.3,
    rr: 2.4,
    confluence_band: 'HIGH',
    backings: [],
    outcome: 'unfilled',
    ...over,
  } as DojoSetup
}

function alertRow(symbol: string, totalAlerts = 3): CoinAlertStats {
  return {
    symbol,
    currentPrice: 1,
    priceChange: 2,
    totalAlerts,
    lastAlertTimestamp: Date.parse('2026-09-20T00:00:00Z'),
    alertTypes: new Set(),
    alerts: [],
  }
}

const coins = [
  { symbol: 'ZETA', lastPrice: 0.47, priceChangePercent: -3.2 } as Coin,
]

describe('withLivePlanRows', () => {
  it('adds a row for a coin whose plan is waiting with nothing in the alert window', () => {
    const plans = new Map([['ZETA', [planRow()]]])

    const got = withLivePlanRows([], plans, coins)

    expect(got).toHaveLength(1)
    expect(got[0].symbol).toBe('ZETA')
  })

  it('leaves an existing row alone rather than duplicating the coin', () => {
    const plans = new Map([['ZETA', [planRow()]]])

    const got = withLivePlanRows([alertRow('ZETA')], plans, coins)

    expect(got).toHaveLength(1)
    expect(got[0].totalAlerts).toBe(3)
  })

  it('says plainly that nothing fired, rather than inventing alerts', () => {
    const plans = new Map([['ZETA', [planRow()]]])

    const [row] = withLivePlanRows([], plans, coins)

    expect(row.totalAlerts).toBe(0)
    expect(row.alertTypes.size).toBe(0)
    expect(row.alerts).toEqual([])
  })

  it('prices the row from the live coin when there is one', () => {
    const plans = new Map([['ZETA', [planRow()]]])

    const [row] = withLivePlanRows([], plans, coins)

    expect(row.currentPrice).toBe(0.47)
    expect(row.priceChange).toBe(-3.2)
  })

  // A plan outlives its symbol's place in the tracked universe, so there may be
  // no live price. A stale one beats a zero, which would render as a real price.
  it('falls back to the close when the zone armed if the coin is untracked', () => {
    const plans = new Map([['ZETA', [planRow({ trigger_price: 0.5 })]]])

    const [row] = withLivePlanRows([], plans, [])

    expect(row.currentPrice).toBe(0.5)
  })

  it('timestamps the row from the plan so it sorts sensibly', () => {
    const plans = new Map([['ZETA', [planRow({ fired_at: '2026-09-10T00:02:00Z' })]]])

    const [row] = withLivePlanRows([], plans, coins)

    expect(row.lastAlertTimestamp).toBe(Date.parse('2026-09-10T00:02:00Z'))
  })

  // A fill is the later and more interesting event of the two.
  it('prefers the fill over the publication for that timestamp', () => {
    const plans = new Map([
      [
        'ZETA',
        [planRow({ fired_at: '2026-09-01T00:02:00Z', entry_hit_at: '2026-09-15T11:00:00Z' })],
      ],
    ])

    const [row] = withLivePlanRows([], plans, coins)

    expect(row.lastAlertTimestamp).toBe(Date.parse('2026-09-15T11:00:00Z'))
  })

  it('changes nothing when no coin has a plan', () => {
    const existing = [alertRow('BTC')]
    expect(withLivePlanRows(existing, new Map(), coins)).toBe(existing)
  })
})
