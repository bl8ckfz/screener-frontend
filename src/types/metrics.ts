/**
 * Metrics Types
 * 
 * Type definitions for multi-timeframe change metrics and calculations.
 */

/**
 * Single timeframe change result
 */
export interface TimeframeChange {
  priceChange: number          // Absolute change in price
  priceChangePercent: number   // Percentage change
  baseVolume: number           // Sum of base asset volumes
  quoteVolume: number          // Sum of quote asset volumes (USDT)
  windowStart: number          // Oldest candle timestamp
  windowEnd: number            // Newest candle timestamp
  candleCount: number          // Number of candles in window
}

/**
 * Multi-timeframe change metrics for one symbol
 * During warm-up phase, values are null until enough data is accumulated
 */
export interface PartialChangeMetrics {
  symbol: string
  timestamp: number
  
  // 5m window (last 1 candle) - available after 5 minutes
  change_5m: number | null
  baseVolume_5m: number | null
  quoteVolume_5m: number | null
  
  // 15m window (last 3 candles) - available after 15 minutes
  change_15m: number | null
  baseVolume_15m: number | null
  quoteVolume_15m: number | null
  
  // 1h window (last 12 candles) - available after 1 hour
  change_1h: number | null
  baseVolume_1h: number | null
  quoteVolume_1h: number | null
  
  // 4h window (last 48 candles) - available after 4 hours
  change_4h: number | null
  baseVolume_4h: number | null
  quoteVolume_4h: number | null
  
  // 8h window (last 96 candles) - available after 8 hours
  change_8h: number | null
  baseVolume_8h: number | null
  quoteVolume_8h: number | null
  
  // 12h window (last 144 candles) - available after 12 hours
  change_12h: number | null
  baseVolume_12h: number | null
  quoteVolume_12h: number | null
  
  // 1d window (last 288 candles) - available after 24 hours
  change_1d: number | null
  baseVolume_1d: number | null
  quoteVolume_1d: number | null
}

/**
 * Timeframe identifiers
 */
export type Timeframe = '5m' | '15m' | '1h' | '4h' | '8h' | '12h' | '1d'

/**
 * Warm-up status for all symbols and timeframes
 */
export interface WarmupStatus {
  totalSymbols: number
  timeframes: {
    '5m': { ready: number; total: number }
    '15m': { ready: number; total: number }
    '1h': { ready: number; total: number }
    '4h': { ready: number; total: number }
    '8h': { ready: number; total: number }
    '12h': { ready: number; total: number }
    '1d': { ready: number; total: number }
  }
  overallProgress: number  // 0-100%
}
