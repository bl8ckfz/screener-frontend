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

import { Fragment, useState } from 'react'
import { useDojoSetups, type DojoSetupFilters } from '@/hooks/useDojoSetups'
import {
  DOJO_OUTCOME_META,
  VOLUME_NODE_META,
  formatDojoPrice,
  distanceToEntry,
  type DojoSetup,
} from '@/types/dojo'

const TIMEFRAMES = ['1d', '5d', '1w'] as const

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
  return (
    <span
      title={meta.hint}
      className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

/** The full trade plan, shown when a row is expanded. */
function TradePlan({ setup }: { setup: DojoSetup }) {
  const dist = distanceToEntry(setup)
  const isLong = setup.direction === 'long'

  const rows: Array<[string, string, string?]> = [
    ['Zone (fib 0.62–0.79)', `${formatDojoPrice(setup.otz_low)} – ${formatDojoPrice(setup.otz_high)}`],
    ['Entry (fib 0.705)', formatDojoPrice(setup.entry), 'Resting limit — set it and wait'],
    ['Stop', formatDojoPrice(setup.stop_loss), 'Leg origin, 0.5% beyond'],
    ['Targets', `${formatDojoPrice(setup.tp1)} / ${formatDojoPrice(setup.tp2)} / ${formatDojoPrice(setup.tp3)}`, 'fib −0.27 / −0.62 / −1.0'],
    ['R:R to TP1', setup.rr.toFixed(2)],
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
        </p>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Set a TradingView alert on the Dojo Fib Confluence indicator to be told
        the moment price taps this zone.
      </p>
    </div>
  )
}

export interface DojoSetupsTableProps {
  /** Called when a row is opened, so the chart can show the zone. */
  onSetupSelect?: (setup: DojoSetup) => void
  /** id of the setup currently drawn on the chart. */
  selectedId?: string | null
}

export function DojoSetupsTable({ onSetupSelect, selectedId }: DojoSetupsTableProps = {}) {
  const [filters, setFilters] = useState<DojoSetupFilters>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const { setups, summary, isLoading, isError, isAuthenticated } = useDojoSetups(filters)

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
      <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-gray-700">
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

      {setups.length === 0 ? (
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
            <thead className="text-xs text-gray-400 border-b border-gray-700">
              <tr>
                <th className="text-left font-medium px-4 py-2">Symbol</th>
                <th className="text-left font-medium px-2 py-2">TF</th>
                <th className="text-left font-medium px-2 py-2">Side</th>
                <th className="text-right font-medium px-2 py-2">Entry</th>
                <th className="text-right font-medium px-2 py-2" title="How far price must travel to reach the entry">
                  To entry
                </th>
                <th className="text-right font-medium px-2 py-2">R:R</th>
                <th className="text-center font-medium px-2 py-2" title="Independent confluences on the best in-band level">
                  Conf
                </th>
                <th className="text-center font-medium px-2 py-2" title="Whether the zone sits on transacted history (HVN) or in a thin patch price can travel through (LVN)">
                  Vol
                </th>
                <th className="text-left font-medium px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {setups.map((s) => {
                const dist = distanceToEntry(s)
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
                      <td className="px-4 py-2 font-medium text-white">{s.symbol}</td>
                      <td className="px-2 py-2 uppercase text-gray-300">{s.timeframe}</td>
                      <td className={`px-2 py-2 capitalize font-medium ${
                        s.direction === 'long' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {s.direction}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-gray-100">
                        {formatDojoPrice(s.entry)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-gray-400">
                        {dist === null ? '—' : `${dist > 0 ? '+' : ''}${dist.toFixed(1)}%`}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-gray-100">
                        {s.rr.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-100">{s.confluence_score}</td>
                      <td className="px-2 py-2 text-center">
                        <VolumeBadge setup={s} />
                      </td>
                      <td className="px-2 py-2">
                        <OutcomeBadge setup={s} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <TradePlan setup={s} />
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
