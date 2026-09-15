import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TradeStory } from '@/components/landing/TradeStory'
import type { PublicDemoResponse, UnlockedZone } from '@/types/publicDemo'

/**
 * The worked example must describe what actually happened.
 *
 * It originally branched only on `outcome === 'target'` and swept everything
 * else into "Filled, then stopped out" — so an INVALIDATED zone, which by
 * definition never filled, was described as a trade that filled and lost.
 */

const base: Omit<UnlockedZone, 'outcome'> = {
  id: 'z1',
  fired_at: '2026-09-11T00:02:00Z',
  symbol: 'BTCUSDT',
  timeframe: '1d',
  direction: 'long',
  rule_type: 'futures_dojo_otz_long_1d',
  rr: 3.19,
  confluence_band: 'HIGH',
  backings: ['FVG'],
  locked: false,
  trigger_price: 64210.5,
  otz_low: 58120.25,
  otz_high: 60940.75,
  entry: 59988.125,
  stop_loss: 56404,
  tp1: 69120,
  tp2: 73450.5,
  tp3: 80010.25,
}

function renderWith(zone: UnlockedZone): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const data: PublicDemoResponse = {
    generated_at: new Date().toISOString(),
    featured_id: zone.id,
    zones: [zone],
    symbols: [],
    stats: { total: 1, waiting: 0, open: 0, target: 0, stopped: 0, invalidated: 1 },
    locked_fields: [],
  }
  client.setQueryData(['publicDemo'], data)

  const { container } = render(
    <QueryClientProvider client={client}>
      <TradeStory />
    </QueryClientProvider>,
  )
  return container.textContent ?? ''
}

describe('TradeStory', () => {
  it('never claims a fill for a zone that was retired unfilled', () => {
    const text = renderWith({
      ...base,
      outcome: 'invalidated',
      invalidated_at: '2026-09-20T00:00:00Z',
    })

    expect(text).toContain('Price never came back')
    expect(text).toContain('Retired without ever being traded')
    expect(text).not.toContain('Stopped out')
    // "unfilled" and "the gap that validated it filled" are both correct here;
    // what must never appear is a claim that the ORDER filled.
    expect(text).not.toContain('the limit filled')
    expect(text).not.toMatch(/Filled, then/i)
  })

  it('describes a stopped trade as filled and then lost', () => {
    const text = renderWith({
      ...base,
      outcome: 'stopped',
      entry_hit_at: '2026-09-19T00:00:00Z',
      sl_hit_at: '2026-09-23T00:00:00Z',
    })

    expect(text).toContain('the limit filled')
    expect(text).toContain('Stopped out')
  })

  it('describes a winner as filled and then run to target', () => {
    const text = renderWith({
      ...base,
      outcome: 'target',
      entry_hit_at: '2026-09-19T00:00:00Z',
      tp1_hit_at: '2026-09-27T00:00:00Z',
    })

    expect(text).toContain('the limit filled')
    expect(text).toContain('first target')
  })
})
