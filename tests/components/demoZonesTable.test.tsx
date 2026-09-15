import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoZonesTable } from '@/components/landing/DemoZonesTable'
import type { LockedZone, UnlockedZone } from '@/types/publicDemo'

/**
 * The DOM half of the masking contract.
 *
 * handlers_public_test.go proves the levels never leave the server for a live
 * zone. This proves the page does not put them on screen either — which is the
 * test that would catch someone "improving" the lock into a CSS blur over a
 * real value, the version a visitor defeats by opening devtools.
 */

const locked: LockedZone = {
  id: 'live-1',
  fired_at: new Date().toISOString(),
  symbol: 'BTCUSDT',
  timeframe: '1d',
  direction: 'long',
  rule_type: 'futures_dojo_otz_long_1d',
  rr: 3.19,
  confluence_band: 'HIGH',
  backings: ['FVG'],
  outcome: 'unfilled',
  locked: true,
}

const unlocked: UnlockedZone = {
  id: 'won-1',
  fired_at: new Date().toISOString(),
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

describe('DemoZonesTable', () => {
  it('renders no price at all for a locked zone', () => {
    const { container } = render(<DemoZonesTable zones={[locked]} />)

    // Any digit group that looks like a price. A locked row legitimately shows
    // the R:R (3.19), the timeframe and the age, so the assertion is on the
    // absence of the specific levels rather than on digits generally.
    for (const leaked of ['132.8', '124.1', '158.4', '171.2', '188', '128.2', '134.9']) {
      expect(container.textContent).not.toContain(leaked)
    }
  })

  it('still shows what makes the locked row worth buying', () => {
    render(<DemoZonesTable zones={[locked]} />)

    expect(screen.getByText('BTC')).toBeDefined()
    expect(screen.getByText('Long')).toBeDefined()
    // R:R is served even when locked — a ratio names no price.
    expect(screen.getByText('3.19')).toBeDefined()
  })

  it('shows the full plan for a resolved zone', () => {
    const { container } = render(<DemoZonesTable zones={[unlocked]} />)
    expect(container.textContent).toContain('132.8')
  })

  it('invites action rather than showing an empty box', () => {
    render(<DemoZonesTable zones={[]} />)
    expect(screen.getByText(/scanner runs once a day/i)).toBeDefined()
  })
})
