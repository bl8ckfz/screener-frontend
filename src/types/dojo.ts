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
import type { Coin } from '@/types/coin'

export type DojoOutcome = 'unfilled' | 'open' | 'target' | 'stopped' | 'invalidated'

/** Why a zone was retired without ever filling. */
export type DojoInvalidationReason =
  | 'leg_reanchored'
  | 'fvg_mitigated'
  | 'structure_flipped'
  | 'no_current_leg'
  | 'expired'

/** Plain-language explanation per reason, for the row tooltip. */
export const DOJO_INVALIDATION_HINT: Record<DojoInvalidationReason, string> = {
  leg_reanchored:
    'A new swing confirmed, so the fibonacci levels here were measured from bars that no longer define the leg',
  fvg_mitigated:
    'The fair value gap that validated this zone has been filled — FVG validation was required to publish it',
  structure_flipped:
    'Market structure now disagrees with the direction, which is what the arming gate exists to refuse',
  no_current_leg:
    'This symbol no longer produces a usable leg in this direction',
  expired:
    'Structurally intact but old enough that nobody is realistically still waiting on it',
}

/** Volume-profile classification of the zone. */
export type VolumeNode = 'hvn' | 'lvn' | 'neutral'

/** Display metadata per volume node. */
export const VOLUME_NODE_META: Record<
  VolumeNode,
  { label: string; short: string; className: string; hint: string }
> = {
  hvn: {
    label: 'High volume node',
    short: 'HVN',
    className: 'bg-emerald-500/20 text-emerald-300',
    hint: 'Acceptance — buyers and sellers agreed value here before, so the zone has transacted history behind it and acts as a magnet',
  },
  lvn: {
    label: 'Low volume node',
    short: 'LVN',
    className: 'bg-orange-500/20 text-orange-300',
    hint: 'Thin — a highway. Little traded here before, so price can travel through the entry without pausing',
  },
  neutral: {
    label: 'Ordinary volume',
    short: 'MID',
    className: 'bg-gray-500/20 text-gray-300',
    hint: 'Neither a node nor a gap',
  },
}

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

  /**
   * Where the zone sits in the traded volume distribution.
   *
   * From 11-auction-market-theory: a high volume node is an area of
   * acceptance that "acts like a magnet", a low volume node is a "highway
   * where price tends to move quickly due to the lack of prior
   * transactions". Two zones with identical confluence and R:R are not
   * equally good if one sits on transacted history and the other in a vacuum.
   *
   * Optional throughout: a symbol without usable volume data has no profile,
   * and absent must not be read as "nobody traded there".
   */
  volume_node?: VolumeNode
  volume_poc_ratio?: number
  volume_percentile?: number
  volume_share?: number
  volume_poc?: number
  volume_poc_distance?: number

  entry_hit_at?: string
  tp1_hit_at?: string
  sl_hit_at?: string
  outcome: DojoOutcome
  invalidated_at?: string
  invalidation_reason?: DojoInvalidationReason
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
  // Never filled, and the thesis died first. Like 'unfilled' it is neither a
  // win nor a loss and is excluded from the hit rate — but unlike 'unfilled'
  // it will never become one, so it is styled to recede rather than invite
  // action.
  invalidated: {
    label: 'Invalidated',
    className: 'bg-gray-700/40 text-gray-500',
    hint: 'The setup stopped being tradeable before price ever reached the entry — no trade was taken',
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

/**
 * How far price must travel to reach the entry, as a signed percentage.
 *
 * Takes the CURRENT price, not the stored trigger_price. trigger_price is the
 * last confirmed close at the moment the zone armed and is never updated, so
 * computing from it answers "how far away was price when this zone formed" —
 * a question nobody is asking. On a zone published a week ago that reads as a
 * live distance while being nothing of the sort.
 *
 * Falls back to trigger_price when no live price is available, since a stale
 * number beats an empty column; callers can tell the two apart via
 * `distanceIsLive`.
 */
export function distanceToEntry(s: DojoSetup, livePrice?: number): number | null {
  const from = livePrice && livePrice > 0 ? livePrice : s.trigger_price
  if (!from || !s.entry) return null
  return ((s.entry - from) / from) * 100
}

/** Whether a distance was computed against a live price or the stored one. */
export function distanceIsLive(livePrice?: number): boolean {
  return !!livePrice && livePrice > 0
}

/** Whole days since the zone was published. */
export function daysSince(iso: string): number | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

/**
 * Build a placeholder Coin for a zone whose symbol is not in the coin list.
 *
 * The coin list is the top ~200 by 24h volume, but a Dojo zone stays in
 * dojo_setups until it fills or resolves — which can be weeks. A symbol that
 * drops out of the top 200 in the meantime silently lost its chart: the click
 * handler looked the coin up, found nothing, and returned without updating
 * anything, so the panel kept showing the previously selected coin. Nothing
 * said why.
 *
 * A placeholder fixes it because the chart only needs fullSymbol to work —
 * /api/klines proxies any Binance symbol, not just the tracked ones. What is
 * genuinely unavailable is the 24h ticker data, so those fields are zero
 * rather than invented, and `isPlaceholder` lets the UI say so instead of
 * rendering a confident 0.00%.
 *
 * livePrice is usually absent for exactly these symbols too: the Redis tickers
 * hash is written for the tracked set, so the zone's own trigger_price — the
 * close when it armed — is the honest fallback.
 */
export function coinFromDojoSetup(s: DojoSetup, livePrice?: number): Coin & { isPlaceholder: true } {
  const pair = (['USDT', 'USDC', 'USD', 'FDUSD', 'TRY'] as const).find((p) =>
    s.symbol.endsWith(p),
  )
  const base = pair ? s.symbol.slice(0, -pair.length) : s.symbol
  const price = livePrice && livePrice > 0 ? livePrice : s.trigger_price

  const zeroFib = {
    resistance1: 0, resistance0618: 0, resistance0382: 0,
    support0382: 0, support0618: 0, support1: 0, pivot: 0,
  }

  return {
    isPlaceholder: true,
    id: -1,
    symbol: base,
    fullSymbol: s.symbol,
    pair: (pair ?? 'USDT') as Coin['pair'],

    lastPrice: price,
    openPrice: price,
    highPrice: price,
    lowPrice: price,
    prevClosePrice: price,
    weightedAvgPrice: price,
    // Zero, not guessed. We have no 24h window for this symbol, and a
    // fabricated change would render as a confident green or red number.
    priceChange: 0,
    priceChangePercent: 0,

    volume: 0,
    quoteVolume: 0,
    bidPrice: 0,
    bidQty: 0,
    askPrice: 0,
    askQty: 0,
    count: 0,

    openTime: 0,
    closeTime: 0,

    indicators: {
      vcp: 0,
      priceToWeightedAvg: 0, priceToHigh: 0, lowToPrice: 0, highToLow: 0,
      askToVolume: 0, priceToVolume: 0, quoteToCount: 0, tradesPerVolume: 0,
      fibonacci: zeroFib,
      pivotToWeightedAvg: 0, pivotToPrice: 0,
      priceChangeFromWeightedAvg: 0, priceChangeFromPrevClose: 0,
      ethDominance: 0, btcDominance: 0, paxgDominance: 0,
    },

    lastUpdated: Date.parse(s.fired_at) || 0,
  }
}
