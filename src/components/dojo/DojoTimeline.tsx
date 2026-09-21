/**
 * What has happened to a plan, from publication to wherever it got to.
 *
 * WHY THIS NEEDS NO NEW STORAGE
 *
 * Every event is already on the setup row. dojo_setups records the life of a
 * zone as four nullable timestamps — entry_hit_at, tp1_hit_at, sl_hit_at,
 * invalidated_at — plus fired_at and a reason. The information was never
 * missing; it was only ever scattered across a table, a chart and an alert
 * feed, so following one plan meant reconstructing it by hand across tabs.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not invent a sequence. An event with no timestamp is not drawn, and
 * a step that has not happened is shown as still open rather than as failed.
 * The distinction matters most at the end: a zone that was never filled is
 * neither a win nor a loss, and a timeline that rendered it as a stop would be
 * making a claim the data does not support.
 *
 * It also does not claim precision it lacks. Settlement replays DAILY candles
 * once a day, so a fill is known to the day and not to the minute, and a
 * candle that touched both the target and the stop is resolved to the stop.
 * Both are stated rather than left for the reader to assume.
 */

import type { DojoSetup } from '@/types/dojo'
import { DOJO_INVALIDATION_HINT, formatDojoPrice } from '@/types/dojo'
import type { DojoInvalidationReason } from '@/types/dojo'

interface DojoTimelineProps {
  setup: DojoSetup
}

interface Step {
  key: string
  mark: string
  label: string
  at?: string
  detail?: string
  tone: string
}

/** A date at the precision the record actually has. */
function formatWhen(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function DojoTimeline({ setup }: DojoTimelineProps) {
  const steps: Step[] = []

  steps.push({
    key: 'published',
    mark: '🥋',
    label: 'Plan published',
    at: formatWhen(setup.fired_at),
    detail: `${setup.timeframe.toUpperCase()} ${setup.direction === 'long' ? 'long' : 'short'}, entry ${formatDojoPrice(setup.entry)}`,
    tone: 'text-accent',
  })

  if (setup.entry_hit_at) {
    steps.push({
      key: 'filled',
      mark: '✅',
      label: 'Entry reached',
      at: formatWhen(setup.entry_hit_at),
      detail: `Price reached ${formatDojoPrice(setup.entry)}. A resting limit placed when the zone armed would be filled here.`,
      tone: 'text-emerald-300',
    })
  }

  if (setup.tp1_hit_at) {
    steps.push({
      key: 'target',
      mark: '🏁',
      label: 'First target reached',
      at: formatWhen(setup.tp1_hit_at),
      detail: `Price reached ${formatDojoPrice(setup.tp1)}.`,
      tone: 'text-emerald-300',
    })
  }

  if (setup.sl_hit_at) {
    steps.push({
      key: 'stop',
      mark: '🛑',
      label: 'Stop taken',
      at: formatWhen(setup.sl_hit_at),
      detail: `Price reached ${formatDojoPrice(setup.stop_loss)}.`,
      tone: 'text-red-300',
    })
  }

  if (setup.invalidated_at) {
    const reason = setup.invalidation_reason as DojoInvalidationReason | undefined
    steps.push({
      key: 'invalidated',
      mark: '⌛',
      label: setup.entry_hit_at ? 'Thesis expired while open' : 'Zone invalidated',
      at: formatWhen(setup.invalidated_at),
      detail:
        (reason && DOJO_INVALIDATION_HINT[reason]) ??
        'The setup stopped being one the method would offer.',
      // Grey, not red. An unfilled zone that died is not a losing trade.
      tone: 'text-gray-400',
    })
  }

  // What is still ahead, when the plan has not finished. Shown as OPEN rather
  // than omitted, so "waiting" is visibly different from "over".
  const resolved = Boolean(setup.tp1_hit_at || setup.sl_hit_at)
  const dead = Boolean(setup.invalidated_at) && !setup.entry_hit_at
  if (!resolved && !dead) {
    steps.push({
      key: 'pending',
      mark: '⋯',
      label: setup.entry_hit_at ? 'Waiting on the target or the stop' : 'Waiting for price to reach the entry',
      detail: setup.entry_hit_at
        ? `Target ${formatDojoPrice(setup.tp1)}, stop ${formatDojoPrice(setup.stop_loss)}.`
        : `The entry is a resting limit at ${formatDojoPrice(setup.entry)}. Price may never reach it, which is neither a win nor a loss.`,
      tone: 'text-gray-500',
    })
  }

  return (
    <div className="mt-3">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        What has happened
      </h4>

      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.key} className="flex gap-2 text-xs">
            <span className={`mt-px shrink-0 ${step.tone}`} aria-hidden>
              {step.mark}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={`font-medium ${step.tone}`}>{step.label}</span>
                {step.at && <span className="font-mono text-[10px] text-gray-500">{step.at}</span>}
              </div>
              {step.detail && <p className="mt-0.5 text-gray-400">{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>

      {/* The limits of the record, stated with it rather than left to be
          assumed. A reader who sees a date will otherwise take it as exact. */}
      <p className="mt-2 border-t border-gray-700/60 pt-2 text-[10px] leading-relaxed text-gray-600">
        Outcomes are settled once a day against daily candles, so these dates are
        accurate to the day rather than the minute. A candle that touched both the
        target and the stop is recorded as the stop, because a daily candle carries
        no intraday ordering.
      </p>
    </div>
  )
}
