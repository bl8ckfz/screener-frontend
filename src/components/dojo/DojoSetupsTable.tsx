/**
 * DojoSetupsTable — browse Dojo confluence zones.
 *
 * These are not price-move alerts. A row means a ZONE became armed: an
 * FVG-validated fib 0.62–0.79 band with higher-timeframe fibonacci
 * confluence and agreeing structure, which price has not yet traded into.
 * The entry is a resting limit at fib 0.705, so the row is actionable the
 * moment it appears rather than when price arrives.
 *
 * Because of that, the most useful column is not the price — it is how far
 * price still has to travel to reach the entry, and whether it ever did.
 */

import { Fragment, useMemo, useState } from 'react'
import { useDojoSetups, type DojoSetupFilters } from '@/hooks/useDojoSetups'
import {
  DOJO_OUTCOME_META,
  DOJO_INVALIDATION_HINT,
  isLiveOutcome,
  VOLUME_NODE_META,
  formatDojoPrice,
  stopRiskPct,
  distanceToEntry,
  distanceIsLive,
  daysSince,
  type DojoSetup,
} from '@/types/dojo'

const TIMEFRAMES = ['1d', '5d', '1w'] as const

/**
 * Which slice of history the table shows.
 *
 * dojo_setups has no retention, so closed zones accumulate forever while the
 * live set stays small — invalidation retires dead ones and fills resolve.
 * Showing everything therefore meant the useful rows were a shrinking fraction
 * of the list, and the closed ones can only be read, never acted on.
 *
 * 'live' is the default because it answers the question the page exists for:
 * what should I be doing right now.
 */
type ViewFilter = 'live' | 'closed' | 'all'

const VIEWS: Array<{ id: ViewFilter; label: string; title: string }> = [
  { id: 'live', label: 'Live', title: 'Waiting for price, or filled and running' },
  { id: 'closed', label: 'Closed', title: 'Hit target, stopped out, or invalidated before ever filling' },
  { id: 'all', label: 'All', title: 'Every zone ever published' },
]

type SortField =
  | 'symbol' | 'timeframe' | 'direction' | 'entry' | 'distance'
  | 'rr' | 'confluence' | 'volume' | 'age' | 'status'
type SortDirection = 'asc' | 'desc'

/**
 * Columns, in render order, with the sort key each one carries.
 *
 * Kept as data rather than repeated markup so a header and its sort key
 * cannot drift apart — the failure mode being a column that sorts by
 * something other than what it displays.
 */
const COLUMNS: Array<{
  field: SortField
  label: string
  align: 'left' | 'right' | 'center'
  title?: string
  /**
   * Tailwind visibility, for columns that drop out on a narrow panel.
   *
   * The table shares the viewport with the chart, so ten columns overflow
   * long before the window is small. Hiding beats horizontal scrolling
   * because NOTHING IS LOST: R:R and Volume both appear in the expanded trade
   * plan, so the row is one click from the full picture either way. They are
   * still sortable at any width — the sort control simply lives on a header
   * you can only see when there is room for it.
   */
  hide?: string
}> = [
  { field: 'symbol', label: 'Symbol', align: 'left' },
  { field: 'timeframe', label: 'TF', align: 'left' },
  { field: 'direction', label: 'Side', align: 'left' },
  { field: 'entry', label: 'Entry', align: 'right' },
  {
    field: 'distance', label: 'To entry', align: 'right',
    title: 'How far price must travel from where it is now to reach the entry. Unsigned — the direction is already given by Side.',
  },
  // First to go: R:R is ~3.0 by construction for every zone (0.705 entry,
  // leg-origin stop, -0.27 target), so it rarely distinguishes one row from
  // another. Conf goes next — it is 2 on almost everything, since 2 is the
  // minimum that publishes at all.
  {
    field: 'rr', label: 'R:R', align: 'right',
    hide: 'hidden xl:table-cell',
  },
  {
    field: 'confluence', label: 'Conf', align: 'center',
    title: 'Independent confluences on the best in-band level',
    hide: 'hidden lg:table-cell',
  },
  {
    field: 'volume', label: 'Vol', align: 'center',
    title: 'Whether the zone sits on transacted history (HVN) or in a thin patch price can travel through (LVN)',
    hide: 'hidden xl:table-cell',
  },
  {
    field: 'age', label: 'Age', align: 'right',
    title: 'Days since the zone was published. Outcomes are settled once a day from confirmed bars, so a fill can take until the next daily pass to show.',
  },
  { field: 'status', label: 'Status', align: 'left' },
]

