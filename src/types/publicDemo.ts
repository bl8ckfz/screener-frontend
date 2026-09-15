/**
 * The landing page's data: Dojo zones as served to someone who has not paid.
 *
 * WHY THIS IS A SEPARATE TYPE FROM DojoSetup
 *
 * A subscriber has bought the levels; a visitor has not. So for a zone that is
 * still LIVE the backend omits every price from the payload — they are not in
 * the response at all, which means they are not in the network tab either.
 * A zone that has RESOLVED ships in full: the trade is over, there is nothing
 * left to protect, and those rows are the track record that makes the locked
 * ones worth paying for.
 *
 * The union below is how that contract is enforced on this side. Reading
 * `zone.entry` without first narrowing on `locked === false` is a COMPILE
 * ERROR, so "don't render a locked level" stops being a review convention and
 * becomes something `npm run type-check` decides.
 *
 * The alternative — widening DojoSetup's levels to optional — was rejected:
 * entry, stop_loss and tp1..3 are read unguarded throughout the paying app
 * (DojoSetupsTable, TradingChart, stopRiskPct), so making them optional would
 * either break those call sites or, worse, let `undefined` render silently in
 * a subscriber's trade plan.
 */
import type { DojoSetup, DojoOutcome, ConfluenceBand, VolumeNode, DojoInvalidationReason } from '@/types/dojo'

/** Fields every public zone carries, locked or not. */
interface PublicZoneBase {
  id: string
  fired_at: string
  symbol: string
  timeframe: string
  direction: 'long' | 'short'
  rule_type: string

  /**
   * Served even when locked. A ratio names no price, and it is most of what
   * makes a locked row worth wanting.
   */
  rr: number
  confluence_band: ConfluenceBand
  backings: string[]
  volume_node?: VolumeNode

  outcome: DojoOutcome
  invalidation_reason?: DojoInvalidationReason
}

/**
 * A zone still waiting on price, or filled and running. Every level is absent.
 *
 * Note that `otz_low`/`otz_high` are absent too. The entry sits at a fixed
 * ratio inside that band, and the resolved zones — which are public — are a
 * free calibration set for solving that ratio. Publishing the band on a live
 * zone would therefore hand over the entry.
 */
export interface LockedZone extends PublicZoneBase {
  locked: true
}

/** A zone that is over. The whole plan is public. */
export interface UnlockedZone extends PublicZoneBase {
  locked: false
  trigger_price: number
  otz_low: number
  otz_high: number
  entry: number
  stop_loss: number
  tp1: number
  tp2: number
  tp3: number
  best_level?: number
}

export type PublicZone = LockedZone | UnlockedZone

/** One chartable symbol, with the daily series the backend already stores. */
export interface PublicDemoSymbol {
  symbol: string
  price: number
  /** 'ticker' when live, 'candle_close' when the ticker cache was cold. */
  price_source: 'ticker' | 'candle_close'
  /** [timeSec, open, high, low, close, volume] — seconds, not milliseconds. */
  candles: Array<[number, number, number, number, number, number]>
}

/**
 * Counts, never a rate.
 *
 * Deliberately no hit rate. With a handful of resolved zones any percentage is
 * noise, and a win rate is the wrong statistic for a high-R method anyway — at
 * 3:1 a 40% rate is profitable, so publishing it would argue against the
 * product using its own numbers. `invalidated` is the interesting one: those
 * are zones retired before price ever arrived, which are not losses but trades
 * nobody took.
 */
export interface PublicDemoStats {
  total: number
  waiting: number
  open: number
  target: number
  stopped: number
  invalidated: number
}

export interface PublicDemoResponse {
  generated_at: string
  /** The zone the chart draws. Always resolved, so always unlocked. */
  featured_id?: string
  zones: PublicZone[]
  symbols: PublicDemoSymbol[]
  stats: PublicDemoStats
  /** What a locked row withholds, so the UI copy cannot drift from the server. */
  locked_fields: string[]
  /** True when the payload was assembled without its data sources. */
  degraded?: boolean
}

/** Narrowing helper, so components read intent rather than a boolean. */
export function isUnlocked(z: PublicZone): z is UnlockedZone {
  return !z.locked
}

/**
 * Adapt a resolved zone into the shape the app's own chart and trade-plan
 * components expect.
 *
 * ONLY accepts an UnlockedZone, and that signature is the most load-bearing
 * one in this file. TradingChart renders entry, stop and targets as price
 * lines with visible axis labels — so if a locked zone could reach that prop,
 * the server-side mask would be defeated by the chart's own axis. The type
 * makes that call impossible to write.
 */
export function toDojoSetup(z: UnlockedZone): DojoSetup {
  return {
    id: z.id,
    // Not served, and deliberately so: leg_id names the swing pivots the fibs
    // were measured from. Empty rather than invented — nothing in the chart or
    // the trade plan reads it.
    leg_id: '',
    fired_at: z.fired_at,
    symbol: z.symbol,
    timeframe: z.timeframe,
    direction: z.direction,
    rule_type: z.rule_type,
    trigger_price: z.trigger_price,
    otz_low: z.otz_low,
    otz_high: z.otz_high,
    entry: z.entry,
    stop_loss: z.stop_loss,
    tp1: z.tp1,
    tp2: z.tp2,
    tp3: z.tp3,
    rr: z.rr,
    confluence_band: z.confluence_band,
    best_level: z.best_level,
    backings: z.backings,
    volume_node: z.volume_node,
    outcome: z.outcome,
    invalidation_reason: z.invalidation_reason,
  }
}

/** Find the zone the chart should draw, if the payload named one. */
export function featuredZone(data: PublicDemoResponse): UnlockedZone | null {
  if (!data.featured_id) return null
  const z = data.zones.find((z) => z.id === data.featured_id)
  return z && isUnlocked(z) ? z : null
}
