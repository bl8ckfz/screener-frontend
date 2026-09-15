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
 */
import { usePublicDemo } from '@/hooks/usePublicDemo'
import { featuredZone } from '@/types/publicDemo'
import { formatDojoPrice, daysSince } from '@/types/dojo'

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function TradeStory() {
  const { data } = usePublicDemo()
  const zone = data ? featuredZone(data) : null

  // Nothing resolved yet: say so rather than inventing an example. A fabricated
  // worked example on a page selling a track record would be the one lie that
  // discredits everything else on it.
  if (!zone) return null

  const age = daysSince(zone.fired_at)
  const side = zone.direction === 'long' ? 'demand' : 'supply'
  const symbol = zone.symbol.replace(/USDT$/, '')

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
    {
      when: 'Then nothing, for a while',
      title: 'Price had to come back',
      body: 'The entry is a limit, so most of the work is waiting — and plenty of zones expire unfilled, which is neither a win nor a loss. That waiting is the part a signal feed cannot sell you.',
    },
    {
      when: age === null ? 'Later' : `Within ${age} days`,
      title:
        zone.outcome === 'target'
          ? `Filled, then ran to the first target at ${formatDojoPrice(zone.tp1)}`
          : `Filled, then stopped out at ${formatDojoPrice(zone.stop_loss)}`,
      body:
        zone.outcome === 'target'
          ? 'Logged against the zone that predicted it, so the record is auditable rather than remembered.'
          : 'Logged exactly like a winner is. The losses stay on the page — that is the only reason to believe the wins.',
    },
  ]

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        What you are looking at
      </h2>
      <p className="mt-3 max-w-prose text-gray-400">
        The zone on the chart above, from the day it published to the day it resolved.
      </p>

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
