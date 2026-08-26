import { describe, it, expect } from 'vitest'
import {
  formatDojoPrice,
  distanceToEntry,
  DOJO_OUTCOME_META,
  VOLUME_NODE_META,
  type DojoSetup,
} from '@/types/dojo'

function setup(over: Partial<DojoSetup> = {}): DojoSetup {
  return {
    id: 'a', leg_id: 'l', fired_at: '2026-08-20T11:52:29Z',
    symbol: '1000FLOKIUSDT', timeframe: '1w', direction: 'short',
    rule_type: 'futures_dojo_otz_short_1w',
    trigger_price: 0.02261,
    leg_high: 0.038330, leg_low: 0.019901,
    leg_high_time: '2026-01-01T00:00:00Z', leg_low_time: '2026-06-01T00:00:00Z',
    otz_low: 0.031327, otz_high: 0.034460,
    entry: 0.032893, stop_loss: 0.038522,
    tp1: 0.014925, tp2: 0.008, tp3: 0.002, rr: 3.19,
    confluence_score: 2, backings: ['1M 0.5', 'FVG'],
    outcome: 'unfilled',
    ...over,
  }
}

describe('formatDojoPrice', () => {
  it('scales precision with magnitude', () => {
    // BTC near 65000 and 1000FLOKI near 0.02 cannot share a precision.
    expect(formatDojoPrice(65432.1)).toBe('65432.10')
    expect(formatDojoPrice(1.2941)).toBe('1.2941')
    expect(formatDojoPrice(0.032893)).toBe('0.032893')
    expect(formatDojoPrice(0.00002345)).toBe('0.00002345')
  })

  it('renders absent values as a dash rather than 0', () => {
    // A missing level must not read as a real price of zero.
    expect(formatDojoPrice(undefined)).toBe('—')
    expect(formatDojoPrice(null)).toBe('—')
    expect(formatDojoPrice(NaN)).toBe('—')
  })
})

describe('distanceToEntry', () => {
  it('is positive when price must rise to reach a short entry', () => {
    // The real 1000FLOKI zone: price 0.02261, entry 0.032893.
    const d = distanceToEntry(setup())
    expect(d).not.toBeNull()
    expect(d!).toBeGreaterThan(44)
    expect(d!).toBeLessThan(46)
  })

  it('is negative when price must fall to reach a long entry', () => {
    const d = distanceToEntry(setup({ direction: 'long', trigger_price: 100, entry: 90 }))
    expect(d).toBeCloseTo(-10, 5)
  })

  it('returns null when there is nothing to compare', () => {
    expect(distanceToEntry(setup({ trigger_price: 0 }))).toBeNull()
  })
})

describe('DOJO_OUTCOME_META', () => {
  it('covers every outcome', () => {
    for (const o of ['unfilled', 'open', 'target', 'stopped'] as const) {
      expect(DOJO_OUTCOME_META[o]?.label).toBeTruthy()
    }
  })

  it('does not present an unfilled zone as a loss', () => {
    // Price never reached the resting limit, so there was no trade. Labelling
    // it as a loss would distort any hit rate drawn from these rows.
    const meta = DOJO_OUTCOME_META.unfilled
    expect(meta.label.toLowerCase()).not.toContain('loss')
    expect(meta.className).not.toContain('red')
  })
})

describe('VOLUME_NODE_META', () => {
  it('covers every node kind', () => {
    for (const n of ['hvn', 'lvn', 'neutral'] as const) {
      expect(VOLUME_NODE_META[n]?.label).toBeTruthy()
      expect(VOLUME_NODE_META[n]?.short).toBeTruthy()
      expect(VOLUME_NODE_META[n]?.hint).toBeTruthy()
    }
  })

  it('does not colour a low volume node as an outright failure', () => {
    // An LVN is a warning about how price behaves there, not a rejected
    // setup — the zone still passed every gate. Red would read as invalid.
    expect(VOLUME_NODE_META.lvn.className).not.toContain('red')
  })

  it('distinguishes acceptance from thinness visually', () => {
    expect(VOLUME_NODE_META.hvn.className).not.toBe(VOLUME_NODE_META.lvn.className)
  })
})
