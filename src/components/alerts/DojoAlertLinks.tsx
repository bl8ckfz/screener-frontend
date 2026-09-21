/**
 * The Dojo alerts inside one coin's alert row, each opening its own plan.
 *
 * WHY THIS EXISTS
 *
 * The alert table shows one row per SYMBOL, aggregating everything that fired
 * on it. That is the right shape for momentum alerts, which are a stream and
 * are interesting in bulk. It is the wrong shape for a Dojo alert, which is
 * about one specific published plan — and a symbol routinely carries two, a
 * long and a short on different timeframes, so the row it sits in cannot say
 * which.
 *
 * Clicking the row opened the coin chart and cleared any zone overlay, so an
 * alert reading "price entered the zone" led to a chart with no zone on it.
 * These chips are the missing link: one per Dojo event, each carrying the
 * setup id the backend already sends.
 */

import type { AlertHistoryEntry } from '@/types/alertHistory'
import type { DojoAlertContext } from '@/types/alert'

interface DojoAlertLinksProps {
  alerts: AlertHistoryEntry[]
  onOpenSetup: (setupId: string) => void
  /** The setup currently open, so its chip can show as selected. */
  activeSetupId?: string | null
}

/** What each moment in a zone's life is called, and how it reads at a glance. */
const EVENT_META: Record<
  NonNullable<DojoAlertContext['event']>,
  { label: string; mark: string; tone: string }
> = {
  zone_armed: { label: 'Zone armed', mark: '🥋', tone: 'text-accent border-accent/40' },
  zone_entered: { label: 'Zone entered', mark: '🎯', tone: 'text-amber-300 border-amber-400/40' },
  entry_filled: { label: 'Entry filled', mark: '✅', tone: 'text-emerald-300 border-emerald-400/40' },
  target_hit: { label: 'Target reached', mark: '🏁', tone: 'text-emerald-300 border-emerald-400/40' },
  stop_hit: { label: 'Stop taken', mark: '🛑', tone: 'text-red-300 border-red-400/40' },
  // Grey, and deliberately not the loss colour. The zone never filled, so this
  // is not a losing trade — it is a plan that stopped being a plan.
  zone_invalidated: { label: 'Invalidated', mark: '⌛', tone: 'text-gray-400 border-gray-600' },
}

export function DojoAlertLinks({ alerts, onOpenSetup, activeSetupId }: DojoAlertLinksProps) {
  // Newest first, one chip per setup. A zone that armed, was entered and then
  // filled produced three alerts about ONE plan, and three identical chips
  // would be noise — the most recent event is the one worth showing.
  const bySetup = new Map<string, AlertHistoryEntry>()
  for (const a of [...alerts].sort((x, y) => y.timestamp - x.timestamp)) {
    if (!a.dojo?.setupId) continue
    if (!bySetup.has(a.dojo.setupId)) bySetup.set(a.dojo.setupId, a)
  }

  if (bySetup.size === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {Array.from(bySetup.values()).map((alert) => {
        const ctx = alert.dojo as DojoAlertContext
        const meta = ctx.event ? EVENT_META[ctx.event] : undefined
        const isActive = activeSetupId === ctx.setupId

        const parts = [
          ctx.timeframe?.toUpperCase(),
          ctx.direction === 'long' ? 'Long' : ctx.direction === 'short' ? 'Short' : undefined,
        ].filter(Boolean)

        return (
          <button
            key={ctx.setupId}
            type="button"
            // The row itself is a button, so this must not also trigger it —
            // otherwise opening the plan would immediately be overwritten by
            // the row handler selecting the coin and clearing the overlay.
            onClick={(e) => {
              e.stopPropagation()
              onOpenSetup(ctx.setupId)
            }}
            title={
              ctx.invalidationReason
                ? `${meta?.label ?? 'Dojo plan'} — ${ctx.invalidationReason.replace(/_/g, ' ')}. Opens this exact plan.`
                : `${meta?.label ?? 'Dojo plan'} — opens this exact plan, not just the coin.`
            }
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium transition hover:bg-gray-700/60 ${
              meta?.tone ?? 'text-gray-300 border-gray-600'
            } ${isActive ? 'bg-gray-700/80 ring-1 ring-accent' : 'bg-gray-800/60'}`}
          >
            <span aria-hidden>{meta?.mark ?? '🥋'}</span>{' '}
            {meta?.label ?? 'Dojo plan'}
            {parts.length > 0 && <span className="text-gray-500"> · {parts.join(' ')}</span>}
          </button>
        )
      })}
    </div>
  )
}
