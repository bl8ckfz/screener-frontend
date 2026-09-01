import { describe, it, expect } from 'vitest'
import { filterAndSortSetups } from '@/components/dojo/DojoSetupsTable'
import type { DojoSetup } from '@/types/dojo'

/** A setup with only the fields the filter and sort actually read. */
function setup(over: Partial<DojoSetup>): DojoSetup {
  return {
    id: over.symbol ?? 'x',
    symbol: 'BTCUSDT',
    timeframe: '1d',
    direction: 'long',
    fired_at: '2026-08-26T00:02:00Z',
    trigger_price: 100,
    entry: 90,
    stop_loss: 80,
    tp1: 120, tp2: 130, tp3: 140,
    rr: 3,
    confluence_band: 'MEDIUM',
    otz_low: 88, otz_high: 95,
    backings: [],
    outcome: 'unfilled',
    ...over,
  } as DojoSetup
}

const base = { sortField: 'age' as const, sortDirection: 'asc' as const }

describe('live / closed view', () => {
  // Closed zones accumulate forever — dojo_setups has no retention — while the
  // live set stays small, because invalidation retires dead ones and fills
  // resolve. Showing everything meant the actionable rows became a shrinking
  // fraction of the list.
  const rows = [
    setup({ symbol: 'WAITING', outcome: 'unfilled' }),
    setup({ symbol: 'RUNNING', outcome: 'open' }),
    setup({ symbol: 'WON', outcome: 'target' }),
    setup({ symbol: 'LOST', outcome: 'stopped' }),
    setup({ symbol: 'DEAD', outcome: 'invalidated' }),
  ]

  it('shows only what can still be acted on by default', () => {
    const got = filterAndSortSetups(rows, { ...base, view: 'live' }).map((s) => s.symbol)
    expect(got.sort()).toEqual(['RUNNING', 'WAITING'])
  })

  it('puts everything read-only under closed', () => {
    const got = filterAndSortSetups(rows, { ...base, view: 'closed' }).map((s) => s.symbol)
    expect(got.sort()).toEqual(['DEAD', 'LOST', 'WON'])
  })

  it('leaves nothing out between the two views', () => {
    const live = filterAndSortSetups(rows, { ...base, view: 'live' })
    const closed = filterAndSortSetups(rows, { ...base, view: 'closed' })
    const all = filterAndSortSetups(rows, { ...base, view: 'all' })
    expect(live.length + closed.length).toBe(all.length)
    expect(all.length).toBe(rows.length)
  })

  // A filled trade is LIVE even though its zone may since have been
  // invalidated — the position is real and still running.
  it('counts a running trade as live', () => {
    const got = filterAndSortSetups([setup({ symbol: 'X', outcome: 'open' })], { ...base, view: 'live' })
    expect(got).toHaveLength(1)
  })

  it('composes with search rather than replacing it', () => {
    const got = filterAndSortSetups(rows, { ...base, view: 'live', searchQuery: 'wait' })
    expect(got.map((s) => s.symbol)).toEqual(['WAITING'])
  })
})

describe('search', () => {
  const rows = [setup({ symbol: 'BTCUSDT' }), setup({ symbol: 'SUIUSDT' }), setup({ symbol: 'ETHUSDT' })]

  it('matches on a partial symbol, case-insensitively', () => {
    expect(filterAndSortSetups(rows, { ...base, searchQuery: 'sui' }).map((s) => s.symbol))
      .toEqual(['SUIUSDT'])
    expect(filterAndSortSetups(rows, { ...base, searchQuery: 'USDT' })).toHaveLength(3)
  })

  it('ignores surrounding whitespace and an empty query', () => {
    expect(filterAndSortSetups(rows, { ...base, searchQuery: '  eth ' }).map((s) => s.symbol))
      .toEqual(['ETHUSDT'])
    expect(filterAndSortSetups(rows, { ...base, searchQuery: '   ' })).toHaveLength(3)
  })

  it('does not mutate the input array', () => {
    const original = [...rows]
    filterAndSortSetups(rows, { ...base, sortField: 'symbol' })
    expect(rows).toEqual(original)
  })
})

