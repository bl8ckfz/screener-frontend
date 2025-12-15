import type { FuturesMetrics } from '@/types/api'
import { CoinGeckoApiClient } from './coinGeckoApi'
import { getCoinGeckoId as mapSymbolToCoinGeckoId } from '@/config/coinGeckoMapping'
import { Stream1mManager, type AllTimeframeMetrics } from './stream1mManager'
import type { PartialChangeMetrics, WarmupStatus } from '@/types/metrics'
import { BinanceFuturesApiClient } from './binanceFuturesApi'

/**
 * Service for fetching and calculating comprehensive futures metrics
 * 
 * **MIGRATED TO 1M SLIDING WINDOWS** (replacing 5m system)
 * 
 * Uses 1m kline streaming with efficient sliding window calculations for real-time data.
 * 
 * Data sources:
 * - Binance Futures WebSocket (1m candles)
 * - CoinGecko API (market cap data - cached)
 * 
 * Architecture:
 * - Ring buffers: 1440 1m candles per symbol (24h history)
 * - Running sums: O(1) metric updates
 * - Supported timeframes: 5m, 15m, 1h, 8h, 24h
 * 
 * Warm-up phase: Instant backfill at startup (1440 candles via REST API)
 * - All metrics available immediately after backfill (60-90 seconds)
 * 
 * Filtering logic based on:
 * - Price change thresholds
 * - Volume thresholds
 * - Market cap ranges
 */
export class FuturesMetricsService {
  // Configuration: Max symbols to stream (adjust based on needs)
  // Lower values = faster backfill, less memory, lower API usage
  // Higher values = more market coverage (Binance WebSocket limit: 200)
  private static readonly MAX_SYMBOLS = 100

  private coinGeckoClient: CoinGeckoApiClient
  private stream1mManager: Stream1mManager
  private futuresClient: BinanceFuturesApiClient

  constructor(
    coinGeckoClient?: CoinGeckoApiClient
  ) {
    this.coinGeckoClient = coinGeckoClient || new CoinGeckoApiClient()
    this.futuresClient = new BinanceFuturesApiClient()
    this.stream1mManager = new Stream1mManager()
    
    // Expose stream manager globally for bubble detection hook
    if (typeof window !== 'undefined') {
      (window as any).__streamManager = this.stream1mManager
    }
    
    console.log(`🎯 Using 1m streaming (max ${FuturesMetricsService.MAX_SYMBOLS} symbols)`)
  }

  /**
   * Initialize 1m streaming with backfill
   * Call this once on app startup to begin streaming data
   * 
   * Strategy:
   * 1. Backfill 1440 1m candles via REST API (instant metrics)
   * 2. Initialize ring buffers and running sums
   * 3. Subscribe to 1m kline WebSocket streams
   * 
   * @param symbols - Array of symbols to stream (optional, uses top N by volume if not provided)
   */
  async initialize(symbols?: string[]): Promise<void> {
    console.log('🚀 Initializing 1m streaming...')
    
    let symbolsToStream: string[]
    
    if (symbols && symbols.length > 0) {
      symbolsToStream = symbols
    } else {
      // Get all futures symbols (already sorted by 24hr volume)
      const allSymbols = await this.futuresClient.fetchAllFuturesSymbols()
      console.log(`📋 Found ${allSymbols.length} USDT-M perpetual futures (sorted by volume)`)
      
      // Take top N most liquid pairs
      symbolsToStream = allSymbols.slice(0, FuturesMetricsService.MAX_SYMBOLS)
      console.log(`🎯 Selected top ${symbolsToStream.length} by 24hr volume`)
    }
    
    console.log(`📈 Starting 1m stream for ${symbolsToStream.length} symbols`)
    console.log(`🔝 Top 10: ${symbolsToStream.slice(0, 10).join(', ')}`)
    
    // Fetch initial ticker data for immediate display
    try {
      const tickers = await this.futuresClient.fetch24hrTickers()
      const trackedTickers = tickers.filter(t => symbolsToStream.includes(t.symbol))
      console.log(`📊 Fetched ${trackedTickers.length} initial tickers for display`)
      
      // Store in stream manager for immediate access
      this.stream1mManager.setInitialTickers(trackedTickers)
    } catch (err) {
      console.warn('⚠️  Failed to fetch initial tickers:', err)
    }
    
    // Start streaming in background (non-blocking)
    // This allows UI to show ticker data immediately while backfill runs
    this.stream1mManager.start(symbolsToStream).catch(err => {
      console.error('❌ Failed to start 1m streaming:', err)
    })
    
    console.log('✅ 1m streaming initialized (backfill in progress)')
  }

