import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TradePlan } from '@/components/dojo/DojoSetupsTable'
import type { DojoSetup } from '@/types/dojo'

/**
 * The expanded plan asks the entitlement question itself.
 *
 * The server strips the Pro-only fields for an account without them, so on a
 * fresh response this changes nothing. What it guards is a row fetched under
 * a DIFFERENT answer — cached from a Pro account before a sign-out, or from
 * before a plan lapsed — carrying volume data the current account may not see.
 */
const withDetail = {
  id: 'z1',
  symbol: 'BTCUSDT',
  timeframe: '1d',
  direction: 'long',
  fired_at: '2026-08-26T00:02:00Z',
  trigger_price: 100,
  entry: 90,
  stop_loss: 80,
  tp1: 120, tp2: 130, tp3: 140,
  rr: 3,
  confluence_band: 'HIGH',
  otz_low: 88, otz_high: 95,
  backings: ['1W 0.618'],
  volume_node: 'hvn',
  volume_poc_ratio: 0.9,
  volume_poc: 91.5,
  outcome: 'unfilled',
} as DojoSetup

describe('TradePlan plan-detail gate', () => {
  it('renders volume, POC and backings with plan detail', () => {
    render(<TradePlan setup={withDetail} hasPlanDetails />)
    expect(screen.queryByText('Volume')).not.toBeNull()
    expect(screen.queryByText('Point of control')).not.toBeNull()
    expect(screen.queryByText('1W 0.618')).not.toBeNull()
  })

  it('renders none of them without, even when the row carries them', () => {
    render(<TradePlan setup={withDetail} hasPlanDetails={false} />)
    expect(screen.queryByText('Volume')).toBeNull()
    expect(screen.queryByText('Point of control')).toBeNull()
    expect(screen.queryByText('1W 0.618')).toBeNull()
  })
})
