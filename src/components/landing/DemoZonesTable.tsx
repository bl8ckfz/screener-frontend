/**
 * The zone table, as a visitor sees it.
 *
 * Reuses the paying app's own cells — VolumeBadge, ConfluenceBadge,
 * OutcomeBadge, TradePlan — rather than reimplementing them, because the page
 * is making a claim ("this is the actual product") that a lookalike would
 * quietly break the moment either copy drifted.
 *
 * What it does NOT reuse is DojoSetupsTable itself: that one fetches through
 * useDojoSetups, which is gated on being signed in, and carries a filter bar,
 * view tabs and sortable headers that a landing page has no use for.
 */
import { Fragment, useState } from 'react'
import { Lock } from 'lucide-react'
import {
  VolumeBadge,
  ConfluenceBadge,
  OutcomeBadge,
  TradePlan,
} from '@/components/dojo/DojoSetupsTable'
import { formatDojoPrice, daysSince } from '@/types/dojo'
import { isUnlocked, toDojoSetup, type PublicZone } from '@/types/publicDemo'
import { checkoutUrl } from '@/config/checkout'

interface DemoZonesTableProps {
  zones: PublicZone[]
  featuredId?: string
  onZoneSelect?: (zone: PublicZone) => void
  selectedId?: string | null
}

/** The row's headline number: an entry price, or the lock that replaces it. */
function EntryCell({ zone }: { zone: PublicZone }) {
  if (isUnlocked(zone)) {
    return <span className="font-mono text-sm text-white">{formatDojoPrice(zone.entry)}</span>
  }

  // Not a blurred number. The value genuinely is not in the response, and a
  // CSS blur over a real one would be a lie that devtools exposes in a click.
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-500" title="Subscribers see the entry, stop and targets">
      <Lock size={12} aria-hidden="true" />
      <span className="font-mono text-sm tracking-widest">•••••</span>
    </span>
  )
}

/**
 * What a locked row shows when opened.
 *
 * Deliberately the same row labels as the real trade plan, so the visitor can
 * see the shape of what they would get rather than a marketing paragraph about
 * it. R:R and confluence stay in the clear — they are what make the row worth
 * wanting, and neither reveals a price.
 */
function LockedPlan({ zone }: { zone: PublicZone }) {
  const rows = ['Zone', 'Entry', 'Stop loss', 'Target 1', 'Target 2', 'Target 3']

  return (
    <div className="space-y-3 px-4 py-3">
      <dl className="space-y-1.5">
        {rows.map((label) => (
          <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-gray-400">{label}</dt>
            <dd className="inline-flex items-center gap-1.5 text-gray-600">
              <Lock size={11} aria-hidden="true" />
              <span className="font-mono tracking-widest">•••••</span>
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <dt className="text-gray-400">Risk/reward</dt>
          <dd className="font-mono text-white">{zone.rr.toFixed(2)}</dd>
        </div>
      </dl>

      <p className="max-w-prose text-sm leading-relaxed text-gray-400">
        This zone is still waiting for price. Subscribers got the entry, stop and all
        three targets the day it published — in time to place the order.
      </p>

      <a
        href={checkoutUrl('screener_monthly', 'locked_zone')}
        className="inline-block rounded bg-[#f5a623] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
      >
        Unlock the levels
      </a>
    </div>
  )
}

export function DemoZonesTable({
  zones,
  featuredId,
  onZoneSelect,
  selectedId,
}: DemoZonesTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (zones.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-gray-400">
        No zones published yet. The scanner runs once a day, just after 00:02 UTC.
      </p>
    )
  }

  const toggle = (zone: PublicZone) => {
    setExpanded((cur) => (cur === zone.id ? null : zone.id))
    onZoneSelect?.(zone)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
            <th className="px-3 py-2 font-medium">Symbol</th>
            <th className="px-3 py-2 font-medium">TF</th>
            <th className="px-3 py-2 font-medium">Side</th>
            <th className="px-3 py-2 text-right font-medium">Entry</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">R:R</th>
            <th className="hidden px-3 py-2 text-center font-medium lg:table-cell">Conf</th>
            <th className="hidden px-3 py-2 text-center font-medium xl:table-cell">Vol</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Age</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => {
            const isOpen = expanded === zone.id
            const age = daysSince(zone.fired_at)
            const isFeatured = zone.id === featuredId
            const isSelected = zone.id === selectedId

            return (
              <Fragment key={zone.id}>
                <tr
                  onClick={() => toggle(zone)}
                  className={`cursor-pointer border-b border-gray-900 transition-colors hover:bg-gray-900/60 ${
                    isSelected ? 'bg-gray-900' : ''
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-white">{zone.symbol.replace(/USDT$/, '')}</span>
                    {isFeatured && (
                      <span className="ml-2 text-xs text-[#f5a623]" title="Shown on the chart">
                        on chart
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-gray-400">{zone.timeframe}</td>
                  <td className="px-3 py-2.5">
                    <span className={zone.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                      {zone.direction === 'long' ? 'Long' : 'Short'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <EntryCell zone={zone} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-right font-mono text-white sm:table-cell">
                    {zone.rr.toFixed(2)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-center lg:table-cell">
                    <ConfluenceBadge band={zone.confluence_band} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-center xl:table-cell">
                    <VolumeBadge setup={{ volume_node: zone.volume_node }} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-right font-mono text-gray-400 sm:table-cell">
                    {age === null ? '—' : `${age}d`}
                  </td>
                  <td className="px-3 py-2.5">
                    <OutcomeBadge
                      setup={{
                        outcome: zone.outcome,
                        invalidation_reason: zone.invalidation_reason,
                      }}
                    />
                  </td>
                </tr>

                {isOpen && (
                  <tr className="border-b border-gray-900 bg-gray-950">
                    <td colSpan={9}>
                      {isUnlocked(zone) ? (
                        <TradePlan setup={toDojoSetup(zone)} />
                      ) : (
                        <LockedPlan zone={zone} />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {zones.some((z) => z.outcome === 'invalidated') && (
        <p className="max-w-prose px-3 py-3 text-xs leading-relaxed text-gray-500">
          A zone marked invalid stopped being tradeable before price ever reached the
          entry — the swing it was measured from re-anchored, the gap that validated it
          was filled, or structure turned against it. Hover the badge for which one. No
          order was ever filled, so it is not a loss and is not counted as one.
        </p>
      )}
    </div>
  )
}
