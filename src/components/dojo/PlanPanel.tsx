/**
 * One Dojo plan, shown beside its chart.
 *
 * WHY THIS EXISTS
 *
 * A plan used to live in two halves: the levels were drawn on the chart, and
 * the status, reasoning and history sat in an expanded table row somewhere
 * else — or nowhere, when the plan was opened from an alert. On a phone the
 * chart drawer covered the row entirely. Following a plan meant reassembling
 * it by hand.
 *
 * So wherever a plan is opened — a Dojo row, an alert, a shared link — it
 * arrives here, above the chart that draws it, with the same content in the
 * same order: what it is and whether it is still live, how far price is from
 * it, the levels, why it qualified, and what happened last.
 */
import { useEffect, useState } from 'react'
import { Check, Crosshair, Link2, X } from 'lucide-react'
import { DojoTimeline } from './DojoTimeline'
import { OutcomeBadge, ConfluenceBadge } from './DojoSetupsTable'
import { planRows, latestPlanEvent, planLink } from './planModel'
import {
  DOJO_OUTCOME_META,
  distanceToEntry,
  distanceIsLive,
  type DojoSetup,
} from '@/types/dojo'

/** Per-viewer preference, so a collapsed panel stays collapsed. */
const COLLAPSED_KEY = 'plan-panel-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export interface PlanPanelProps {
  setup: DojoSetup
  /** Current price, when the symbol is tracked. Omitted for a placeholder. */
  livePrice?: number
  hasPlanDetails: boolean
  /** Frame the chart on the plan's candles. */
  onFocusChart?: () => void
  /** Close the plan (and with it the chart selection). */
  onClose?: () => void
}

export function PlanPanel({ setup, livePrice, hasPlanDetails, onFocusChart, onClose }: PlanPanelProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Only the preference is lost.
    }
  }, [collapsed])

  // A new plan starts with fresh copy feedback.
  useEffect(() => setCopy('idle'), [setup.id])

  useEffect(() => {
    if (copy === 'idle') return
    const id = window.setTimeout(() => setCopy('idle'), 2500)
    return () => window.clearTimeout(id)
  }, [copy])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(planLink(setup.id))
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  const isLong = setup.direction === 'long'
  const dist = distanceToEntry(setup, livePrice)
  const latest = latestPlanEvent(setup)
  const rows = planRows(setup, hasPlanDetails)

  // The one-line answer to "where does this stand", in the plan's own terms.
  const standing =
    setup.outcome === 'unfilled' && dist !== null
      ? `Price must ${isLong ? 'fall' : 'rally'} ${Math.abs(dist).toFixed(1)}% to reach the entry` +
        (distanceIsLive(livePrice) ? '' : ' (from the close when published)')
      : DOJO_OUTCOME_META[setup.outcome].hint

  const actionClass =
    'inline-flex h-9 items-center gap-1.5 rounded border border-gray-600 px-2.5 text-xs text-gray-200 transition-colors hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

  return (
    <section aria-label={`${setup.symbol} plan`} className="border-b border-gray-700">
      {/* Identity and standing — always visible, even collapsed. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-3 pt-3 md:px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{setup.symbol}</h3>
            <span className={`text-sm font-medium ${isLong ? 'text-green-400' : 'text-red-400'}`}>
              {isLong ? 'Long' : 'Short'}
            </span>
            <span className="text-sm uppercase text-gray-300">{setup.timeframe}</span>
            <OutcomeBadge setup={setup} />
          </div>
          <p className="mt-1 text-sm text-gray-300">{standing}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            Latest: <span className="text-gray-200">{latest.label}</span> · {formatDay(latest.at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onFocusChart && (
            <button type="button" onClick={onFocusChart} className={actionClass} title="Frame the chart on this plan, from the day it was published">
              <Crosshair className="h-3.5 w-3.5" aria-hidden />
              Focus
            </button>
          )}
          <button type="button" onClick={handleCopy} className={actionClass} aria-live="polite">
            {copy === 'copied' ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
            ) : (
              <Link2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {copy === 'copied' ? 'Link copied' : copy === 'failed' ? 'Copy failed' : 'Copy link'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white"
              aria-label="Close plan"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="mx-3 mt-2 mb-1 text-xs text-accent hover:text-accent-light md:mx-4"
      >
        {collapsed ? 'Show plan details' : 'Hide plan details'}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 md:px-4">
          <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {rows.map(([label, value, hint]) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <span className="whitespace-nowrap text-gray-400" title={hint}>
                  {label}
                </span>
                <span className="text-right font-mono text-gray-100">{value}</span>
              </div>
            ))}
          </div>

          {/* Why it qualified. The band is everyone's; what it was rated on
              (the backings) is plan detail. */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-700/50 pt-3">
            <span className="text-xs text-gray-400">Why it qualified</span>
            <ConfluenceBadge band={setup.confluence_band} />
            {hasPlanDetails ? (
              setup.backings.map((b) => (
                <span key={b} className="rounded bg-gray-700/60 px-2 py-0.5 font-mono text-xs text-gray-200">
                  {b}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400">
                The levels behind the rating are part of Pro.
              </span>
            )}
          </div>

          <details className="mt-3 border-t border-gray-700/50 pt-2">
            <summary className="cursor-pointer text-xs font-medium text-gray-300 hover:text-white">
              Full timeline
            </summary>
            <DojoTimeline setup={setup} />
          </details>
        </div>
      )}
    </section>
  )
}
