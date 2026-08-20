/**
 * Dojo confluence setups.
 *
 * A "setup" here is a ZONE BECOMING ARMED, not a price move. The scanner runs
 * once a day and publishes symbols whose Optimal Trade Zone — the fib
 * 0.62–0.79 band of the current leg — is validated by a live fair value gap,
 * carries higher-timeframe fibonacci confluence, agrees with market
 * structure, and has not yet been traded into.
 *
 * The entry is a resting limit at fib 0.705, so the actionable moment is when
 * the zone forms, not when price arrives. Being told the instant price taps
 * the zone is left to a TradingView alert on the Dojo Fib Confluence
 * indicator.
 */

/**
 * What became of a setup.
 *
 * `unfilled` is deliberately distinct from `open`: the entry is a resting
 * limit and price frequently never reaches it. Such a zone is neither a win
 * nor a loss, and folding it into either would distort any hit rate computed
 * from these rows.
 */
export type DojoOutcome = 'unfilled' | 'open' | 'target' | 'stopped'

export interface DojoSetup {
  id: string
  /** Dedup identity: one setup per leg, per timeframe, per direction. */
  leg_id: string
  fired_at: string

  symbol: string
  timeframe: string
  direction: 'long' | 'short'
  rule_type: string

  /** The last confirmed close when the zone armed — context, not a fill. */
  trigger_price: number

  /** The swing the fibonacci ladder was drawn over. */
  leg_high: number
  leg_low: number
  leg_high_time: string
  leg_low_time: string

  /** The Optimal Trade Zone: fib 0.62–0.79 of the leg. */
  otz_low: number
  otz_high: number

  /** Trade plan. Levels only — position sizing is per-user and out of scope. */
  entry: number
  stop_loss: number
  tp1: number
  tp2: number
  tp3: number
  rr: number

  /** Why it qualified. */
  confluence_score: number
  best_level?: number
  best_level_fib?: number
  backings: string[]
  atr14?: number
  /** 1 bullish, -1 bearish, 0 ranging. */
  structure_trend?: number

  entry_hit_at?: string
  tp1_hit_at?: string
  sl_hit_at?: string
  outcome: DojoOutcome
}

/** Display metadata per outcome, so the table and any summary agree. */
export const DOJO_OUTCOME_META: Record<
  DojoOutcome,
  { label: string; className: string; hint: string }
> = {
  unfilled: {
    label: 'Waiting',
    className: 'bg-gray-500/20 text-gray-300',
    hint: 'Price has not reached the entry yet — neither a win nor a loss',
  },
  open: {
    label: 'Open',
    className: 'bg-blue-500/20 text-blue-300',
    hint: 'Entry filled, still running',
  },
  target: {
    label: 'Target',
    className: 'bg-green-500/20 text-green-300',
    hint: 'TP1 reached',
  },
  stopped: {
    label: 'Stopped',
    className: 'bg-red-500/20 text-red-300',
    hint: 'Stop reached. A bar touching both levels counts as stopped, since a daily bar carries no intrabar ordering',
  },
}

/**
 * Format a price at a precision that suits its magnitude.
 *
 * Crypto spans BTC near 65000 and 1000FLOKI near 0.02, so a fixed precision
 * is wrong at one end or the other.
 */
export function formatDojoPrice(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1000) return v.toFixed(2)
  if (abs >= 1) return v.toFixed(4)
  if (abs >= 0.01) return v.toFixed(6)
  return v.toFixed(8)
}

/** How far price sits from the entry, as a signed percentage. */
export function distanceToEntry(s: DojoSetup): number | null {
  if (!s.trigger_price || !s.entry) return null
  return ((s.entry - s.trigger_price) / s.trigger_price) * 100
}
