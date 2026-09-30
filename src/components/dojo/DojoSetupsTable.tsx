/**
 * DojoSetupsTable — browse Dojo confluence zones.
 *
 * These are not price-move alerts. A row means a ZONE became armed: an
 * FVG-validated demand (or supply) area with higher-timeframe confluence and
 * agreeing structure, which price has not yet traded into. The entry is a
 * resting limit inside it, so the row is actionable the moment it appears
 * rather than when price arrives.
 *
 * Because of that, the most useful column is not the price — it is how far
 * price still has to travel to reach the entry, and whether it ever did.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { DojoTimeline } from './DojoTimeline'
import { planRows } from './planModel'
import { InfoHint } from '@/components/ui/InfoHint'
import { FEATURE_FLAGS } from '@/config'
import { useAuth } from '@/hooks/useAuth'
import { useDojoSetups, type DojoSetupFilters } from '@/hooks/useDojoSetups'
import {
  DOJO_OUTCOME_META,
  DOJO_INVALIDATION_HINT,
  isLiveOutcome,
  VOLUME_NODE_META,
  formatDojoPrice,
  distanceToEntry,
  distanceIsLive,
  daysSince,
  CONFLUENCE_RANK,
  type DojoSetup,
  type ConfluenceBand,
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
export type ViewFilter = 'live' | 'closed' | 'all'

const VIEWS: Array<{ id: ViewFilter; label: string; title: string }> = [
  { id: 'live', label: 'Live', title: 'Waiting for price, or entry hit and running' },
  { id: 'closed', label: 'Closed', title: 'Hit target, stopped out, or retired before entry' },
  { id: 'all', label: 'All', title: 'Every zone ever published' },
]

export type SortField =
  | 'symbol' | 'timeframe' | 'direction' | 'entry' | 'distance'
  | 'rr' | 'confluence' | 'volume' | 'age' | 'status'
export type SortDirection = 'asc' | 'desc'

/**
 * Columns, in render order, with the sort key each one carries.
 *
 * Kept as data rather than repeated markup so a header and its sort key
 * cannot drift apart — the failure mode being a column that sorts by
 * something other than what it displays.
 */
export const COLUMNS: Array<{
  field: SortField
  label: string
  align: 'left' | 'right' | 'center'
  title?: string
  /**
   * Tailwind visibility, for columns that drop out on a narrow panel.
   *
   * The table shares the viewport with the chart, so ten columns overflow
   * long before the window is small. Hiding beats horizontal scrolling
   * because NOTHING IS LOST: R:R, Confluence and Volume all appear in the
   * plan panel, so the row is one click from the full picture either way. They are
   * still sortable at any width — the sort control simply lives on a header
   * you can only see when there is room for it.
   */
  hide?: string
}> = [
  // Order answers the questions in the order they are asked: which coin, is
  // it still live, how close is it, which way. The levels and ratings follow,
  // and the last three drop out first as the panel narrows — all of them are
  // in the plan panel beside the chart, so nothing is lost by hiding them.
  { field: 'symbol', label: 'Symbol', align: 'left' },
  { field: 'status', label: 'Status', align: 'left' },
  {
    field: 'distance', label: 'To entry', align: 'right',
    title: 'How far price must travel from where it is now to reach the entry. Unsigned — the direction is already given by Side.',
  },
  { field: 'direction', label: 'Side', align: 'left' },
  { field: 'timeframe', label: 'TF', align: 'left' },
  { field: 'entry', label: 'Entry', align: 'right' },
  {
    field: 'age', label: 'Age', align: 'right',
    title: 'Days since the zone was published. A running trade settles from minute candles, usually within minutes of the touch; anything missed waits for the daily pass.',
  },
  // R:R is ~3.0 by construction for every zone, so it rarely distinguishes
  // one row from another. Confluence reads HIGH or MEDIUM on almost
  // everything, since anything weaker never publishes.
  {
    field: 'rr', label: 'R:R', align: 'right',
    hide: 'hidden xl:table-cell',
  },
  {
    field: 'confluence', label: 'Confluence', align: 'center',
    title: 'How much independent agreement backs this zone, relative to the most its timeframe can carry',
    // From lg, as it was before the column reorder: at xl it vanished on
    // ordinary laptop widths, and customers use it to scan the list.
    hide: 'hidden lg:table-cell',
  },
  {
    field: 'volume', label: 'Volume', align: 'center',
    title: 'Whether the zone sits on transacted history (HVN) or in a thin patch price can travel through (LVN)',
    hide: 'hidden 2xl:table-cell',
  },
]

