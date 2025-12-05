/**
 * Ring Buffer Manager
 * 
 * Manages ring buffers for all trading symbols, tracking warm-up progress
 * and providing ready-state checks for different timeframes.
 */

import { KlineRingBuffer, type Kline5m } from '@/utils/klineRingBuffer'
import { BinanceFuturesApiClient } from './binanceFuturesApi'

/**
 * Timeframe requirements - number of 5m candles needed
 * - 5m: 1 candle
 * - 15m: 3 candles (15 minutes / 5 minutes)
 * - 1h: 12 candles (60 minutes / 5 minutes)
 * - 4h: 48 candles (240 minutes / 5 minutes)
 * - 8h: 96 candles (480 minutes / 5 minutes)
 * - 12h: 144 candles (720 minutes / 5 minutes)
 * - 1d: 288 candles (1440 minutes / 5 minutes)
 */
const TIMEFRAME_REQUIREMENTS = {
  '5m': 1,
  '15m': 3,
  '1h': 12,
  '4h': 48,
  '8h': 96,
  '12h': 144,
  '1d': 288,
} as const

export type Timeframe = keyof typeof TIMEFRAME_REQUIREMENTS

/**
 * Status information for all buffers
 */
export interface BufferStatus {
  totalSymbols: number      // Total number of symbols with buffers
  fullyLoaded: number       // Number of symbols with full buffers (288 candles)
  loading: number           // Number of symbols still warming up
  averageFill: number       // Average fill percentage across all buffers
}

/**
 * Warm-up status for a single symbol
 */
export interface WarmupStatus {
  symbol: string
  candleCount: number
  fillPercentage: number
  ready: {
    '5m': boolean
    '15m': boolean
    '1h': boolean
    '4h': boolean
    '8h': boolean
    '12h': boolean
    '1d': boolean
  }
}

/**
 * Manages ring buffers for all symbols
 */
export class RingBufferManager {
  private buffers: Map<string, KlineRingBuffer> = new Map()
  private apiClient: BinanceFuturesApiClient

  constructor(apiClient?: BinanceFuturesApiClient) {
    this.apiClient = apiClient ?? new BinanceFuturesApiClient()
  }

  /**
   * Initialize buffers for given symbols
   */
  async initialize(symbols: string[]): Promise<void> {
    console.log(`🔧 Initializing ring buffers for ${symbols.length} symbols...`)

    for (const symbol of symbols) {
      if (!this.buffers.has(symbol)) {
        this.buffers.set(symbol, new KlineRingBuffer(symbol))
      }
    }

    console.log(`✅ Ring buffers initialized for ${this.buffers.size} symbols`)
  }

  /**
   * Update buffer with new candle from WebSocket
   * Only pushes if candle is final (completed 5m period)
   */
  updateCandle(symbol: string, candle: Kline5m): void {
    // Only store final candles (completed periods)
    if (!candle.isFinal) {
      return
    }

    // Get or create buffer for symbol
    let buffer = this.buffers.get(symbol)
    if (!buffer) {
      buffer = new KlineRingBuffer(symbol)
      this.buffers.set(symbol, buffer)
    }

    // Push candle to buffer
    buffer.push(candle)
  }

  /**
   * Check if symbol has enough data for specific timeframe
   */
  isReady(symbol: string, timeframe: Timeframe): boolean {
    const buffer = this.buffers.get(symbol)
    if (!buffer) return false

    const required = TIMEFRAME_REQUIREMENTS[timeframe]
    return buffer.hasEnoughData(required)
  }

  /**
   * Check if symbol is fully warmed up (has 288 candles)
   */
  isFullyLoaded(symbol: string): boolean {
    const buffer = this.buffers.get(symbol)
    return buffer?.isFull() ?? false
  }

  /**
   * Get warm-up progress percentage for symbol (0-100)
   */
  getWarmupProgress(symbol: string): number {
    const buffer = this.buffers.get(symbol)
    return buffer?.getFillPercentage() ?? 0
  }

