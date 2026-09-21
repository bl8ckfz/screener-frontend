import { describe, it, expect } from 'vitest'
import { readDojoAlertContext, isDojoRuleType } from '@/services/dojoAlertContext'

/**
 * The allowlist that carries the alert-to-plan connection.
 *
 * Two things rest on this function and nothing else guards either.
 *
 * The first is that the connection exists at all. Both alert transforms
 * declared `metadata` on their input type and neither read it, so a Dojo alert
 * arrived with the setup id already in hand and dropped it — and clicking one
 * opened a chart with no zone on it. Every field below is read here or it is
 * lost there.
 *
 * The second is the scrub contract. The backend publishes the LEVELS and not
 * the fibonacci ratios or the swing they were measured from, because entry and
 * stop alone reconstruct the leg for anyone holding the two plan constants.
 * Copying the whole metadata map across would make that one forgotten backend
 * field away from breaking, in the direction that leaks — so the reader is an
 * allowlist, and this asserts it stays one.
 */

const ARMED_METADATA = {
  timeframe: '1w',
  direction: 'long',
  leg_id: 'leg-abc',
  setup_id: 'setup-123',
  otz_low: 58000,
  otz_high: 61000,
  otz_valid: true,
  entry: 59500,
  stop_loss: 56000,
  tp1: 68000,
  tp2: 72000,
  tp3: 80000,
  rr: 2.4,
  confluence_band: 'HIGH',
  backings: ['1M 0.618'],
  structure_trend: 1,
  event: 'zone_armed',
  entry_style: 'resting limit at the sniper entry',
}

describe('readDojoAlertContext', () => {
  it('carries the fields a plan is opened and described by', () => {
    const ctx = readDojoAlertContext('futures_dojo_otz_long_1w', ARMED_METADATA)

    expect(ctx).toBeDefined()
    expect(ctx!.setupId).toBe('setup-123')
    expect(ctx!.event).toBe('zone_armed')
    expect(ctx!.direction).toBe('long')
    expect(ctx!.timeframe).toBe('1w')
    expect(ctx!.entry).toBe(59500)
    expect(ctx!.stopLoss).toBe(56000)
    expect(ctx!.tp1).toBe(68000)
    expect(ctx!.otzLow).toBe(58000)
    expect(ctx!.otzHigh).toBe(61000)
  })

  it('copies nothing it was not asked for', () => {
    const ctx = readDojoAlertContext('futures_dojo_otz_long_1w', {
      ...ARMED_METADATA,
      // If the backend's scrub ever slipped, the frontend must not be the
      // thing that then publishes it. A wholesale copy would.
      best_level_fib: 0.618,
      leg_high: 72000,
      leg_low: 51000,
      price_pos: 0.42,
      swing_len: 2,
    })

    const keys = Object.keys(ctx!)
    for (const leaked of ['best_level_fib', 'leg_high', 'leg_low', 'price_pos', 'swing_len']) {
      expect(keys).not.toContain(leaked)
    }
    // And nothing that merely looks like a ratio came along either.
    expect(JSON.stringify(ctx)).not.toMatch(/0\.\d{3}/)
  })

  it('returns undefined without a setup id, so the caller falls back to the coin', () => {
    // Nothing to open. The alternative — matching a plan by symbol — is wrong:
    // a symbol routinely carries a long and a short on different timeframes,
    // so it would show a different thesis with different levels.
    const { setup_id, ...withoutId } = ARMED_METADATA
    expect(setup_id).toBeDefined()
    expect(readDojoAlertContext('futures_dojo_otz_long_1w', withoutId)).toBeUndefined()
  })

  it('ignores non-Dojo alerts entirely', () => {
    expect(
      readDojoAlertContext('futures_big_bull_60', { setup_id: 'setup-123' })
    ).toBeUndefined()
  })

  it('treats missing and malformed numbers as absent rather than as zero', () => {
    // A level that renders as 0 is a real price on a cheap token, so a missing
    // one must stay undefined rather than become a plausible lie.
    const ctx = readDojoAlertContext('futures_dojo_near_long', {
      setup_id: 'setup-9',
      entry: 'not a number',
      tp1: null,
      stop_loss: Number.NaN,
    })

    expect(ctx!.setupId).toBe('setup-9')
    expect(ctx!.entry).toBeUndefined()
    expect(ctx!.tp1).toBeUndefined()
    expect(ctx!.stopLoss).toBeUndefined()
  })

  it('survives a missing metadata map', () => {
    expect(readDojoAlertContext('futures_dojo_near_long', undefined)).toBeUndefined()
    expect(readDojoAlertContext('futures_dojo_near_long', null)).toBeUndefined()
  })

  it('reads every event in a zone`s life, including the three endings', () => {
    const events = [
      ['futures_dojo_otz_long_1w', 'zone_armed'],
      ['futures_dojo_near_long', 'zone_entered'],
      ['futures_dojo_filled_long', 'entry_filled'],
      ['futures_dojo_invalidated_long', 'zone_invalidated'],
      ['futures_dojo_target_long', 'target_hit'],
      ['futures_dojo_stopped_long', 'stop_hit'],
    ] as const

    for (const [ruleType, event] of events) {
      const ctx = readDojoAlertContext(ruleType, { setup_id: 'setup-1', event })
      expect(ctx?.event, `${ruleType} did not survive the transform`).toBe(event)
    }
  })

  it('keeps the invalidation reason, which is the only thing that explains a retirement', () => {
    const ctx = readDojoAlertContext('futures_dojo_invalidated_short', {
      setup_id: 'setup-4',
      event: 'zone_invalidated',
      invalidation_reason: 'fvg_mitigated',
    })
    expect(ctx!.invalidationReason).toBe('fvg_mitigated')
  })

  it('rejects a direction it does not recognise instead of passing it through', () => {
    const ctx = readDojoAlertContext('futures_dojo_near_long', {
      setup_id: 'setup-5',
      direction: 'sideways',
    })
    expect(ctx!.direction).toBeUndefined()
  })
})

describe('isDojoRuleType', () => {
  it('matches the whole family and nothing else', () => {
    for (const rt of [
      'futures_dojo_otz_long_1d',
      'futures_dojo_near_short',
      'futures_dojo_filled_long',
      'futures_dojo_invalidated_long',
      'futures_dojo_target_short',
      'futures_dojo_stopped_long',
    ]) {
      expect(isDojoRuleType(rt), rt).toBe(true)
    }

    for (const rt of ['futures_big_bull_60', 'futures_whale_detector', 'dojo_otz_long_1d', '']) {
      expect(isDojoRuleType(rt), rt).toBe(false)
    }
  })
})
