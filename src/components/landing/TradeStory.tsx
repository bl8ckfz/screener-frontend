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
 *
 * A row that has not resolved yet is told too, as far as it can be: published
 * on a date, graded, with a plan that exists and is withheld. That version
 * ends at the paywall rather than at an outcome, because the outcome has not
 * happened — which is exactly the thing being sold.
 */
import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { usePublicDemo } from '@/hooks/usePublicDemo'
import { pageZone, type PublicZone, type UnlockedZone } from '@/types/publicDemo'
import { formatDojoPrice } from '@/types/dojo'
import { checkoutUrl } from '@/config/checkout'

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

interface Step {
  when: string
  title: string
  body: ReactNode
}

/** The numbered sequence. Shared, so both tellings are visibly the same thing. */
function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-10 space-y-8">
      {steps.map((step, i) => (
        <li key={step.title} className="grid gap-x-6 gap-y-1 sm:grid-cols-[9rem_1fr]">
          <div className="font-mono text-sm text-gray-500">
            <span className="mr-2 text-gray-700">{i + 1}</span>
            {step.when}
          </div>
          <div>
            <h3 className="font-medium text-white">{step.title}</h3>
            <div className="mt-1.5 max-w-prose text-sm leading-relaxed text-gray-400">
              {step.body}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        What you are looking at
      </h2>
      <p className="mt-3 max-w-prose text-gray-400">{children}</p>
    </>
  )
}

/**
 * The still-open version of the story.
 *
 * Everything here comes off the locked payload — fired_at, direction,
 * confluence, R:R — so nothing is invented and nothing is a placeholder for a
 * number the server withheld. The masked rows are the same labels the table's
 * locked row uses, deliberately: the visitor should recognise that they are
 * being shown the shape of a real plan, not a marketing paragraph about one.
 */
function OpenStory({ zone }: { zone: PublicZone }) {
  const side = zone.direction === 'long' ? 'demand' : 'supply'
  const symbol = zone.symbol.replace(/USDT$/, '')
  const masked = ['Entry', 'Stop loss', 'Target 1', 'Target 2', 'Target 3']

  const steps: Step[] = [
    {
      when: formatDay(zone.fired_at),
      title: `The scanner published a ${side} zone on ${symbol}`,
      body: `It cleared the bar to publish: a live imbalance sitting on the area, agreement from a higher timeframe, and market structure pointing the same way. Confluence graded ${zone.confluence_band.toLowerCase()}.`,
    },
    {
      when: 'Same day',
      title: 'The plan came with it — and this is the part you buy',
      body: (
        <>
          <p>
            A resting limit inside the zone, an invalidation beyond it and three targets,
            at {zone.rr.toFixed(2)} reward for every unit risked. Subscribers got all five
            numbers the day it published, in time to place the order.
          </p>
          <dl className="mt-3 max-w-xs space-y-1.5">
            {masked.map((label) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt>{label}</dt>
                <dd className="inline-flex items-center gap-1.5 text-gray-600">
                  <Lock size={11} aria-hidden="true" />
                  <span className="font-mono tracking-widest">•••••</span>
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4">
              <dt>Risk/reward</dt>
              <dd className="font-mono text-white">{zone.rr.toFixed(2)}</dd>
            </div>
          </dl>
          <a
            href={checkoutUrl('screener_monthly', 'trade_story')}
            className="mt-4 inline-block rounded bg-[#f5a623] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
          >
            Unlock the levels
          </a>
        </>
      ),
    },
    {
      when: 'Right now',
      title:
        zone.outcome === 'open' ? 'Filled, and running' : 'Waiting for price to come back',
      body:
        zone.outcome === 'open'
          ? 'The limit filled and the trade is live, so how it ends is not written yet. It will be logged here either way.'
          : 'Most of the work is waiting. The order sits there until price returns to the area, which can take weeks — and sometimes never happens at all, in which case nothing is risked and nothing is lost.',
    },
    {
      when: 'Then',
      title: 'Whatever happens, it gets recorded',
      body: 'Target, stop or retired untraded — it stays on this page with its dates, exactly as the closed ones above do. That is the only reason to believe the winners.',
    },
  ]

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <Heading>
        The {symbol} zone you picked, on the chart above. It has not resolved yet, so this
        is as much of it as there is to tell — the levels are the part subscribers paid
        for. Pick a closed row in the list to read one all the way through.
      </Heading>
      <Steps steps={steps} />
    </section>
  )
}

/** The closed version: a trade with an ending, told with its real numbers. */
function ClosedStory({ zone }: { zone: UnlockedZone }) {
  const side = zone.direction === 'long' ? 'demand' : 'supply'
  const symbol = zone.symbol.replace(/USDT$/, '')

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

  const steps: Step[] = [
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
      <Heading>
        The {symbol} zone drawn on the chart above, from the day it published to the day
        it closed{daysToResolve !== null && ` — ${daysToResolve} days`}. Pick another row
        in the list to read that one instead.
      </Heading>
      <Steps steps={steps} />
    </section>
  )
}

export function TradeStory({ selected = null }: TradeStoryProps) {
  const { data } = usePublicDemo()
  const page = pageZone(data, selected)

  // Nothing to point at yet: say nothing rather than inventing an example. A
  // fabricated worked example on a page selling a track record would be the
  // one lie that discredits everything else on it.
  if (!page) return null

  // A locked row gets the open telling, never the closed one padded out with
  // another trade's numbers.
  return page.plan ? <ClosedStory zone={page.plan} /> : <OpenStory zone={page.zone} />
}
