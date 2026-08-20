import { describe, it, expect } from 'vitest'
import { isBullishAlertType } from '@/types/alertColors'

describe('isBullishAlertType', () => {
  it('reads Dojo long zones as bullish', () => {
    // These say "long", not "bull". Matching on 'bull' alone painted every
    // Dojo long red — the bug this helper was extracted to stop repeating.
    for (const t of [
      'futures_dojo_otz_long_1d',
      'futures_dojo_otz_long_5d',
      'futures_dojo_otz_long_1w',
    ]) {
      expect(isBullishAlertType(t)).toBe(true)
    }
  })

  it('reads Dojo short zones as bearish', () => {
    for (const t of [
      'futures_dojo_otz_short_1d',
      'futures_dojo_otz_short_5d',
      'futures_dojo_otz_short_1w',
    ]) {
      expect(isBullishAlertType(t)).toBe(false)
    }
  })

  it('keeps the bear-shaped long signals bullish', () => {
    // These fire on capitulation drops but are long signals at a 1-day horizon.
    for (const t of ['futures_surge_42', 'futures_knife_catcher', 'futures_capitulation_catcher']) {
      expect(isBullishAlertType(t)).toBe(true)
    }
  })

  it('handles the classic momentum families', () => {
    expect(isBullishAlertType('futures_big_bull_60')).toBe(true)
    expect(isBullishAlertType('futures_big_bear_60')).toBe(false)
    expect(isBullishAlertType('futures_bottom_hunter')).toBe(true)
    expect(isBullishAlertType('futures_top_hunter')).toBe(false)
    expect(isBullishAlertType('futures_whale_accumulation')).toBe(true)
    expect(isBullishAlertType('futures_whale_distribution')).toBe(false)
  })

  it('accepts a type already stripped of its futures_ prefix', () => {
    // Callers pass both forms; AlertBadges strips first, AlertHistory does not.
    expect(isBullishAlertType('dojo_otz_long_1w')).toBe(true)
    expect(isBullishAlertType('big_bull_60')).toBe(true)
    expect(isBullishAlertType('dojo_otz_short_1w')).toBe(false)
  })
})