/**
 * The columns this account actually gets.
 *
 * Vol is dropped rather than rendered empty for an account without plan
 * detail. The server strips volume_node from the payload, so leaving the
 * column in place would print a column of dashes — and a dash in this table
 * means "no volume profile for this symbol", which is a statement about the
 * data rather than about the subscription. An absent column says nothing
 * false; the expanded plan is where the offer is made.
 */
export function columnsFor(hasPlanDetails: boolean) {
  return hasPlanDetails ? COLUMNS : COLUMNS.filter((c) => c.field !== 'volume')
}

/**
 * Visibility class per column, so a header and its cell cannot disagree about
 * whether the column exists at the current width — which would misalign every
 * row after it.
 */
export const HIDE: Partial<Record<SortField, string>> = Object.fromEntries(
  COLUMNS.filter((c) => c.hide).map((c) => [c.field, c.hide!]),
)

/** Rank for the Status column, so sorting follows the trade's lifecycle. */
const OUTCOME_ORDER: Record<string, number> = {
  unfilled: 0, open: 1, target: 2, stopped: 3, invalidated: 4,
}

/** Rank for the Vol column: acceptance, ordinary, thin, then unknown last. */
const VOLUME_ORDER: Record<string, number> = { hvn: 0, neutral: 1, lvn: 2 }

/**
 * How the volume rating renders. 'badge' is the coloured chip, for the plan
 * panel where it is one of a few things. 'plain' is text, for table rows,
 * where a column of identical HVN chips drew the eye away from Status.
 * Confluence deliberately has no plain form — see ConfluenceBadge.
 */
export type RatingVariant = 'badge' | 'plain'

/** Volume standing of the zone, or nothing when there is no profile. */
export function VolumeBadge({
  setup,
  variant = 'badge',
}: {
  setup: Pick<DojoSetup, 'volume_node' | 'volume_poc_ratio'>
  variant?: RatingVariant
}) {
  if (!setup.volume_node) return <span className="text-gray-500">—</span>
  const meta = VOLUME_NODE_META[setup.volume_node]
  if (!meta) return <span className="text-gray-500">—</span>
  if (variant === 'plain') {
    return (
      <InfoHint hint={meta.hint}>
        <span className="text-xs text-gray-300">{meta.short}</span>
      </InfoHint>
    )
  }
  return (
    <span
      title={meta.hint}
      className={`px-1.5 py-0.5 rounded text-xs font-semibold ${meta.className}`}
    >
      {meta.short}
    </span>
  )
}

const CONFLUENCE_META: Record<ConfluenceBand, { className: string; hint: string }> = {
  HIGH: {
    className: 'bg-emerald-500/15 text-emerald-300',
    hint: 'As much agreement as this timeframe can carry',
  },
  MEDIUM: {
    className: 'bg-amber-500/15 text-amber-300',
    hint: 'One short of the most this timeframe can carry',
  },
  LOW: {
    className: 'bg-gray-500/15 text-gray-300',
    hint: 'Thin agreement behind this zone',
  },
}

/** Confluence as a band. Nothing renders for a row that predates the column. */
/**
 * Confluence as a coloured band — green HIGH, amber MEDIUM, grey LOW.
 *
 * Always the chip, including in table rows. Phase 5 rendered it as plain
 * grey text there to quiet the rows, and customers read that as the rating
 * being gone: the colour IS the at-a-glance signal they scan the list by.
 */
export function ConfluenceBadge({ band }: { band: ConfluenceBand }) {
  const meta = CONFLUENCE_META[band]
  if (!meta) return <span className="text-gray-500">—</span>
  return (
    <InfoHint hint={meta.hint}>
      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${meta.className}`}>
        {band}
      </span>
    </InfoHint>
  )
}

export function OutcomeBadge({ setup }: { setup: Pick<DojoSetup, 'outcome' | 'invalidation_reason'> }) {
  const meta = DOJO_OUTCOME_META[setup.outcome]
  // A retired zone says WHY on hover or tap. "Invalidated" alone invites the
  // question, and the answer is already stored.
  const reasonHint =
    setup.outcome === 'invalidated' && setup.invalidation_reason
      ? `${meta.hint} — ${DOJO_INVALIDATION_HINT[setup.invalidation_reason]}`
      : meta.hint
  return (
    <InfoHint hint={reasonHint} align="right">
      <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${meta.className}`}>
        {meta.label}
      </span>
    </InfoHint>
  )
}

