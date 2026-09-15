/**
 * One real trade, told in order.
 *
 * This is the page's one piece of teaching, and it is deliberately built from
 * the SAME payload the panel above it renders — so the numbers in this prose
 * can never drift from the chart, and it goes stale only when the product does.
 *
 * It is numbered because it genuinely is a sequence: a zone is published, price
 * takes days or weeks to arrive, and only then does the trade exist. That gap
 * is the single hardest thing to explain about the method and the easiest to
 * show, because the dates carry it.
 *
 * It re-tells whichever zone the visitor selects in the panel, so the list is
 * four rows of things to read rather than four rows to scroll past.
 */
import { usePublicDemo } from '@/hooks/usePublicDemo'
import { drawnZone, type PublicZone } from '@/types/publicDemo'
import { formatDojoPrice } from '@/types/dojo'

interface TradeStoryProps {
  /**
   * The row the visitor clicked in the panel, if any. Resolved through the
   * same helper the chart uses, so this section can never narrate a zone
   * other than the one drawn above it.
   */
  selected?: PublicZone | null
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function TradeStory({ selected = null }: TradeStoryProps) {
  const { data } = usePublicDemo()
  const zone = drawnZone(data, selected)

  // Nothing resolved yet: say so rather than inventing an example. A fabricated
  // worked example on a page selling a track record would be the one lie that
  // discredits everything else on it.
  if (!zone) return null

  const side = zone.direction === 'long' ? 'demand' : 'supply'
  const symbol = zone.symbol.replace(/USDT$/, '')

  /**
   * The visitor picked a row whose trade has not happened yet.
   *
   * drawnZone silently fell back to the featured zone, which without a word
   * of explanation reads as a broken click. Naming the row acknowledges it and
   * restates the thing the page is actually selling: the levels on a live zone
   * are the part you pay for, and its outcome does not exist yet either.
   */
  const pending = selected && selected.locked ? selected.symbol.replace(/USDT$/, '') : null

  /**
   * Whether price ever reached the resting limit.
   *
   * Read from entry_hit_at, never inferred from the outcome. An invalidated
   * zone and a stopped one are both "closed", and guessing between them is how
   * this section previously came to claim a zone had "filled, then stopped out"
   * when price had not once traded into it.
   */
  const filled = !!zone.entry_hit_at

  /** Days from publication to whatever ended the zone. */
  const daysToResolve = (() => {
    const end = zone.tp1_hit_at ?? zone.sl_hit_at ?? zone.invalidated_at
    if (!end) return null
    const days = Math.round(
      (Date.parse(end) - Date.parse(zone.fired_at)) / 86_400_000,
    )
    return Number.isFinite(days) && days >= 0 ? days : null
  })()

  const waiting = filled
    ? {
        when: zone.entry_hit_at ? formatDay(zone.entry_hit_at) : 'Then, eventually',
        title: 'Price came back and the limit filled',
        body: 'Most of the work is waiting. The order sits there until price returns to the area, which can take days or weeks — and often never happens at all.',
      }
    : {
        when: 'Then, nothing',
        title: 'Price never came back',
        body: 'The order sat unfilled. That is the ordinary case, not a failure: the entry is a limit inside the zone, and price is under no obligation to return to it.',
      }

  const ending = (() => {
    if (zone.outcome === 'target') {
      return {
        when: zone.tp1_hit_at ? formatDay(zone.tp1_hit_at) : 'Later',
        title: `Ran to the first target at ${formatDojoPrice(zone.tp1)}`,
        body: `${zone.rr.toFixed(2)} times the amount risked, logged against the zone that called it.`,
      }
    }
    if (zone.outcome === 'stopped') {
      return {
        when: zone.sl_hit_at ? formatDay(zone.sl_hit_at) : 'Later',
        title: `Stopped out at ${formatDojoPrice(zone.stop_loss)}`,
        body: 'One unit of risk, lost. It stays on the page exactly as a winner does — that is the only reason to believe the winners.',
      }
    }
    return {
      when: zone.invalidated_at ? formatDay(zone.invalidated_at) : 'Later',
      title: 'Retired without ever being traded',
      body: 'The reason it qualified stopped being true — the swing it was measured from re-anchored, the gap that validated it filled, or structure turned against it. Nothing was risked, so it is neither a win nor a loss, and it is counted as neither.',
    }
  })()

  const steps = [
    {
      when: formatDay(zone.fired_at),
      title: `The scanner published a ${side} zone on ${symbol}`,
      body: `It cleared the bar to publish: a live imbalance sitting on the area, agreement from a higher timeframe, and market structure pointing the same way. Confluence graded ${zone.confluence_band.toLowerCase()}.`,
    },
    {
      when: 'Same day',
      title: `The plan came with it — entry ${formatDojoPrice(zone.entry)}, stop ${formatDojoPrice(zone.stop_loss)}`,
      body: `Not "watch this level". A resting limit inside the zone, an invalidation below it, and three targets, at ${zone.rr.toFixed(2)} reward for every unit risked. You place the order and stop watching.`,
    },
    waiting,
    ending,
  ]

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        What you are looking at
      </h2>
      <p className="mt-3 max-w-prose text-gray-400">
        The {symbol} zone drawn on the chart above, from the day it published to the day
        it closed{daysToResolve !== null && ` — ${daysToResolve} days`}. Pick any closed
        row in the list to read that one instead.
      </p>
      {pending && (
        <p className="mt-2 max-w-prose text-sm text-gray-500">
          The {pending} row you picked is still waiting on price — nothing has happened to
          it yet, so there is no story to tell. This is the closed one.
        </p>
      )}

      <ol className="mt-10 space-y-8">
        {steps.map((step, i) => (
          <li key={step.title} className="grid gap-x-6 gap-y-1 sm:grid-cols-[9rem_1fr]">
            <div className="font-mono text-sm text-gray-500">
              <span className="mr-2 text-gray-700">{i + 1}</span>
              {step.when}
            </div>
            <div>
              <h3 className="font-medium text-white">{step.title}</h3>
              <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-gray-400">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
