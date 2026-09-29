/**
 * What a Dojo plan says, as data — shared by every place that shows one.
 *
 * The expanded table row (TradePlan, also used by the landing demo) and the
 * panel beside the chart (PlanPanel) used to be one component. Splitting the
 * layout without splitting the wording would have let the two drift, and a
 * plan that reads differently depending on where it is opened is exactly the
 * inconsistency the panel exists to remove.
 */
import {
  VOLUME_NODE_META,
  formatDojoPrice,
  stopRiskPct,
  type DojoSetup,
} from '@/types/dojo'
import type { Candlestick } from '@/services/chartData'

/** [label, value, explanation] */
export type PlanRow = [string, string, string?]

/** The plan's levels, plus the Pro-only volume context when entitled. */
export function planRows(setup: DojoSetup, hasPlanDetails: boolean): PlanRow[] {
  const rows: PlanRow[] = [
    [
      'Zone',
      `${formatDojoPrice(setup.otz_low)} – ${formatDojoPrice(setup.otz_high)}`,
      'The whole area price has to trade back into for this setup to be live',
    ],
    ['Entry price', formatDojoPrice(setup.entry), 'The precise point inside the zone. A resting limit — set it and wait'],
    [
      'Stop',
      `${formatDojoPrice(setup.stop_loss)} (stop distance ${stopRiskPct(setup).toFixed(1)}%)`,
      'Where the setup is wrong. The percentage is the distance from the entry to the stop — not account risk. Position sizing is computed from it.',
    ],
    ['Targets', `${formatDojoPrice(setup.tp1)} / ${formatDojoPrice(setup.tp2)} / ${formatDojoPrice(setup.tp3)}`, 'Scale out across the three, or take the first and move the stop'],
    ['R:R to TP1', setup.rr.toFixed(2)],
    ['Price when published', formatDojoPrice(setup.trigger_price), 'The last confirmed close at the moment this zone was published — not a live price'],
  ]

  if (hasPlanDetails && setup.volume_node) {
    const meta = VOLUME_NODE_META[setup.volume_node]
    const ratio =
      setup.volume_poc_ratio !== undefined
        ? ` · ${(setup.volume_poc_ratio * 100).toFixed(0)}% of POC`
        : ''
    rows.push(['Volume', `${meta?.label ?? setup.volume_node}${ratio}`, meta?.hint])
  }
  if (hasPlanDetails && setup.volume_poc !== undefined) {
    rows.push(['Point of control', formatDojoPrice(setup.volume_poc), 'The price with the most traded volume in the series'])
  }

  return rows
}

/**
 * The most recent thing that happened to the plan, from its own timestamps.
 *
 * Answers "what changed" without a separate event store: the row already
 * carries one timestamp per transition, so the latest one is the answer.
 */
export function latestPlanEvent(setup: DojoSetup): { label: string; at: string } {
  const events: Array<{ label: string; at?: string }> = [
    { label: 'Published', at: setup.fired_at },
    { label: 'Entry hit', at: setup.entry_hit_at },
    { label: 'First target reached', at: setup.tp1_hit_at },
    { label: 'Stop taken', at: setup.sl_hit_at },
    {
      label: setup.entry_hit_at ? 'Thesis expired after entry' : 'Retired before entry',
      at: setup.invalidated_at,
    },
  ]
  let latest = events[0]
  let latestMs = Date.parse(setup.fired_at) || 0
  for (const e of events) {
    const ms = e.at ? Date.parse(e.at) : NaN
    if (Number.isFinite(ms) && ms >= latestMs) {
      latest = e
      latestMs = ms
    }
  }
  return { label: latest.label, at: latest.at ?? setup.fired_at }
}

/** A deep link that reopens this exact plan, via useSelectedDojoSetup's ?setup= param. */
export function planLink(setupId: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('setup', setupId)
  return url.toString()
}

/**
 * Index of the candle a plan was published in, or -1 when that candle is
 * older than the loaded series.
 *
 * The last candle opening at or before fired_at — a daily bar is stamped with
 * its open, and a zone publishes a couple of minutes after midnight UTC, so
 * that is the bar it belongs to.
 */
export function publishedCandleIndex(
  setup: Pick<DojoSetup, 'fired_at'>,
  data: Array<Pick<Candlestick, 'time'>>,
): number {
  const firedSec = Math.floor(Date.parse(setup.fired_at) / 1000)
  if (!Number.isFinite(firedSec) || data.length === 0) return -1
  if (firedSec < Number(data[0].time)) return -1
  let idx = -1
  for (let i = 0; i < data.length; i++) {
    if (Number(data[i].time) <= firedSec) idx = i
    else break
  }
  return idx
}
