/**
 * The Dojo line for one coin in the alert table.
 *
 * # WHAT IT SHOWS, AND FROM WHERE
 *
 * Two sources, because they answer different questions and neither alone is
 * enough.
 *
 * Live plans come from dojo_setups, which has no retention. They say the coin
 * has a thesis in play right now, and they are present for exactly as long as
 * that is true. This is the part that could not come from the alert stream: a
 * weekly zone waits months for price, so its armed alert ages out of the
 * 48-hour window long before the plan resolves.
 *
 * Recent endings come from the alerts, and cover the opposite case — a plan
 * that reached its target, took its stop, or was invalidated in the last couple
 * of days. Those are no longer in play, so the live list correctly excludes
 * them, but "this coin's plan just got stopped" is worth seeing.
 *
 * Deduplicated by setup, live first. A plan that is in play is described by its
 * state, not by whatever alert happened to fire about it last.
 */

import type { AlertHistoryEntry } from '@/types/alertHistory'
import type { DojoAlertContext } from '@/types/alert'
import type { DojoSetup } from '@/types/dojo'
import type { PinnedBadge } from './AlertBadges'

/** How many chips a coin shows before the rest are counted. */
const MAX_CHIPS = 4

/** How an ended plan reads, keyed on the event that ended it. */
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

/** "1W Short" — which of a coin's plans this chip is about. */
function detailOf(timeframe?: string, direction?: string): string | undefined {
  const parts = [
    timeframe?.toUpperCase(),
    direction === 'long' ? 'Long' : direction === 'short' ? 'Short' : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : undefined
}

/** A plan in play, described by its state rather than by its last alert. */
function livePlanChip(s: DojoSetup, onOpen?: (setupId: string) => void): PinnedBadge {
  const running = s.outcome === 'open'
  return {
    key: s.id,
    mark: running ? '✅' : '🥋',
    label: running ? 'In trade' : 'Waiting',
    detail: detailOf(s.timeframe, s.direction),
    tone: running
      ? 'text-emerald-300 border-emerald-400/40'
      : 'text-accent border-accent/40',
    title: running
      ? 'The entry filled and the trade is running to its target or its stop. Click to open the plan.'
      : 'Published and waiting for price to reach the entry — nothing risked yet. Click to open the plan.',
    // Whether money is at risk right now is the most useful thing this row can
    // say at a glance, so a running trade is emphasised over a waiting one.
    emphasised: running,
    onClick: onOpen ? () => onOpen(s.id) : undefined,
  }
}

/** A plan that ended recently enough to still be in the alert window. */
function endedPlanChip(
  ctx: DojoAlertContext,
  onOpen?: (setupId: string) => void
): PinnedBadge | null {
  const meta = ctx.event ? EVENT_META[ctx.event] : undefined
  if (!meta) return null

  const why = ctx.invalidationReason
    ? ` Reason: ${ctx.invalidationReason.replace(/_/g, ' ')}.`
    : ''

  return {
    key: ctx.setupId,
    mark: meta.mark,
    label: meta.label,
    detail: detailOf(ctx.timeframe, ctx.direction),
    tone: meta.tone,
    title: `${meta.label}.${why} Click to open the plan.`,
    onClick: onOpen ? () => onOpen(ctx.setupId) : undefined,
  }
}

/**
 * Builds the Dojo chips for one coin.
 *
 * onOpen is optional so the chips still render where nothing can be opened.
 */
export function dojoChips(
  livePlans: DojoSetup[] | undefined,
  recentAlerts: AlertHistoryEntry[] | undefined,
  onOpen?: (setupId: string) => void,
  activeSetupId?: string | null
): PinnedBadge[] {
  const chips: PinnedBadge[] = []
  const seen = new Set<string>()

  // Oldest plan first. The one that has been waiting longest is the one most
  // easily forgotten, so it leads rather than sitting behind whatever armed
  // this morning.
  for (const s of livePlans ?? []) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    chips.push({ ...livePlanChip(s, onOpen), active: s.id === activeSetupId })
  }

  // Then anything that ended recently, newest first, skipping plans already
  // described above by their live state.
  const byRecency = [...(recentAlerts ?? [])].sort((a, b) => b.timestamp - a.timestamp)
  for (const a of byRecency) {
    const ctx = a.dojo
    if (!ctx?.setupId || seen.has(ctx.setupId)) continue
    const chip = endedPlanChip(ctx, onOpen)
    if (!chip) continue
    seen.add(ctx.setupId)
    chips.push({ ...chip, active: ctx.setupId === activeSetupId })
  }

  if (chips.length <= MAX_CHIPS) return chips

  // Counted rather than dropped. The point of this line is that a plan does
  // not silently vanish from the row.
  const hidden = chips.length - MAX_CHIPS
  return [
    ...chips.slice(0, MAX_CHIPS),
    {
      key: 'dojo-more',
      mark: '',
      label: `+${hidden} more`,
      tone: 'text-gray-400 border-gray-600',
      title: `${hidden} more Dojo ${hidden === 1 ? 'plan' : 'plans'} on this coin. Open the Dojo tab to see them all.`,
    },
  ]
}
