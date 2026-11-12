/**
 * What a free account is served: /api/free/zones and /api/free/record.
 *
 * A free account is a signed-in one without a subscription. It sees the same
 * two shapes the landing page does — a live zone LOCKED, a finished one in
 * full (see ./publicDemo) — plus one thing the landing page never shows: the
 * week's sample, a live zone with its plan.
 */
import type { LockedZone, PublicZone, UnlockedZone, PublicDemoStats, PublicDemoSymbol } from '@/types/publicDemo'

/**
 * The weekly sample: one live zone, with its plan.
 *
 * Structurally an UnlockedZone, which is what lets the chart and the trade
 * plan draw it — they only accept an unlocked zone, so a locked row can still
 * never reach them. `sample: true` is the server saying this unlocked LIVE
 * zone is the deliberate one; nothing else arrives unlocked while in play.
 */
export interface SampleZone extends UnlockedZone {
  sample: true
}

export interface FreeZonesResponse {
  generated_at: string
  /** Waiting or running, newest first. Every one locked; the sample is not repeated here. */
  live: LockedZone[]
  /** Null until a zone has been eligible this week. */
  sample: SampleZone | null
  /** Daily candles for the sample's symbol, so it can be drawn. */
  sample_chart: PublicDemoSymbol | null
  stats: PublicDemoStats
  locked_fields: string[]
}

export type RecordOutcome = 'target' | 'stopped' | 'invalidated'

export interface FreeRecordResponse {
  zones: PublicZone[]
  /** Empty on the last page. */
  next_cursor: string
}