/**
 * Sort choices for the phone layout, which has no column headers to click.
 * Each is a field plus the direction that reads naturally for it.
 */
const MOBILE_SORTS: Array<{ id: string; label: string; field: SortField; direction: SortDirection }> = [
  { id: 'newest', label: 'Newest first', field: 'age', direction: 'asc' },
  { id: 'closest', label: 'Closest to entry', field: 'distance', direction: 'asc' },
  { id: 'status', label: 'Status', field: 'status', direction: 'asc' },
  { id: 'symbol', label: 'Symbol A–Z', field: 'symbol', direction: 'asc' },
  { id: 'confluence', label: 'Strongest confluence', field: 'confluence', direction: 'desc' },
]

/**
 * One plan as a card, for phones.
 *
 * The table's answer to a narrow screen was hiding columns, but Status sat
 * last and was the first thing a phone lost to horizontal scroll. A card
 * keeps status and distance always in view, and says outright that tapping
 * it opens the plan rather than leaving the row to look clickable.
 */
function DojoSetupCard({
  setup,
  livePrice,
  selected,
  onSelect,
}: {
  setup: DojoSetup
  livePrice?: number
  selected: boolean
  onSelect?: (setup: DojoSetup) => void
}) {
  const dist = distanceToEntry(setup, livePrice)
  const age = daysSince(setup.fired_at)
  const isLong = setup.direction === 'long'
  return (
    <div
      className={`rounded-lg border bg-gray-800 px-3 py-2.5 ${
        selected ? 'border-accent' : 'border-gray-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-sm font-semibold text-white">{setup.symbol}</span>
          <span className={`text-xs font-medium ${isLong ? 'text-green-400' : 'text-red-400'}`}>
            {isLong ? 'Long' : 'Short'}
          </span>
          <span className="text-xs uppercase text-gray-400">{setup.timeframe}</span>
        </div>
        <OutcomeBadge setup={setup} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-xs text-gray-400">
          <div>
            Entry <span className="font-mono text-gray-100">{formatDojoPrice(setup.entry)}</span>
          </div>
          <div className="mt-0.5">
            {setup.outcome === 'unfilled' && dist !== null ? (
              <span className={distanceIsLive(livePrice) ? 'text-gray-200' : 'italic'}>
                {Math.abs(dist).toFixed(1)}% to entry
              </span>
            ) : (
              <span>{DOJO_OUTCOME_META[setup.outcome].label}</span>
            )}
            <span className="text-gray-400"> · {age === null ? '—' : age === 0 ? 'today' : `${age}d old`}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect?.(setup)}
          className="h-9 flex-shrink-0 rounded border border-gray-600 px-3 text-xs font-medium text-gray-100 hover:bg-gray-700"
        >
          View plan
        </button>
      </div>
    </div>
  )
}

/** Keyed passthrough, so a mapped cell needs no wrapper element. */
function Cell({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/**
 * The full trade plan as a block.
 *
 * The app shows plans in PlanPanel beside the chart; this remains for the
 * landing demo's expanded rows, and shares its wording through planModel.
 */
export function TradePlan({
  setup,
  livePrice,
  // The server strips the Pro-only fields, so this is not what withholds them.
  // It decides whether their absence is explained, and it keeps a row fetched
  // under another account (or before a plan lapsed) from rendering detail this
  // account is not entitled to. Defaults to true for callers that have
  // already decided; the landing page passes false.
  hasPlanDetails = true,
}: {
  setup: DojoSetup
  livePrice?: number
  hasPlanDetails?: boolean
}) {
  const dist = distanceToEntry(setup, livePrice)
  const isLong = setup.direction === 'long'

  const rows = planRows(setup, hasPlanDetails)

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

      {hasPlanDetails ? (
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
      ) : (
        // Says what is missing and why, rather than leaving a gap. An empty
        // "Backed by —" would read as "this zone has no backing", which is the
        // opposite of true: nothing publishes without it.
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <p className="text-xs text-gray-400">
            <span className="text-gray-300">Backed by</span> · the levels behind this zone, its
            volume context and the point of control are part of Pro. The plan above — zone, entry,
            stop, targets and the confluence rating — is not affected.
          </p>
        </div>
      )}

      {dist !== null && setup.outcome === 'unfilled' && (
        <p className="mt-2 text-xs text-gray-400">
          Price must {isLong ? 'fall' : 'rally'} {Math.abs(dist).toFixed(1)}% to reach the entry.
          Nothing has been risked yet.
          {!distanceIsLive(livePrice) && ' (measured from the close when the zone armed)'}
        </p>
      )}

      {/* The plan's own history, from the timestamps already on this row.
          Following one zone used to mean reconstructing it by hand across the
          table, the chart and the alert feed. */}
      <div className="mt-3 border-t border-gray-700/50 pt-3">
        <DojoTimeline setup={setup} />
      </div>
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
        // Only a zone still waiting has an entry ahead of it; for the rest the
        // cell shows a dash, so they sort with the other unknowns.
        if (s.outcome !== 'unfilled') return null
        const d = distanceToEntry(s, livePrices?.[s.symbol])
        return d === null ? null : Math.abs(d)
      }
      case 'rr': return s.rr
      case 'confluence': return CONFLUENCE_RANK[s.confluence_band] ?? 0
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
  // Age ascending by default: newest zone first, which is what the API
  // already returns, so the initial view is unchanged and now explicit.
  const [sortField, setSortField] = useState<SortField>('age')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const { setups, summary, isLoading, isError, isAuthenticated } = useDojoSetups(filters)
  const { hasPlanDetails } = useAuth()
  const columns = useMemo(() => columnsFor(hasPlanDetails), [hasPlanDetails])
  const showCards = FEATURE_FLAGS.mobileCardView

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
      {/* Summary.
          Counted by the backend over the WHOLE filtered population, not over
          the page of rows below. The two used to be the same derivation, so
          the hit rate silently described whichever ≤200 rows had loaded and
          moved whenever a filter changed. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 border-b border-gray-700 text-sm">
        {!summary ? (
          // Nothing rather than zeros while it loads. Zeros would read as "no
          // trades", which is a claim about the method rather than about the
          // request still being in flight.
          <span className="text-gray-400">counting zones…</span>
        ) : (
          <>
            <span className="text-gray-300">
              <span className="font-semibold text-white">{summary.total}</span> zones
            </span>
            <span className="text-gray-400">{summary.unfilled} waiting</span>
            <span className="text-gray-400">{summary.open} entry hit</span>
            {summary.invalidated > 0 && (
              <span
                className="text-gray-400"
                title="Zones retired before price ever reached the entry — the leg re-anchored, the validating gap was mitigated, or structure flipped. Excluded from the hit rate, since no trade was taken."
              >
                {summary.invalidated} retired
              </span>
            )}
            {summary.hit_rate !== null ? (
              <span
                className="text-gray-400"
                title="Resolved trades only, counted across every zone matching these filters — not just the rows loaded below. Zones price never reached are excluded, since there was no trade to win or lose."
              >
                {summary.wins}/{summary.resolved} hit target ({summary.hit_rate.toFixed(0)}%)
              </span>
            ) : (
              <span className="text-gray-400" title="No setup has been filled and resolved yet">
                no resolved trades yet
              </span>
            )}
          </>
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
        {showCards && (
          <select
            aria-label="Sort zones"
            value={MOBILE_SORTS.find((o) => o.field === sortField && o.direction === sortDirection)?.id ?? ''}
            onChange={(e) => {
              const opt = MOBILE_SORTS.find((o) => o.id === e.target.value)
              if (!opt) return
              setSortField(opt.field)
              setSortDirection(opt.direction)
            }}
            className="ml-auto h-8 rounded border border-gray-600 bg-gray-800 px-2 text-xs text-gray-200 md:hidden"
          >
            {!MOBILE_SORTS.some((o) => o.field === sortField && o.direction === sortDirection) && (
              <option value="">Custom sort</option>
            )}
            {MOBILE_SORTS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        )}
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
          <p className="mt-1 text-xs text-gray-400">
            {view === 'live'
              ? 'Nothing is waiting for price or currently running. Closed zones are under the Closed tab.'
              : 'Nothing has resolved or been retired yet.'}
          </p>
        </div>
      ) : visible.length === 0 && setups.length > 0 ? (
        <div className="p-6 text-sm text-gray-400">
          <p>No zones match “{searchQuery}”.</p>
          <p className="mt-1 text-xs text-gray-400">
            Zones are published only for symbols the scanner found a setup on,
            so most tickers will have none.
          </p>
        </div>
      ) : setups.length === 0 ? (
        <div className="p-6 text-sm text-gray-400">
          <p>No zones yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            The scanner rebuilds once a day at 00:02 UTC and only publishes a
            zone when it is FVG-validated, carries at least two independent
            confluences, agrees with structure, and has not been traded into.
            A handful a week is normal.
          </p>
        </div>
      ) : (
        <>
          {showCards && (
            <div className="space-y-2 p-2 md:hidden">
              {visible.map((s) => (
                <DojoSetupCard
                  key={s.id}
                  setup={s}
                  livePrice={livePrices?.[s.symbol]}
                  selected={selectedId === s.id}
                  onSelect={onSetupSelect}
                />
              ))}
            </div>
          )}
          <div className={showCards ? 'hidden overflow-x-auto md:block' : 'overflow-x-auto'}>
            <table className="w-full text-sm">
              {/* Styled to match CoinTable and AlertHistoryTable: sticky, and
                  bg-gray-900 repeated on each th because a sticky thead does not
                  paint its own background over the scrolling rows. */}
              <thead className="bg-gray-900 sticky top-0 z-10">
                <tr className="border-b border-gray-700">
                  {columns.map((c) => {
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
                  const isSelected = selectedId === s.id
                  // One renderer per column, looked up by field and emitted in
                  // the order of `columns` — so reordering COLUMNS reorders the
                  // cells too, and a header can never sit over another
                  // column's data.
                  const cells: Record<SortField, ReactNode> = {
                    symbol: (
                      <td className="px-2 py-2 font-medium text-white whitespace-nowrap">{s.symbol}</td>
                    ),
                    status: (
                      <td className="px-2 py-2">
                        <OutcomeBadge setup={s} />
                      </td>
                    ),
                    distance: (
                      <td
                        className={`px-2 py-2 text-right font-mono ${
                          distanceIsLive(livePrice) ? 'text-gray-200' : 'text-gray-400 italic'
                        }`}
                        title={
                          distanceIsLive(livePrice)
                            ? 'Measured from the current price'
                            : 'No live price for this symbol — measured from the close when the zone armed'
                        }
                      >
                        {/* Only meaningful while the entry is still ahead. */}
                        {dist === null || s.outcome !== 'unfilled' ? '—' : `${Math.abs(dist).toFixed(1)}%`}
                      </td>
                    ),
                    direction: (
                      <td className={`px-2 py-2 capitalize font-medium ${
                        s.direction === 'long' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {s.direction}
                      </td>
                    ),
                    timeframe: <td className="px-2 py-2 uppercase text-gray-300">{s.timeframe}</td>,
                    entry: (
                      <td className="px-2 py-2 text-right font-mono text-gray-100">
                        {formatDojoPrice(s.entry)}
                      </td>
                    ),
                    age: (
                      <td className="px-2 py-2 text-right font-mono text-gray-400">
                        {age === null ? '—' : age === 0 ? 'today' : `${age}d`}
                      </td>
                    ),
                    rr: (
                      <td className={`px-2 py-2 text-right font-mono text-gray-100 ${HIDE.rr ?? ''}`}>
                        {s.rr.toFixed(2)}
                      </td>
                    ),
                    confluence: (
                      <td className={`px-2 py-2 text-center ${HIDE.confluence ?? ''}`}>
                        <ConfluenceBadge band={s.confluence_band} />
                      </td>
                    ),
                    volume: (
                      <td className={`px-2 py-2 text-center ${HIDE.volume ?? ''}`}>
                        <VolumeBadge setup={s} variant="plain" />
                      </td>
                    ),
                  }
                  return (
                    <tr
                      key={s.id}
                      // The plan opens in the panel beside the chart (or the
                      // drawer on a phone), so the row only selects. It used to
                      // expand inline too, which showed the same plan twice.
                      onClick={() => onSetupSelect?.(s)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSetupSelect?.(s)
                        }
                      }}
                      tabIndex={0}
                      aria-selected={isSelected}
                      className={`border-b border-gray-700/50 cursor-pointer transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent ${
                        isSelected
                          ? 'bg-accent-bg shadow-[inset_3px_0_0_0_#2B95FF]'
                          : 'hover:bg-gray-700/30'
                      }`}
                    >
                      {columns.map((c) => (
                        <Cell key={c.field}>{cells[c.field]}</Cell>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