  /**
   * Get detailed warm-up status for symbol
   */
  getWarmupStatus(symbol: string): WarmupStatus | null {
    const buffer = this.buffers.get(symbol)
    if (!buffer) return null

    return {
      symbol,
      candleCount: buffer.getCount(),
      fillPercentage: buffer.getFillPercentage(),
      ready: {
        '5m': this.isReady(symbol, '5m'),
        '15m': this.isReady(symbol, '15m'),
        '1h': this.isReady(symbol, '1h'),
        '4h': this.isReady(symbol, '4h'),
        '8h': this.isReady(symbol, '8h'),
        '12h': this.isReady(symbol, '12h'),
        '1d': this.isReady(symbol, '1d'),
      }
    }
  }

  /**
   * Get ring buffer for symbol
   */
  getBuffer(symbol: string): KlineRingBuffer | undefined {
    return this.buffers.get(symbol)
  }

  /**
   * Get all symbols with buffers
   */
  getSymbols(): string[] {
    return Array.from(this.buffers.keys())
  }

  /**
   * Get number of symbols with buffers
   */
  getSymbolCount(): number {
    return this.buffers.size
  }

  /**
   * Get overall buffer status
   */
  getStatus(): BufferStatus {
    const symbols = Array.from(this.buffers.values())
    
    if (symbols.length === 0) {
      return {
        totalSymbols: 0,
        fullyLoaded: 0,
        loading: 0,
        averageFill: 0
      }
    }

    const fullyLoaded = symbols.filter(b => b.isFull()).length
    const totalFill = symbols.reduce((sum, b) => sum + b.getFillPercentage(), 0)

    return {
      totalSymbols: symbols.length,
      fullyLoaded,
      loading: symbols.length - fullyLoaded,
      averageFill: totalFill / symbols.length
    }
  }

  /**
   * Get symbols ready for specific timeframe
   */
  getReadySymbols(timeframe: Timeframe): string[] {
    return Array.from(this.buffers.entries())
      .filter(([_, buffer]) => {
        const required = TIMEFRAME_REQUIREMENTS[timeframe]
        return buffer.hasEnoughData(required)
      })
      .map(([symbol, _]) => symbol)
  }

  /**
   * Clear buffer for specific symbol
   */
  clearSymbol(symbol: string): void {
    const buffer = this.buffers.get(symbol)
    if (buffer) {
      buffer.clear()
    }
  }

  /**
   * Clear all buffers
   */
  clearAll(): void {
    this.buffers.forEach(buffer => buffer.clear())
  }

  /**
   * Remove symbol buffer completely
   */
  removeSymbol(symbol: string): boolean {
    return this.buffers.delete(symbol)
  }

  /**
   * Get memory usage estimate (in MB)
   * Assumes ~56 bytes per candle
   */
  getMemoryUsage(): number {
    const totalCandles = Array.from(this.buffers.values())
      .reduce((sum, buffer) => sum + buffer.getCount(), 0)
    
    const bytesPerCandle = 56 // Approximate size of Kline5m object
    return (totalCandles * bytesPerCandle) / (1024 * 1024)
  }

  /**
   * Get detailed statistics
   */
  getStatistics() {
    const status = this.getStatus()
    const memoryUsage = this.getMemoryUsage()

    return {
      ...status,
      memoryUsageMB: memoryUsage,
      readyByTimeframe: {
        '5m': this.getReadySymbols('5m').length,
        '15m': this.getReadySymbols('15m').length,
        '1h': this.getReadySymbols('1h').length,
        '4h': this.getReadySymbols('4h').length,
        '8h': this.getReadySymbols('8h').length,
        '12h': this.getReadySymbols('12h').length,
        '1d': this.getReadySymbols('1d').length,
      }
    }
  }