  /**
   * Get warm-up status for UI indicators
   * 
   * Note: With 1m backfill, metrics are available immediately (< 90s backfill time)
   * This returns a synthetic warm-up status for UI compatibility
   * 
   * @returns Current warm-up progress (always fully warmed after backfill)
   */
  getWarmupStatus(): WarmupStatus {
    const trackedSymbols = this.stream1mManager.getSymbols()
    const totalSymbols = trackedSymbols.length
    
    // All metrics available immediately after backfill
    // Return fully warmed status (100%)
    return {
      totalSymbols,
      timeframes: {
        '5m': { ready: totalSymbols, total: totalSymbols },
        '15m': { ready: totalSymbols, total: totalSymbols },
        '1h': { ready: totalSymbols, total: totalSymbols },
        '4h': { ready: 0, total: totalSymbols }, // Not supported in 1m system
        '8h': { ready: totalSymbols, total: totalSymbols },
        '12h': { ready: 0, total: totalSymbols }, // Not supported in 1m system
        '1d': { ready: totalSymbols, total: totalSymbols },
      },
      overallProgress: 100, // Always 100% after backfill
    }
  }

  /**
   * Subscribe to real-time metrics updates (1m frequency)
   * 
   * @param handler - Callback for metrics updates
   * @returns Unsubscribe function
   */
  onMetricsUpdate(handler: (data: { symbol: string; metrics: PartialChangeMetrics }) => void): () => void {
    let metricsReceived = 0
    const listener = (data: { symbol: string; metrics: AllTimeframeMetrics; timestamp: number }) => {
      // Convert WindowMetrics to PartialChangeMetrics
      const converted = this.convertToPartialMetrics(data.metrics)
      
      // Debug: Log first few metrics to verify data flow
      metricsReceived++
      if (metricsReceived <= 3 || (import.meta.env.DEV && metricsReceived % 100 === 0)) {
        console.log(`📈 FuturesMetricsService received metric #${metricsReceived} for ${data.symbol}`)
      }
      
      handler({ symbol: data.symbol, metrics: converted })
    }
    
    this.stream1mManager.on('metrics', listener)
    
    return () => {
      this.stream1mManager.removeAllListeners('metrics')
    }
  }

  /**
   * Subscribe to real-time ticker updates
   * 
   * @param handler - Callback for ticker batch updates
   * @returns Unsubscribe function
   */
  onTickerUpdate(handler: (data: { timestamp: number }) => void): () => void {
    this.stream1mManager.on('tickerUpdate', handler)
    return () => {
      this.stream1mManager.removeAllListeners('tickerUpdate')
    }
  }

  /**
   * Subscribe to initial tickers ready event
   * 
   * @param event - Event name ('tickersReady')
   * @param handler - Callback when tickers are ready
   * @returns Unsubscribe function
   */
  on(event: 'tickersReady', handler: () => void): () => void {
    this.stream1mManager.on(event, handler)
    return () => {
      this.stream1mManager.off(event, handler)
    }
  }

  /**
   * Subscribe to backfill progress updates
   * 
   * @param handler - Callback for progress updates
   * @returns Unsubscribe function
   */
  onBackfillProgress(handler: (data: { completed: number; total: number; progress: number }) => void): () => void {
    this.stream1mManager.on('backfillProgress', handler)
    return () => {
      this.stream1mManager.removeAllListeners('backfillProgress')
    }
  }

  /**
   * Stop 1m streaming and cleanup
   */
  stop(): void {
    this.stream1mManager.stop()
  }

