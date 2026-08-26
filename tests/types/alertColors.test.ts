import { describe, it, expect } from 'vitest'
import { isBullishAlertType } from '@/types/alertColors'

/**
 * isBullishAlertType decides whether an alert renders green or red — on the
 * badge, in the history list and as a chart marker. It lived in four copies
 * before it was extracted here, and one had already fallen behind, so each
 * family that breaks the naive "contains bull" rule gets a case.
 */
describe('isBullishAlertType', () => {
  it('handles the plain bull/bear names', () => {
    expect(isBullishAlertType('futures_big_bull_60')).toBe(true)
    expect(isBullishAlertType('futures_big_bear_60')).toBe(false)
  })

  it('treats bear-shaped long-bias signals as bullish', () => {
    // These fire on capitulation drops but are long signals at a 1-day horizon.
    expect(isBullishAlertType('futures_surge_42')).toBe(true)
    expect(isBullishAlertType('futures_knife_catcher')).toBe(true)
    expect(isBullishAlertType('futures_capitulation_catcher')).toBe(true)
    expect(isBullishAlertType('futures_bottom_hunter')).toBe(true)
  })

  it('handles Dojo armed zones, which say long/short not bull/bear', () => {
    expect(isBullishAlertType('futures_dojo_otz_long_1d')).toBe(true)
    expect(isBullishAlertType('futures_dojo_otz_long_1w')).toBe(true)
    expect(isBullishAlertType('futures_dojo_otz_short_1d')).toBe(false)
    expect(isBullishAlertType('futures_dojo_otz_short_1w')).toBe(false)
  })

  it('handles Dojo zone-entered alerts, which carry no timeframe suffix', () => {
    // The check used to be startsWith('dojo_otz_long'), which these fail on
    // both counts — so every zone-entered long would have rendered red.
    expect(isBullishAlertType('futures_dojo_near_long')).toBe(true)
    expect(isBullishAlertType('futures_dojo_near_short')).toBe(false)
  })

  it('accepts a type already stripped of the futures_ prefix', () => {
    expect(isBullishAlertType('dojo_near_long')).toBe(true)
    expect(isBullishAlertType('dojo_near_short')).toBe(false)
  })
})