  /**
   * Backfill buffer for a single symbol with 24h of historical 5m klines
   * Fetches 288 candles from Binance Futures API
   */
  async backfillSymbol(symbol: string): Promise<void> {
    try {
      // Fetch 288 5m candles (24 hours)
      const klines = await this.apiClient.fetchKlines(symbol, '5m', 288)

      // Get or create buffer
      let buffer = this.buffers.get(symbol)
      if (!buffer) {
        buffer = new KlineRingBuffer(symbol)
        this.buffers.set(symbol, buffer)
      }

      // Convert API format to Kline5m and push to buffer
      for (const kline of klines) {
        const candle: Kline5m = {
          openTime: kline.openTime,
          closeTime: kline.closeTime,
          open: parseFloat(kline.open),
          high: parseFloat(kline.high),
          low: parseFloat(kline.low),
          close: parseFloat(kline.close),
          volume: parseFloat(kline.volume),
          quoteVolume: parseFloat(kline.quoteVolume),
          isFinal: true // Historical candles are always final
        }
        buffer.push(candle)
      }

      console.log(`✅ Backfilled ${symbol}: ${klines.length} candles`)
    } catch (error) {
      console.error(`❌ Failed to backfill ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Backfill buffers for multiple symbols with rate limiting
   * 
   * Rate Limiting Strategy:
   * - Binance weight limit: 1200/min (IP), 2400/min (UID)
   * - /fapi/v1/klines weight: 5 per request
   * - Max safe rate: ~200 requests/min (1000 weight/min)
   * - Batch size: 10 symbols at a time
   * - Delay between batches: 3 seconds
   * 
   * For 590 symbols: ~3 minutes total
   */
  async backfillAll(
    symbols: string[],
    options: {
      batchSize?: number
      batchDelay?: number
      onProgress?: (completed: number, total: number) => void
    } = {}
  ): Promise<{ successful: string[], failed: string[] }> {
    const {
      batchSize = 10,        // 10 symbols per batch
      batchDelay = 3000,     // 3 seconds between batches
      onProgress
    } = options

    const successful: string[] = []
    const failed: string[] = []

    console.log(`🔧 Starting backfill for ${symbols.length} symbols...`)
    console.log(`📊 Batch size: ${batchSize}, delay: ${batchDelay}ms`)

    // Process in batches
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(symbols.length / batchSize)

      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} symbols)...`)

      // Process batch in parallel (but rate-limited by BinanceFuturesApiClient)
      const results = await Promise.allSettled(
        batch.map(symbol => this.backfillSymbol(symbol))
      )

      // Track results
      results.forEach((result, idx) => {
        const symbol = batch[idx]
        if (result.status === 'fulfilled') {
          successful.push(symbol)
        } else {
          failed.push(symbol)
          console.error(`❌ ${symbol} failed:`, result.reason)
        }
      })

      // Report progress
      const completed = i + batch.length
      onProgress?.(completed, symbols.length)

      // Delay before next batch (except for last batch)
      if (i + batchSize < symbols.length) {
        console.log(`⏳ Waiting ${batchDelay}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, batchDelay))
      }
    }

    console.log(`✅ Backfill complete: ${successful.length} successful, ${failed.length} failed`)

    return { successful, failed }
  }

  /**
   * Get backfill progress for all symbols
   */
  getBackfillProgress(): {
    total: number
    fullyLoaded: number
    partial: number
    empty: number
    percentage: number
  } {
    const total = this.buffers.size
    let fullyLoaded = 0
    let partial = 0
    let empty = 0

    this.buffers.forEach(buffer => {
      const count = buffer.getCount()
      if (count === 288) {
        fullyLoaded++
      } else if (count > 0) {
        partial++
      } else {
        empty++
      }
    })

    return {
      total,
      fullyLoaded,
      partial,
      empty,
      percentage: total > 0 ? (fullyLoaded / total) * 100 : 0
    }
  }
}