  /**
   * Convert AllTimeframeMetrics to PartialChangeMetrics format
   * 
   * @param metrics - 1m window metrics
   * @returns Legacy format for UI compatibility
   */
  private convertToPartialMetrics(metrics: AllTimeframeMetrics): PartialChangeMetrics {
    return {
      symbol: metrics.m5.symbol,
      timestamp: metrics.m5.windowEndTime,
      change_5m: metrics.m5.priceChangePercent,
      change_15m: metrics.m15.priceChangePercent,
      change_1h: metrics.h1.priceChangePercent,
      change_4h: null, // Not supported in 1m system
      change_8h: metrics.h8.priceChangePercent,
      change_12h: null, // Not supported in 1m system
      change_1d: metrics.h24.priceChangePercent,
      baseVolume_5m: metrics.m5.baseVolume,
      baseVolume_15m: metrics.m15.baseVolume,
      baseVolume_1h: metrics.h1.baseVolume,
      baseVolume_4h: null, // Not supported in 1m system
      baseVolume_8h: metrics.h8.baseVolume,
      baseVolume_12h: null, // Not supported in 1m system
      baseVolume_1d: metrics.h24.baseVolume,
      quoteVolume_5m: metrics.m5.quoteVolume,
      quoteVolume_15m: metrics.m15.quoteVolume,
      quoteVolume_1h: metrics.h1.quoteVolume,
      quoteVolume_4h: null, // Not supported in 1m system
      quoteVolume_8h: metrics.h8.quoteVolume,
      quoteVolume_12h: null, // Not supported in 1m system
      quoteVolume_1d: metrics.h24.quoteVolume,
    }
  }

