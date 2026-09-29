import { describe, it, expect } from 'vitest'
import { planRows, latestPlanEvent, publishedCandleIndex } from '@/components/dojo/planModel'
import { filterAndSortSetups } from '@/components/dojo/DojoSetupsTable'
import type { DojoSetup } from '@/types/dojo'

const base = {
  id: 'z1',
  symbol: 'BTCUSDT',
  timeframe: '1d',
  direction: 'long',
  fired_at: '2026-08-26T00:02:00Z',
  trigger_price: 100,
  entry: 90,
  stop_loss: 81,
  tp1: 120, tp2: 130, tp3: 140,
  rr: 3,
  confluence_band: 'HIGH',
  otz_low: 88, otz_high: 95,
  backings: ['1W 0.618'],
  outcome: 'unfilled',
} as DojoSetup

describe('planRows', () => {
  // "Risk" read as account risk. It is the distance from entry to stop.
  it('labels the stop percentage as a stop distance, not risk', () => {
    const stop = planRows(base, false).find(([label]) => label === 'Stop')!
    expect(stop[1]).toMatch(/stop distance 10\.0%/)
    expect(stop[1]).not.toMatch(/risk/)
  })

  it('withholds the volume rows without plan detail', () => {
    const withVolume = { ...base, volume_node: 'hvn', volume_poc: 91 } as DojoSetup
    const labels = (detail: boolean) => planRows(withVolume, detail).map(([l]) => l)
    expect(labels(true)).toContain('Point of control')
    expect(labels(false)).not.toContain('Point of control')
    expect(labels(false)).not.toContain('Volume')
  })
})

describe('latestPlanEvent', () => {
  it('is publication for a plan nothing has happened to', () => {
    expect(latestPlanEvent(base)).toEqual({ label: 'Published', at: base.fired_at })
  })

  it('is the newest transition', () => {
    const s = {
      ...base,
      outcome: 'target',
      entry_hit_at: '2026-09-01T10:00:00Z',
      tp1_hit_at: '2026-09-04T10:00:00Z',
    } as DojoSetup
    expect(latestPlanEvent(s).label).toBe('First target reached')
  })

  it('distinguishes retiring before entry from expiring after it', () => {
    const before = { ...base, outcome: 'invalidated', invalidated_at: '2026-09-02T00:02:00Z' } as DojoSetup
    expect(latestPlanEvent(before).label).toBe('Retired before entry')

    const after = { ...before, entry_hit_at: '2026-09-01T00:02:00Z' } as DojoSetup
    expect(latestPlanEvent(after).label).toBe('Thesis expired after entry')
  })
})

describe('publishedCandleIndex', () => {
  const day = 86400
  const t0 = Date.parse('2026-08-24T00:00:00Z') / 1000
  const candles = [0, 1, 2, 3, 4].map((i) => ({ time: t0 + i * day }))

  // Published two minutes after midnight on the 26th: the bar that OPENED
  // at midnight that day, not the next one.
  it('is the daily bar the plan was published in', () => {
    expect(publishedCandleIndex(base, candles)).toBe(2)
  })

  it('is -1 when publication predates the loaded series', () => {
    expect(publishedCandleIndex({ fired_at: '2026-01-01T00:00:00Z' }, candles)).toBe(-1)
  })

  it('is -1 for an unparseable date or an empty series', () => {
    expect(publishedCandleIndex({ fired_at: 'nonsense' }, candles)).toBe(-1)
    expect(publishedCandleIndex(base, [])).toBe(-1)
  })
})

describe('distance sort', () => {
  // The cell shows a dash once the entry is behind the plan, so the sort
  // must treat it as unknown too rather than ranking by a meaningless figure.
  it('sinks plans that are no longer waiting for their entry', () => {
    const waiting = { ...base, id: 'w', entry: 95 } as DojoSetup
    const running = { ...base, id: 'r', entry: 99.9, outcome: 'open' } as DojoSetup
    const order = filterAndSortSetups([running, waiting], {
      sortField: 'distance',
      sortDirection: 'asc',
      livePrices: { BTCUSDT: 100 },
    }).map((s) => s.id)
    expect(order).toEqual(['w', 'r'])
  })
})
