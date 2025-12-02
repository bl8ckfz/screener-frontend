import type { Coin, Timeframe, TimeframeSnapshot } from '@/types/coin'

/**
 * Timeframe intervals in seconds
 */
const TIMEFRAME_INTERVALS: Record<Timeframe, number> = {
  '5s': 5,
  '10s': 10,
  '15s': 15,
  '30s': 30,
  '45s': 45,
  '60s': 60,
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
}

/**
 * Timeframe tracking service
 * Manages historical snapshots and triggers updates based on elapsed time
 */
export class TimeframeService {
  private lastUpdateTimes: Map<Timeframe, number> = new Map()

  constructor() {
    // Initialize all timeframes with a timestamp far in the past
    const pastTime = Date.now() - 1000000
    Object.keys(TIMEFRAME_INTERVALS).forEach((tf) => {
      this.lastUpdateTimes.set(tf as Timeframe, pastTime)
    })
  }

  /**
   * Check if a timeframe should be updated
   */
  shouldUpdate(timeframe: Timeframe): boolean {
    const now = Date.now()
    const lastUpdate = this.lastUpdateTimes.get(timeframe) || 0
    const interval = TIMEFRAME_INTERVALS[timeframe] * 1000 // Convert to milliseconds

    return now - lastUpdate >= interval
  }

  /**
   * Get all timeframes that should be updated
   */
  getTimeframesToUpdate(): Timeframe[] {
    return Object.keys(TIMEFRAME_INTERVALS).filter((tf) =>
      this.shouldUpdate(tf as Timeframe)
    ) as Timeframe[]
  }

  /**
   * Mark a timeframe as updated
   */
  markUpdated(timeframe: Timeframe): void {
    this.lastUpdateTimes.set(timeframe, Date.now())
  }

  /**
   * Get seconds since last update for a timeframe
   */
  getSecondsSinceUpdate(timeframe: Timeframe): number {
    const now = Date.now()
    const lastUpdate = this.lastUpdateTimes.get(timeframe) || 0
    return Math.floor((now - lastUpdate) / 1000)
  }

  /**
   * Reset all timeframes (useful for testing or manual refresh)
   */
  reset(): void {
    const pastTime = Date.now() - 1000000
    this.lastUpdateTimes.forEach((_, key) => {
      this.lastUpdateTimes.set(key, pastTime)
    })
  }

  /**
   * Create a snapshot of coin data for historical tracking
   */
  static createSnapshot(coin: Coin): TimeframeSnapshot {
    return {
      volume: coin.quoteVolume,
      price: coin.lastPrice,
      weightedAvg: coin.weightedAvgPrice,
      priceToWA: coin.indicators.priceToWeightedAvg,
      vcp: coin.indicators.vcp,
      timestamp: Date.now(),
    }
  }

  /**
   * Calculate deltas between current coin and historical snapshot
   */
  static calculateDelta(
    currentCoin: Coin,
    snapshot: TimeframeSnapshot
  ): {
    priceChange: number
    priceChangePercent: number
    volumeChange: number
    volumeChangePercent: number
    vcpChange: number
  } {
    const priceChange = currentCoin.lastPrice - snapshot.price
    const priceChangePercent = snapshot.price > 0
      ? ((currentCoin.lastPrice / snapshot.price - 1) * 100)
      : 0

    const volumeChange = currentCoin.quoteVolume - snapshot.volume
    const volumeChangePercent = snapshot.volume > 0
      ? ((currentCoin.quoteVolume / snapshot.volume - 1) * 100)
      : 0

    const vcpChange = currentCoin.indicators.vcp - snapshot.vcp

    return {
      priceChange,
      priceChangePercent,
      volumeChange,
      volumeChangePercent,
      vcpChange,
    }
  }

  /**
   * Update historical snapshots for coins based on timeframes
   */
  updateSnapshots(coins: Coin[]): Coin[] {
    const timeframesToUpdate = this.getTimeframesToUpdate()

    if (timeframesToUpdate.length === 0) {
      return coins // No updates needed
    }

    console.log(`📸 Updating snapshots for timeframes: ${timeframesToUpdate.join(', ')}`)

    return coins.map((coin) => {
      const updatedHistory = { ...coin.history }
      const updatedDeltas = { ...coin.deltas }

      // Update snapshots for each timeframe
      timeframesToUpdate.forEach((timeframe) => {
        // Save current snapshot
        updatedHistory[timeframe] = TimeframeService.createSnapshot(coin)

        // Calculate deltas if we have a previous snapshot
        const previousSnapshot = coin.history[timeframe]
        if (previousSnapshot) {
          updatedDeltas[timeframe] = TimeframeService.calculateDelta(
            coin,
            previousSnapshot
          )
        }

        // Mark this timeframe as updated
        this.markUpdated(timeframe)
      })

      return {
        ...coin,
        history: updatedHistory,
        deltas: updatedDeltas,
      }
    })
  }
}

/**
 * Singleton instance
 */
export const timeframeService = new TimeframeService()
