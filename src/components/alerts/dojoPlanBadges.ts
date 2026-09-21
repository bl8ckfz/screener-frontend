/**
 * Turning a coin's live Dojo plans into pinned badges for the alert table.
 *
 * Pure, so the rules below can be tested without mounting anything.
 *
 * # WHAT THESE SAY THAT THE ALERT BADGES CANNOT
 *
 * The badges beside these are alert TYPES: a record that something fired, built
 * from a 48-hour read of a table kept for seven days. A Dojo plan outlives both
 * — a weekly zone can wait months for price — so once its "zone armed" alert
 * ages out, nothing in that row says the coin has a plan at all, however live
 * the plan is.
 *
 * These come from dojo_setups instead, which has no retention, and they are
 * present for exactly as long as the plan is in play. They appear when it is
 * published and disappear when it reaches a target, a stop, or invalidation.
 */

import type { DojoSetup } from '@/types/dojo'
import type { PinnedBadge } from './AlertBadges'

/** How many plans a single coin shows before they are summarised. */
const MAX_PINNED = 3

/**
 * Direction colours, matched to the app's bull and bear defaults rather than to
 * the per-rule palette.
 *
 * Deliberately NOT read from the user's alert colour settings: those are keyed
 * on rule types, and a plan is not an alert. Its badge should stay legible as
 * the thing it is even when someone has recoloured the alert that announced it.
 */
const LONG_COLOR = '#22c55e'
const SHORT_COLOR = '#ef4444'

/** A plan's timeframe, as it reads in a 24px circle. */
function timeframeText(tf: string): string {
  const t = tf.toUpperCase()
  return t === '1W' || t === '5D' || t === '1D' ? t : t.slice(0, 2)
}

function planTitle(s: DojoSetup): string {
  const side = s.direction === 'long' ? 'long' : 'short'
  const waiting = s.outcome === 'unfilled'
  const state = waiting
    ? 'waiting for price to reach the entry — nothing risked yet'
    : 'in the trade — running to its target or its stop'
  return `Dojo ${s.timeframe.toUpperCase()} ${side}: ${state}. Click to open the plan.`
}

/**
 * Builds the pinned badges for one coin's live plans.
 *
 * onOpen is optional so the badges still render where nothing can be opened,
 * such as a read-only view.
 */
export function dojoPlanBadges(
  setups: DojoSetup[] | undefined,
  onOpen?: (setupId: string) => void
): PinnedBadge[] {
  if (!setups?.length) return []

  const shown = setups.slice(0, MAX_PINNED)
  const badges: PinnedBadge[] = shown.map((s) => ({
    key: s.id,
    text: timeframeText(s.timeframe),
    title: planTitle(s),
    color: s.direction === 'long' ? LONG_COLOR : SHORT_COLOR,
    // A running trade is emphasised over a waiting one. The difference is
    // whether the user has money at risk right now, which is the single most
    // useful thing this row can tell them at a glance.
    emphasised: s.outcome === 'open',
    onClick: onOpen ? () => onOpen(s.id) : undefined,
  }))

  // More plans than fit. Counted rather than dropped, because the point of
  // these badges is that a plan does not silently vanish from the row.
  const hidden = setups.length - shown.length
  if (hidden > 0) {
    badges.push({
      key: 'dojo-more',
      text: `+${hidden}`,
      title: `${hidden} more Dojo ${hidden === 1 ? 'plan' : 'plans'} in play on this coin. Open the Dojo tab to see them all.`,
      color: '#4b5563',
    })
  }

  return badges
}
