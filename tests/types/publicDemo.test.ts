import { describe, it, expect } from 'vitest'
import {
  isUnlocked,
  toDojoSetup,
  featuredZone,
  type LockedZone,
  type UnlockedZone,
  type PublicDemoResponse,
} from '@/types/publicDemo'

/**
 * The landing page publishes zones to people who have not paid, and the whole
 * IP contract rests on one rule: a LIVE zone's levels never reach the client.
 *
 * The backend enforces it by omitting the fields. This file enforces the other
 * half — that no component can read them anyway — which matters because
 * TradingChart renders entry, stop and targets as price lines with visible
 * axis labels. A locked zone reaching that prop would defeat the server-side
 * mask through the chart's own axis.
 */

const locked: LockedZone = {
  id: 'live-1',
  fired_at: '2026-09-10T00:02:00Z',
  symbol: 'BTCUSDT',
  timeframe: '1d',
  direction: 'long',
  rule_type: 'futures_dojo_otz_long_1d',
  rr: 3.19,
  confluence_band: 'HIGH',
  backings: ['1W 0.618', 'FVG'],
  outcome: 'unfilled',
  locked: true,
}

const unlocked: UnlockedZone = {
  id: 'won-1',
  fired_at: '2026-08-12T00:02:00Z',
  symbol: 'SOLUSDT',
  timeframe: '1d',
  direction: 'long',
  rule_type: 'futures_dojo_otz_long_1d',
  rr: 3.19,
  confluence_band: 'HIGH',
  backings: ['1M 0.5'],
  outcome: 'target',
  locked: false,
  trigger_price: 142.5,
  otz_low: 128.2,
  otz_high: 134.9,
  entry: 132.8,
  stop_loss: 124.1,
  tp1: 158.4,
  tp2: 171.2,
  tp3: 188.0,
}

describe('PublicZone narrowing', () => {
  it('refuses to hand a locked zone to the chart adapter', () => {
    // @ts-expect-error toDojoSetup only accepts UnlockedZone — this is the
    // guard. If this line ever starts compiling, a locked zone can reach
    // TradingChart and its price axis will print the levels we withheld.
    expect(() => toDojoSetup(locked)).toBeDefined()
  })

  it('narrows a locked zone away from its levels', () => {
    const z = locked as import('@/types/publicDemo').PublicZone
    if (isUnlocked(z)) {
      expect(z.entry).toBeTypeOf('number')
    } else {
      // @ts-expect-error a locked zone has no entry, at the type level
      expect(z.entry).toBeUndefined()
    }
  })

  it('carries what makes a locked row worth buying', () => {
    // If the mask ever widened to swallow these too, the locked row would stop
    // selling anything — it has to be interesting enough to want.
    expect(locked.rr).toBeGreaterThan(0)
    expect(locked.confluence_band).toBe('HIGH')
    expect(locked.direction).toBe('long')
    expect(locked.timeframe).toBe('1d')
  })
})

describe('toDojoSetup', () => {
  it('carries every level the chart draws', () => {
    const d = toDojoSetup(unlocked)
    expect(d.entry).toBe(132.8)
    expect(d.stop_loss).toBe(124.1)
    expect([d.tp1, d.tp2, d.tp3]).toEqual([158.4, 171.2, 188.0])
    expect(d.otz_low).toBe(128.2)
    expect(d.otz_high).toBe(134.9)
  })

  it('leaves leg_id empty rather than inventing one', () => {
    // leg_id names the swing pivots the fibs were measured from. It is not
    // served, and fabricating a value would put a plausible-looking one into
    // a component that might later render it.
    expect(toDojoSetup(unlocked).leg_id).toBe('')
  })
})

describe('featuredZone', () => {
  const base: PublicDemoResponse = {
    generated_at: '2026-09-15T12:00:00Z',
    zones: [locked, unlocked],
    symbols: [],
    stats: { total: 9, waiting: 2, open: 0, target: 2, stopped: 3, invalidated: 2 },
    locked_fields: ['entry', 'stop_loss'],
  }

  it('returns the named zone when it is unlocked', () => {
    expect(featuredZone({ ...base, featured_id: 'won-1' })?.id).toBe('won-1')
  })

  it('refuses a locked zone even if the server named one', () => {
    // Belt and braces: the backend only ever features a resolved zone, but the
    // chart must not draw a masked plan even if that ever changes.
    expect(featuredZone({ ...base, featured_id: 'live-1' })).toBeNull()
  })

  it('returns null when nothing is featured', () => {
    expect(featuredZone(base)).toBeNull()
  })
})