describe('sort by age', () => {
  // Age is stored as a timestamp but read as an age, and they run opposite
  // ways — the newest row has the LARGEST timestamp and the SMALLEST age.
  const rows = [
    setup({ symbol: 'OLD', fired_at: '2026-08-01T00:00:00Z' }),
    setup({ symbol: 'NEW', fired_at: '2026-08-26T00:00:00Z' }),
    setup({ symbol: 'MID', fired_at: '2026-08-15T00:00:00Z' }),
  ]

  it('ascending puts the youngest zone first', () => {
    expect(filterAndSortSetups(rows, { ...base, sortField: 'age', sortDirection: 'asc' })
      .map((s) => s.symbol)).toEqual(['NEW', 'MID', 'OLD'])
  })

  it('descending puts the oldest first', () => {
    expect(filterAndSortSetups(rows, { ...base, sortField: 'age', sortDirection: 'desc' })
      .map((s) => s.symbol)).toEqual(['OLD', 'MID', 'NEW'])
  })
})

describe('sort by distance to entry', () => {
  // Signed distance would interleave longs and shorts. What the column is for
  // is "which of these is closest to filling", which is an absolute question.
  const rows = [
    setup({ symbol: 'FAR', entry: 50, trigger_price: 100 }),   // -50%
    setup({ symbol: 'NEAR', entry: 99, trigger_price: 100 }),  //  -1%
    setup({ symbol: 'ABOVE', entry: 110, trigger_price: 100 }), // +10%
  ]

  it('orders by magnitude, not by sign', () => {
    expect(filterAndSortSetups(rows, { ...base, sortField: 'distance', sortDirection: 'asc' })
      .map((s) => s.symbol)).toEqual(['NEAR', 'ABOVE', 'FAR'])
  })

  it('uses the live price when one is available', () => {
    // Without a live price FAR is -50% away and sorts last. Price moving to
    // 50.1 puts it 0.2% from its entry — nearer than NEAR's 1% — so it must
    // jump to the top. Measured from trigger_price it never would.
    const withLive = filterAndSortSetups(rows, {
      ...base, sortField: 'distance', sortDirection: 'asc',
      livePrices: { FAR: 50.1 },
    })
    expect(withLive.map((s) => s.symbol)).toEqual(['FAR', 'NEAR', 'ABOVE'])
  })

  it('sorts rows with no measurable distance LAST in both directions', () => {
    const withNull = [...rows, setup({ symbol: 'NONE', entry: 0, trigger_price: 0 })]
    expect(filterAndSortSetups(withNull, { ...base, sortField: 'distance', sortDirection: 'asc' })
      .at(-1)?.symbol).toBe('NONE')
    // Descending must not float it to the top either — an unmeasurable row is
    // not "the furthest away".
    expect(filterAndSortSetups(withNull, { ...base, sortField: 'distance', sortDirection: 'desc' })
      .at(-1)?.symbol).toBe('NONE')
  })
})

describe('sort by the remaining columns', () => {
  it('orders status by the trade lifecycle, not alphabetically', () => {
    const rows = [
      setup({ symbol: 'A', outcome: 'stopped' }),
      setup({ symbol: 'B', outcome: 'unfilled' }),
      setup({ symbol: 'C', outcome: 'target' }),
      setup({ symbol: 'D', outcome: 'open' }),
    ]
    expect(filterAndSortSetups(rows, { ...base, sortField: 'status', sortDirection: 'asc' })
      .map((s) => s.outcome)).toEqual(['unfilled', 'open', 'target', 'stopped'])
  })

  it('orders volume acceptance first and no-profile last', () => {
    const rows = [
      setup({ symbol: 'A' }),                        // no volume_node
      setup({ symbol: 'B', volume_node: 'lvn' }),
      setup({ symbol: 'C', volume_node: 'hvn' }),
      setup({ symbol: 'D', volume_node: 'neutral' }),
    ]
    expect(filterAndSortSetups(rows, { ...base, sortField: 'volume', sortDirection: 'asc' })
      .map((s) => s.symbol)).toEqual(['C', 'D', 'B', 'A'])
  })

  it('sorts symbols as text and numbers as numbers', () => {
    const rows = [setup({ symbol: 'C' }), setup({ symbol: 'A' }), setup({ symbol: 'B' })]
    expect(filterAndSortSetups(rows, { ...base, sortField: 'symbol', sortDirection: 'asc' })
      .map((s) => s.symbol)).toEqual(['A', 'B', 'C'])

    const byRR = [setup({ symbol: 'A', rr: 10 }), setup({ symbol: 'B', rr: 9 }), setup({ symbol: 'C', rr: 100 })]
    expect(filterAndSortSetups(byRR, { ...base, sortField: 'rr', sortDirection: 'asc' })
      .map((s) => s.rr)).toEqual([9, 10, 100])
  })
})