  /**
   * Fetch comprehensive metrics for a single symbol from 1m stream
   * 
   * Returns real-time metrics from ring buffers (available immediately after backfill).
   * 
   * @param symbol - Binance futures symbol (e.g., 'BTCUSDT')
   * @param options - Optional configuration
   * @param options.skipMarketCap - Skip fetching market cap data (default: false)
   * @returns Complete metrics including price changes, volumes, market cap, and filter results
   * 
   * @example
   * const metrics = await service.fetchSymbolMetrics('BTCUSDT')
   * console.log(metrics.change_1h, metrics.volume_1h, metrics.marketCap)
   */
  async fetchSymbolMetrics(
    symbol: string,
    options: { skipMarketCap?: boolean } = {}
  ): Promise<FuturesMetrics> {
    try {
      // Get from 1m stream manager
      const allMetrics = this.stream1mManager.getAllMetrics(symbol)
      
      let priceChanges, volumes
      
      if (allMetrics) {
        // Extract metrics for each timeframe
        priceChanges = {
          change_5m: allMetrics.m5.priceChangePercent,
          change_15m: allMetrics.m15.priceChangePercent,
          change_1h: allMetrics.h1.priceChangePercent,
          change_8h: allMetrics.h8.priceChangePercent,
          change_1d: allMetrics.h24.priceChangePercent,
        }
        volumes = {
          volume_5m: allMetrics.m5.quoteVolume,
          volume_15m: allMetrics.m15.quoteVolume,
          volume_1h: allMetrics.h1.quoteVolume,
          volume_8h: allMetrics.h8.quoteVolume,
          volume_1d: allMetrics.h24.quoteVolume,
        }
      } else {
        // Symbol not in stream yet, return zeros
        priceChanges = {
          change_5m: 0,
          change_15m: 0,
          change_1h: 0,
          change_8h: 0,
          change_1d: 0,
        }
        volumes = {
          volume_5m: 0,
          volume_15m: 0,
          volume_1h: 0,
          volume_8h: 0,
          volume_1d: 0,
        }
      }

      // Fetch market cap (with caching) - skip if requested to avoid rate limits
      const marketCap = options.skipMarketCap 
        ? null 
        : await this.coinGeckoClient.fetchMarketCap(symbol)
      const coinGeckoId = options.skipMarketCap 
        ? null 
        : this.getCoinGeckoId(symbol)

      // Build metrics object
      const metrics: Omit<FuturesMetrics, 'passes_filters' | 'filter_details'> = {
        symbol,
        timestamp: Date.now(),
        change_5m: priceChanges.change_5m,
        change_15m: priceChanges.change_15m,
        change_1h: priceChanges.change_1h,
        change_8h: priceChanges.change_8h,
        change_1d: priceChanges.change_1d,
        volume_5m: volumes.volume_5m,
        volume_15m: volumes.volume_15m,
        volume_1h: volumes.volume_1h,
        volume_8h: volumes.volume_8h,
        volume_1d: volumes.volume_1d,
        marketCap,
        coinGeckoId,
      }

      // Evaluate filters
      const filterResults = this.evaluateFilters(metrics)

      const completeMetrics: FuturesMetrics = {
        ...metrics,
        ...filterResults,
      }

      return completeMetrics
    } catch (error) {
      console.error(`Failed to fetch metrics for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Fetch metrics for multiple symbols in parallel with progress tracking
   * 
   * @param symbols - Array of Binance futures symbols
   * @param onProgress - Optional callback for progress updates
   * @param options - Optional configuration
   * @param options.skipMarketCap - Skip fetching market cap data (default: false)
   * @returns Array of metrics for all symbols
   * 
   * @example
   * const metrics = await service.fetchMultipleSymbolMetrics(
   *   ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
   *   (progress) => console.log(`${progress.completed}/${progress.total}`)
   * )
   */
  async fetchMultipleSymbolMetrics(
    symbols: string[],
    onProgress?: (progress: { completed: number; total: number; current: string }) => void,
    options: { skipMarketCap?: boolean } = {}
  ): Promise<FuturesMetrics[]> {
    console.log(`📊 Fetching metrics for ${symbols.length} symbols...`)
    const startTime = Date.now()

    const results: FuturesMetrics[] = []
    let completed = 0

    // Process symbols sequentially to avoid rate limits
    // Each symbol fetches 5 intervals with 50ms delays = ~250ms per symbol
    // Even without CoinGecko, parallel fetches cause 418 errors from Binance
    const concurrency = 1
    for (let i = 0; i < symbols.length; i += concurrency) {
      const batch = symbols.slice(i, i + concurrency)
      const batchPromises = batch.map(async (symbol) => {
        try {
          const metrics = await this.fetchSymbolMetrics(symbol, options)
          completed++
          if (onProgress) {
            onProgress({ completed, total: symbols.length, current: symbol })
          }
          return metrics
        } catch (error) {
          console.error(`Failed to fetch metrics for ${symbol}, skipping...`)
          completed++
          if (onProgress) {
            onProgress({ completed, total: symbols.length, current: symbol })
          }
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter((r): r is FuturesMetrics => r !== null))
    }

    const duration = Date.now() - startTime
    console.log(`✅ Fetched ${results.length}/${symbols.length} metrics in ${duration}ms`)
    console.log(`📈 Average: ${Math.round(duration / symbols.length)}ms per symbol`)

    return results
  }

  /**
   * Get all USDT-M futures symbols
   * 
   * @returns Array of all available futures symbols
   */
  async getAllFuturesSymbols(): Promise<string[]> {
    return await this.futuresClient.fetchAllFuturesSymbols()
  }

  /**
   * Get all symbols currently being tracked in 1m stream
   * 
   * @returns Array of symbol names
   */
  getTrackedSymbols(): string[] {
    return this.stream1mManager.getSymbols()
  }

  /**
   * Get ring buffer for specific symbol (for debugging/advanced use)
   * 
   * @param symbol - Symbol to get buffer for
   * @returns Ring buffer or undefined if not tracked
   */
  getBuffer(symbol: string) {
    return this.stream1mManager.getBuffer(symbol)
  }

  /**
   * Get ticker data for specific symbol
   * 
   * @param symbol - Symbol to get ticker for
   * @returns Ticker data or undefined if not available
   */
  getTickerData(symbol: string) {
    return this.stream1mManager.getTickerData(symbol)
  }

  /**
   * Get all ticker data from WebSocket stream
   * Includes live market data, funding rates, mark prices
   * Filtered to only tracked symbols (those with 1m metrics)
   * 
   * @returns Array of ticker data for tracked symbols only
   */
  getAllTickerData() {
    return this.stream1mManager.getAllTickerData()
  }

  /**
   * Scan all USDT-M futures and return those passing filters
   * 
   * @returns Array of metrics for symbols that pass all filters
   * 
   * @example
   * const passingMetrics = await service.scanAllFutures()
   * console.log(`Found ${passingMetrics.length} symbols passing filters`)
   */
  async scanAllFutures(): Promise<FuturesMetrics[]> {
    console.log('🔍 Scanning all USDT-M futures...')

    // Fetch all available futures symbols
    const symbols = await this.getAllFuturesSymbols()
    console.log(`📋 Found ${symbols.length} USDT-M perpetual futures`)

    // Fetch metrics for all symbols
    const allMetrics = await this.fetchMultipleSymbolMetrics(symbols, (progress) => {
      if (progress.completed % 10 === 0) {
        console.log(`📊 Progress: ${progress.completed}/${progress.total}`)
      }
    })

    // Filter to only passing symbols
    const passingMetrics = allMetrics.filter((m) => m.passes_filters)
    console.log(`✅ ${passingMetrics.length}/${allMetrics.length} symbols passed filters`)

    return passingMetrics
  }

  // Note: fetchKlineData, calculatePriceChanges, and extractVolumes methods removed
  // These were part of the old REST API polling approach
  // WebSocket streaming provides metrics directly from ring buffers

  /**
   * Evaluate filter rules and return detailed results
   * 
   * Filter rules from implementation plan:
   * - change_15m > 1
   * - change_1d < 15
   * - change_1h > change_15m
   * - change_8h > change_1h
   * - volume_15m > 400000
   * - volume_1h > 1000000
   * - 3 * volume_15m > volume_1h
   * - 26 * volume_15m > volume_8h
   * - marketcap > 23000000
   * - marketcap < 2500000000
   * 
   * @param metrics - Partial metrics object
   * @returns Filter results with passes_filters boolean and detailed checks
   */
  private evaluateFilters(
    metrics: Omit<FuturesMetrics, 'passes_filters' | 'filter_details'>
  ): Pick<FuturesMetrics, 'passes_filters' | 'filter_details'> {
    // Price checks
    const change_15m_gt_1 = metrics.change_15m > 1
    const change_1d_lt_15 = metrics.change_1d < 15
    const change_1h_gt_change_15m = metrics.change_1h > metrics.change_15m
    const change_8h_gt_change_1h = metrics.change_8h > metrics.change_1h

    // Volume checks
    const volume_15m_gt_400k = metrics.volume_15m > 400000
    const volume_1h_gt_1m = metrics.volume_1h > 1000000
    const three_vol15m_gt_vol1h = 3 * metrics.volume_15m > metrics.volume_1h
    const twentysix_vol15m_gt_vol8h = 26 * metrics.volume_15m > metrics.volume_8h

    // Market cap checks
    const marketcap_gt_23m = metrics.marketCap !== null && metrics.marketCap > 23000000
    const marketcap_lt_2500m = metrics.marketCap !== null && metrics.marketCap < 2500000000

    // All checks must pass
    const passes_filters =
      change_15m_gt_1 &&
      change_1d_lt_15 &&
      change_1h_gt_change_15m &&
      change_8h_gt_change_1h &&
      volume_15m_gt_400k &&
      volume_1h_gt_1m &&
      three_vol15m_gt_vol1h &&
      twentysix_vol15m_gt_vol8h &&
      marketcap_gt_23m &&
      marketcap_lt_2500m

    return {
      passes_filters,
      filter_details: {
        price_checks: {
          change_15m_gt_1,
          change_1d_lt_15,
          change_1h_gt_change_15m,
          change_8h_gt_change_1h,
        },
        volume_checks: {
          volume_15m_gt_400k,
          volume_1h_gt_1m,
          three_vol15m_gt_vol1h,
          twentysix_vol15m_gt_vol8h,
        },
        marketcap_checks: {
          marketcap_gt_23m,
          marketcap_lt_2500m,
        },
      },
    }
  }

  /**
   * Get CoinGecko ID for a symbol (helper method)
   */
  private getCoinGeckoId(symbol: string): string | null {
    return mapSymbolToCoinGeckoId(symbol)
  }
}

// Note: No singleton exported to avoid test mocking issues
// Create instances as needed: const service = new FuturesMetricsService()