/**
 * Visibility class per column, so a header and its cell cannot disagree about
 * whether the column exists at the current width — which would misalign every
 * row after it.
 */
const HIDE: Partial<Record<SortField, string>> = Object.fromEntries(
  COLUMNS.filter((c) => c.hide).map((c) => [c.field, c.hide!]),
)

/** Rank for the Status column, so sorting follows the trade's lifecycle. */
const OUTCOME_ORDER: Record<string, number> = {
  unfilled: 0, open: 1, target: 2, stopped: 3, invalidated: 4,
}

/** Rank for the Vol column: acceptance, ordinary, thin, then unknown last. */
const VOLUME_ORDER: Record<string, number> = { hvn: 0, neutral: 1, lvn: 2 }

/** Volume standing of the zone, or nothing when there is no profile. */
function VolumeBadge({ setup }: { setup: DojoSetup }) {
  if (!setup.volume_node) return <span className="text-gray-600">—</span>
  const meta = VOLUME_NODE_META[setup.volume_node]
  if (!meta) return <span className="text-gray-600">—</span>
  return (
    <span
      title={meta.hint}
      className={`px-1.5 py-0.5 rounded text-xs font-semibold ${meta.className}`}
    >
      {meta.short}
    </span>
  )
}

function OutcomeBadge({ setup }: { setup: DojoSetup }) {
  const meta = DOJO_OUTCOME_META[setup.outcome]
  // An invalidated zone says WHY on hover. "Invalidated" alone invites the
  // question, and the answer is already stored.
  const reasonHint =
    setup.outcome === 'invalidated' && setup.invalidation_reason
      ? `${meta.hint} — ${DOJO_INVALIDATION_HINT[setup.invalidation_reason]}`
      : meta.hint
  return (
    <span
      title={reasonHint}
      className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

/** The full trade plan, shown when a row is expanded. */
function TradePlan({ setup, livePrice }: { setup: DojoSetup; livePrice?: number }) {
  const dist = distanceToEntry(setup, livePrice)
  const isLong = setup.direction === 'long'

  const rows: Array<[string, string, string?]> = [
    ['Zone (fib 0.62–0.79)', `${formatDojoPrice(setup.otz_low)} – ${formatDojoPrice(setup.otz_high)}`],
    ['Entry (fib 0.705)', formatDojoPrice(setup.entry), 'Resting limit — set it and wait'],
    [
      'Stop',
      `${formatDojoPrice(setup.stop_loss)} (${stopRiskPct(setup).toFixed(1)}% risk)`,
      'Leg origin, 0.5% beyond. The percentage is the distance from the entry — the risk per unit that position sizing is computed from.',
    ],
    ['Targets', `${formatDojoPrice(setup.tp1)} / ${formatDojoPrice(setup.tp2)} / ${formatDojoPrice(setup.tp3)}`, 'fib −0.27 / −0.62 / −1.0'],
    ['R:R to TP1', setup.rr.toFixed(2)],
    ['Price when armed', formatDojoPrice(setup.trigger_price), 'The last confirmed close at the moment this zone was published — not a live price'],
    ['Leg', `${formatDojoPrice(setup.leg_low)} → ${formatDojoPrice(setup.leg_high)}`],
  ]

  if (setup.volume_node) {
    const meta = VOLUME_NODE_META[setup.volume_node]
    const ratio =
      setup.volume_poc_ratio !== undefined
        ? ` · ${(setup.volume_poc_ratio * 100).toFixed(0)}% of POC`
        : ''
    rows.push(['Volume', `${meta?.label ?? setup.volume_node}${ratio}`, meta?.hint])
  }
  if (setup.volume_poc !== undefined) {
    rows.push(['Point of control', formatDojoPrice(setup.volume_poc), 'The price with the most traded volume in the series'])
  }

  return (
    <div className="bg-gray-900/60 px-4 py-3 border-t border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
        {rows.map(([label, value, hint]) => (
          <div key={label} className="flex justify-between gap-4 text-sm">
            <span className="text-gray-400 whitespace-nowrap" title={hint}>
              {label}
            </span>
            <span className="text-gray-100 font-mono text-right">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700/50 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400">Backed by</span>
        {setup.backings.length > 0 ? (
          setup.backings.map((b) => (
            <span key={b} className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-xs font-mono">
              {b}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-500">—</span>
        )}
      </div>

      {dist !== null && setup.outcome === 'unfilled' && (
        <p className="mt-2 text-xs text-gray-400">
          Price must {isLong ? 'fall' : 'rally'} {Math.abs(dist).toFixed(1)}% to reach the entry.
          Nothing has been risked yet.
          {!distanceIsLive(livePrice) && ' (measured from the close when the zone armed)'}
        </p>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Set a TradingView alert on the Dojo Fib Confluence indicator to be told
        the moment price taps this zone.
      </p>
    </div>
  )
}

/**
 * Filter by symbol, then sort — pure, so the ordering rules can be tested
 * without mounting the table.
 */
export function filterAndSortSetups(
  setups: DojoSetup[],
  opts: {
    searchQuery?: string
    sortField: SortField
    sortDirection: SortDirection
    livePrices?: Record<string, number>
    view?: ViewFilter
  },
): DojoSetup[] {
  const { searchQuery = '', sortField, sortDirection, livePrices, view = 'all' } = opts

  const q = searchQuery.trim().toLowerCase()
  let rows = q ? setups.filter((s) => s.symbol.toLowerCase().includes(q)) : setups.slice()

  if (view === 'live') {
    rows = rows.filter((s) => isLiveOutcome(s.outcome))
  } else if (view === 'closed') {
    rows = rows.filter((s) => !isLiveOutcome(s.outcome))
  }

  // One sort key per column, or null when the row has no value for it.
  //
  // Distance is ABSOLUTE: the sign only restates the direction, which Side
  // already gives, and sorting signed would interleave longs and shorts
  // instead of answering "which is closest to filling".
  const keyOf = (s: DojoSetup): number | string | null => {
    switch (sortField) {
      case 'symbol': return s.symbol
      case 'timeframe': return s.timeframe
      case 'direction': return s.direction
      case 'entry': return s.entry
      case 'distance': {
        const d = distanceToEntry(s, livePrices?.[s.symbol])
        return d === null ? null : Math.abs(d)
      }
      case 'rr': return s.rr
      case 'confluence': return s.confluence_score
      case 'volume': return s.volume_node ? VOLUME_ORDER[s.volume_node] ?? 98 : 99
      case 'age': return Date.parse(s.fired_at) || 0
      case 'status': return OUTCOME_ORDER[s.outcome] ?? 99
    }
  }

  rows.sort((a, b) => {
    const av = keyOf(a)
    const bv = keyOf(b)

    // Rows with no value sink to the bottom in BOTH directions, before the
    // direction flip is applied. A sentinel like +Infinity cannot do this —
    // it sorts last ascending and first descending, so reversing the sort
    // would promote "unknown" to the top, which no reading of the column
    // supports.
    if (av === null || bv === null) {
      if (av === bv) return 0
      return av === null ? 1 : -1
    }

    let cmp: number
    if (typeof av === 'string' || typeof bv === 'string') {
      cmp = String(av).localeCompare(String(bv))
    } else {
      cmp = av === bv ? 0 : av < bv ? -1 : 1
    }
    // Age is STORED as a timestamp but READ as an age, and the two run
    // opposite ways: the newest row has the largest timestamp and the
    // smallest age. Flip so "ascending" means what the column says.
    if (sortField === 'age') cmp = -cmp
    return sortDirection === 'asc' ? cmp : -cmp
  })
  return rows
}

export interface DojoSetupsTableProps {
  /** Called when a row is opened, so the chart can show the zone. */
  onSetupSelect?: (setup: DojoSetup) => void
  /** id of the setup currently drawn on the chart. */
  selectedId?: string | null
  /**
   * Live price per full symbol (BTCUSDT), so "To entry" reflects where price
   * is NOW rather than where it was when the zone armed.
   */
  livePrices?: Record<string, number>
  /**
   * The app-wide search box. Filtered here rather than server-side: the whole
   * working set is already loaded (a few hundred rows at most), so a round
   * trip per keystroke would buy nothing.
   */
  searchQuery?: string
}

export function DojoSetupsTable({
  onSetupSelect,
  selectedId,
  livePrices,
  searchQuery = '',
}: DojoSetupsTableProps = {}) {
  const [filters, setFilters] = useState<DojoSetupFilters>({})
  const [view, setView] = useState<ViewFilter>('live')
  const [expanded, setExpanded] = useState<string | null>(null)
  // Age ascending by default: newest zone first, which is what the API
  // already returns, so the initial view is unchanged and now explicit.
  const [sortField, setSortField] = useState<SortField>('age')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const { setups, summary, isLoading, isError, isAuthenticated } = useDojoSetups(filters)

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDirection('asc')
  }

  // Counted over everything fetched, not the current view — the badge should
  // say how many live zones exist, including while looking at Closed.
  const liveCount = useMemo(
    () => setups.filter((s) => isLiveOutcome(s.outcome)).length,
    [setups],
  )

  const visible = useMemo(
    () => filterAndSortSetups(setups, { searchQuery, sortField, sortDirection, livePrices, view }),
    [setups, searchQuery, sortField, sortDirection, livePrices, view],
  )

  if (!isAuthenticated) {
    return <p className="p-6 text-sm text-gray-400">Sign in to view Dojo zones.</p>
  }
  if (isLoading) {
    return <p className="p-6 text-sm text-gray-400">Loading zones…</p>
  }
  if (isError) {
    return <p className="p-6 text-sm text-red-400">Failed to load Dojo zones.</p>
  }

  return (
    <div className="flex flex-col">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 border-b border-gray-700 text-sm">
        <span className="text-gray-300">
          <span className="font-semibold text-white">{summary.total}</span> zones
        </span>
        <span className="text-gray-400">{summary.armed} waiting</span>
        <span className="text-gray-400">{summary.open} open</span>
        {summary.invalidated > 0 && (
          <span
            className="text-gray-600"
            title="Zones retired before price ever reached the entry — the leg re-anchored, the validating gap was mitigated, or structure flipped. Excluded from the hit rate, since no trade was taken."
          >
            {summary.invalidated} invalidated
          </span>
        )}
        {summary.hitRate !== null ? (
          <span className="text-gray-400" title="Resolved trades only — zones price never reached are excluded, since there was no trade to win or lose">
            {summary.wins}/{summary.resolved} hit target ({summary.hitRate.toFixed(0)}%)
          </span>
        ) : (
          <span className="text-gray-500" title="No setup has been filled and resolved yet">
            no resolved trades yet
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-700">
        {/* Live / Closed / All — first, because it decides what the rest of
            the row is filtering within. */}
        <div className="flex rounded overflow-hidden border border-gray-600 mr-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              title={v.title}
              className={`px-2.5 py-1 text-xs ${
                view === v.id
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:text-gray-200'
              }`}
            >
              {v.label}
              {v.id === 'live' && liveCount > 0 && (
                <span className="ml-1 text-gray-400">{liveCount}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFilters({})}
          className={`px-2.5 py-1 rounded text-xs ${
            !filters.timeframe && !filters.direction
              ? 'bg-gray-600 text-white'
              : 'bg-gray-700/50 text-gray-400 hover:text-gray-200'
          }`}
        >
          All
        </button>
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setFilters((f) => ({ ...f, timeframe: f.timeframe === tf ? undefined : tf }))}
            className={`px-2.5 py-1 rounded text-xs uppercase ${
              filters.timeframe === tf
                ? 'bg-gray-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:text-gray-200'
            }`}
          >
            {tf}
          </button>
        ))}
        {(['long', 'short'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setFilters((f) => ({ ...f, direction: f.direction === d ? undefined : d }))}
            className={`px-2.5 py-1 rounded text-xs capitalize ${
              filters.direction === d
                ? d === 'long'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:text-gray-200'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {visible.length === 0 && setups.length > 0 && !searchQuery.trim() ? (
        <div className="p-6 text-sm text-gray-400">
          <p>No {view === 'live' ? 'live' : view === 'closed' ? 'closed' : ''} zones.</p>
          <p className="mt-1 text-xs text-gray-500">
            {view === 'live'
              ? 'Nothing is waiting for price or currently running. Closed zones are under the Closed tab.'
              : 'Nothing has resolved or been invalidated yet.'}
          </p>
        </div>
      ) : visible.length === 0 && setups.length > 0 ? (
        <div className="p-6 text-sm text-gray-400">
          <p>No zones match “{searchQuery}”.</p>
          <p className="mt-1 text-xs text-gray-500">
            Zones are published only for symbols the scanner found a setup on,
            so most tickers will have none.
          </p>
        </div>
      ) : setups.length === 0 ? (
        <div className="p-6 text-sm text-gray-400">
          <p>No zones yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            The scanner rebuilds once a day at 00:02 UTC and only publishes a
            zone when it is FVG-validated, carries at least two independent
            confluences, agrees with structure, and has not been traded into.
            A handful a week is normal.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Styled to match CoinTable and AlertHistoryTable: sticky, and
                bg-gray-900 repeated on each th because a sticky thead does not
                paint its own background over the scrolling rows. */}
            <thead className="bg-gray-900 sticky top-0 z-10">
              <tr className="border-b border-gray-700">
                {COLUMNS.map((c) => {
                  const active = sortField === c.field
                  return (
                    <th
                      key={c.field}
                      onClick={() => toggleSort(c.field)}
                      title={c.title}
                      className={`px-2 py-3 text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900 ${
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                      } ${c.hide ?? ''}`}
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          c.align === 'right' ? 'justify-end' : c.align === 'center' ? 'justify-center' : ''
                        }`}
                      >
                        {c.label}
                        {active && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const livePrice = livePrices?.[s.symbol]
                const dist = distanceToEntry(s, livePrice)
                const age = daysSince(s.fired_at)
                const isOpen = expanded === s.id
                return (
                  <Fragment key={s.id}>
                    <tr
                      onClick={() => {
                        setExpanded(isOpen ? null : s.id)
                        // Always push the selection, even when collapsing —
                        // clicking a row is how you ask to see it charted.
                        onSetupSelect?.(s)
                      }}
                      className={`border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer ${
                        selectedId === s.id ? 'bg-gray-700/40' : ''
                      }`}
                    >
                      <td className="px-2 py-2 font-medium text-white whitespace-nowrap">{s.symbol}</td>
                      <td className="px-2 py-2 uppercase text-gray-300">{s.timeframe}</td>
                      <td className={`px-2 py-2 capitalize font-medium ${
                        s.direction === 'long' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {s.direction}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-gray-100">
                        {formatDojoPrice(s.entry)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono ${
                          distanceIsLive(livePrice) ? 'text-gray-300' : 'text-gray-500 italic'
                        }`}
                        title={
                          distanceIsLive(livePrice)
                            ? 'Measured from the current price'
                            : 'No live price for this symbol — measured from the close when the zone armed'
                        }
                      >
                        {dist === null ? '—' : `${Math.abs(dist).toFixed(1)}%`}
                      </td>
                      <td className={`px-2 py-2 text-right font-mono text-gray-100 ${HIDE.rr ?? ''}`}>
                        {s.rr.toFixed(2)}
                      </td>
                      <td className={`px-2 py-2 text-center text-gray-100 ${HIDE.confluence ?? ''}`}>{s.confluence_score}</td>
                      <td className={`px-2 py-2 text-center ${HIDE.volume ?? ''}`}>
                        <VolumeBadge setup={s} />
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-gray-500">
                        {age === null ? '—' : age === 0 ? 'today' : `${age}d`}
                      </td>
                      <td className="px-2 py-2">
                        <OutcomeBadge setup={s} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={COLUMNS.length} className="p-0">
                          <TradePlan setup={s} livePrice={livePrice} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
