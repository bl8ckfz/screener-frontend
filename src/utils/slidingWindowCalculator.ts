import { Candle1m, RunningSums, WindowMetrics } from '@/types/api'
import { Candle1mRingBuffer } from './candle1mRingBuffer'

/**
 * Window size definitions (in minutes)
 */
export const WINDOW_SIZES = {
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '8h': 480,
  '1d': 1440,
} as const

export type WindowSize = keyof typeof WINDOW_SIZES

/**
 * Sliding window calculator with O(1) updates using running sums
 * 
 * Design:
 * - Maintains cumulative volume sums for each window (5m, 15m, 1h, 8h, 24h)
 * - When adding candle: add volumes to all sums
 * - When removing candle (from eviction): subtract volumes from appropriate sums
 * - Window queries run in O(1) by accessing precomputed sums
 * 
 * Memory: 80 bytes per symbol (10 float64 values)
 */
export class SlidingWindowCalculator {
  private runningSums: Map<string, RunningSums> = new Map()

  /**
   * Initialize running sums for a symbol (all zeros)
   */
  initializeSymbol(symbol: string): void {
    this.runningSums.set(symbol, {
      sumBase5: 0,
      sumBase15: 0,
      sumBase60: 0,
      sumBase480: 0,
      sumBase1440: 0,
      sumQuote5: 0,
      sumQuote15: 0,
      sumQuote60: 0,
      sumQuote480: 0,
      sumQuote1440: 0,
    })
  }

  /**
   * Add candle to running sums (called when new candle arrives)
   * O(1) operation
   */
  addCandle(symbol: string, candle: Candle1m): void {
    const sums = this.runningSums.get(symbol)
    if (!sums) {
      throw new Error(`Symbol ${symbol} not initialized`)
    }

    // Add to all running sums
    sums.sumBase5 += candle.volume
    sums.sumBase15 += candle.volume
    sums.sumBase60 += candle.volume
    sums.sumBase480 += candle.volume
    sums.sumBase1440 += candle.volume

    sums.sumQuote5 += candle.quoteVolume
    sums.sumQuote15 += candle.quoteVolume
    sums.sumQuote60 += candle.quoteVolume
    sums.sumQuote480 += candle.quoteVolume
    sums.sumQuote1440 += candle.quoteVolume
  }

  /**
   * Remove candle from running sums (called when candle evicted from buffer)
   * Subtracts from all windows since buffer is full (1440 candles)
   * 
   * This method is only called when buffer evicts (at 1441st candle),
   * so we subtract from all windows to maintain sliding window behavior.
   * 
   * @param symbol - Symbol identifier
   * @param candle - Candle being evicted (oldest in buffer)
   */
  removeCandle(symbol: string, candle: Candle1m): void {
    const sums = this.runningSums.get(symbol)
    if (!sums) {
      throw new Error(`Symbol ${symbol} not initialized`)
    }

    // Subtract from all running sums (buffer is full, oldest slides out of all windows)
    sums.sumBase5 -= candle.volume
    sums.sumBase15 -= candle.volume
    sums.sumBase60 -= candle.volume
    sums.sumBase480 -= candle.volume
    sums.sumBase1440 -= candle.volume

    sums.sumQuote5 -= candle.quoteVolume
    sums.sumQuote15 -= candle.quoteVolume
    sums.sumQuote60 -= candle.quoteVolume
    sums.sumQuote480 -= candle.quoteVolume
    sums.sumQuote1440 -= candle.quoteVolume
  }

  /**
   * Get metrics for a specific window
   * O(1) operation using precomputed sums
   * 
   * @param symbol - Symbol identifier
   * @param buffer - Ring buffer with candle data
   * @param window - Window size ('5m', '15m', '1h', '8h', '1d')
   * @returns WindowMetrics or null if insufficient data
   */
  getMetrics(
    symbol: string,
    buffer: Candle1mRingBuffer,
    window: WindowSize
  ): WindowMetrics | null {
    const sums = this.runningSums.get(symbol)
    if (!sums) {
      throw new Error(`Symbol ${symbol} not initialized`)
    }

    const windowSize = WINDOW_SIZES[window]
    
    // Check if we have enough data
    if (!buffer.hasWindow(windowSize)) {
      return null
    }

    // Get boundary candles
    const newest = buffer.getNewest()
    const oldest = buffer.getOldest(windowSize)

    if (!newest || !oldest) {
      return null
    }

    // Calculate price changes
    const priceChange = newest.close - oldest.close
    const priceChangePercent = oldest.close !== 0 
      ? (priceChange / oldest.close) * 100 
      : 0

    // Get volumes from running sums
    let baseVolume: number
    let quoteVolume: number

    switch (window) {
      case '5m':
        baseVolume = sums.sumBase5
        quoteVolume = sums.sumQuote5
        break
      case '15m':
        baseVolume = sums.sumBase15
        quoteVolume = sums.sumQuote15
        break
      case '1h':
        baseVolume = sums.sumBase60
        quoteVolume = sums.sumQuote60
        break
      case '8h':
        baseVolume = sums.sumBase480
        quoteVolume = sums.sumQuote480
        break
      case '1d':
        baseVolume = sums.sumBase1440
        quoteVolume = sums.sumQuote1440
        break
      default:
        throw new Error(`Invalid window size: ${window}`)
    }

    return {
      symbol,
      windowMinutes: windowSize,
      priceChange,
      priceChangePercent,
      baseVolume,
      quoteVolume,
      windowStartTime: oldest.openTime,
      windowEndTime: newest.openTime,
      startPrice: oldest.close,
      endPrice: newest.close,
    }
  }

  /**
   * Get metrics for all windows
   * Returns map of window -> metrics
   */
  getAllMetrics(
    symbol: string,
    buffer: Candle1mRingBuffer
  ): Map<WindowSize, WindowMetrics> {
    const metrics = new Map<WindowSize, WindowMetrics>()
    
    const windows: WindowSize[] = ['5m', '15m', '1h', '8h', '1d']
    for (const window of windows) {
      const metric = this.getMetrics(symbol, buffer, window)
      if (metric) {
        metrics.set(window, metric)
      }
    }

    return metrics
  }

  /**
   * Get raw running sums for a symbol (for debugging/testing)
   */
  getRunningSums(symbol: string): RunningSums | undefined {
    return this.runningSums.get(symbol)
  }

  /**
   * Clear all data for a symbol
   */
  clearSymbol(symbol: string): void {
    this.runningSums.delete(symbol)
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.runningSums.clear()
  }

  /**
   * Get list of tracked symbols
   */
  getSymbols(): string[] {
    return Array.from(this.runningSums.keys())
  }

  /**
   * Check if symbol is initialized
   */
  hasSymbol(symbol: string): boolean {
    return this.runningSums.has(symbol)
  }
}
