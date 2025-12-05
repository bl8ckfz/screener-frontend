/**
 * Change Calculator
 * 
 * Calculates price changes and volumes across multiple timeframes using ring buffer data.
 * Handles warm-up phase gracefully by returning null for unavailable timeframes.
 */

import { RingBufferManager } from './ringBufferManager'
import type { TimeframeChange, PartialChangeMetrics, Timeframe } from '@/types/metrics'

/**
 * Timeframe to candle count mapping
 * Each timeframe requires a specific number of 5m candles
 */
const TIMEFRAME_CANDLES: Record<Timeframe, number> = {
  '5m': 1,     // Last 1 candle (5 minutes)
  '15m': 3,    // Last 3 candles (15 minutes)
  '1h': 12,    // Last 12 candles (1 hour)
  '4h': 48,    // Last 48 candles (4 hours)
  '8h': 96,    // Last 96 candles (8 hours)
  '12h': 144,  // Last 144 candles (12 hours)
  '1d': 288,   // Last 288 candles (24 hours)
}

export class ChangeCalculator {
  private bufferManager: RingBufferManager

  constructor(bufferManager: RingBufferManager) {
    this.bufferManager = bufferManager
  }

  /**
   * Calculate change metrics for specific timeframe
   * Returns null if buffer doesn't have enough data yet (warm-up phase)
   */
  getChange(symbol: string, timeframe: Timeframe): TimeframeChange | null {
    const buffer = this.bufferManager.getBuffer(symbol)
    if (!buffer) {
      return null
    }

    const candleCount = TIMEFRAME_CANDLES[timeframe]

    // Return null if not enough data yet (still warming up)
    if (!buffer.hasEnoughData(candleCount)) {
      return null
    }

    // Get last N candles (oldest first)
    const candles = buffer.getLastN(candleCount)

    // Calculate price change
    const startPrice = candles[0].close              // Oldest candle's close
    const endPrice = candles[candleCount - 1].close  // Newest candle's close
    const priceChange = endPrice - startPrice
    const priceChangePercent = (priceChange / startPrice) * 100

    // Calculate volumes (sum over window)
    let baseVolume = 0
    let quoteVolume = 0

    for (const candle of candles) {
      baseVolume += candle.volume
      quoteVolume += candle.quoteVolume
    }

    return {
      priceChange,
      priceChangePercent,
      baseVolume,
      quoteVolume,
      windowStart: candles[0].openTime,
      windowEnd: candles[candleCount - 1].openTime,
      candleCount,
    }
  }

  /**
   * Calculate all timeframe changes for symbol
   * Returns null for timeframes that aren't warmed up yet
   */
  getAllChanges(symbol: string): PartialChangeMetrics {
    const change_5m = this.getChange(symbol, '5m')
    const change_15m = this.getChange(symbol, '15m')
    const change_1h = this.getChange(symbol, '1h')
    const change_4h = this.getChange(symbol, '4h')
    const change_8h = this.getChange(symbol, '8h')
    const change_12h = this.getChange(symbol, '12h')
    const change_1d = this.getChange(symbol, '1d')

    return {
      symbol,
      timestamp: Date.now(),

      // All fields are nullable during warm-up phase
      change_5m: change_5m?.priceChangePercent ?? null,
      baseVolume_5m: change_5m?.baseVolume ?? null,
      quoteVolume_5m: change_5m?.quoteVolume ?? null,

      change_15m: change_15m?.priceChangePercent ?? null,
      baseVolume_15m: change_15m?.baseVolume ?? null,
      quoteVolume_15m: change_15m?.quoteVolume ?? null,

      change_1h: change_1h?.priceChangePercent ?? null,
      baseVolume_1h: change_1h?.baseVolume ?? null,
      quoteVolume_1h: change_1h?.quoteVolume ?? null,

      change_4h: change_4h?.priceChangePercent ?? null,
      baseVolume_4h: change_4h?.baseVolume ?? null,
      quoteVolume_4h: change_4h?.quoteVolume ?? null,

      change_8h: change_8h?.priceChangePercent ?? null,
      baseVolume_8h: change_8h?.baseVolume ?? null,
      quoteVolume_8h: change_8h?.quoteVolume ?? null,

      change_12h: change_12h?.priceChangePercent ?? null,
      baseVolume_12h: change_12h?.baseVolume ?? null,
      quoteVolume_12h: change_12h?.quoteVolume ?? null,

      change_1d: change_1d?.priceChangePercent ?? null,
      baseVolume_1d: change_1d?.baseVolume ?? null,
      quoteVolume_1d: change_1d?.quoteVolume ?? null,
    }
  }

  /**
   * Calculate changes for all symbols (for screener/alerts)
   * Returns Map of symbol → metrics
   */
  getAllSymbolsChanges(): Map<string, PartialChangeMetrics> {
    const results = new Map<string, PartialChangeMetrics>()
    const symbols = this.bufferManager.getSymbols()

    for (const symbol of symbols) {
      const metrics = this.getAllChanges(symbol)
      results.set(symbol, metrics)
    }

    return results
  }

  /**
   * Get symbols that have data ready for specific timeframe
   */
  getReadySymbols(timeframe: Timeframe): string[] {
    return this.bufferManager.getReadySymbols(timeframe)
  }

  /**
   * Check if symbol has enough data for timeframe
   */
  isReady(symbol: string, timeframe: Timeframe): boolean {
    return this.bufferManager.isReady(symbol, timeframe)
  }
}
