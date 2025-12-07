import type { FuturesMetrics } from '@/types/api'
import { CoinGeckoApiClient } from './coinGeckoApi'
import { getCoinGeckoId as mapSymbolToCoinGeckoId } from '@/config/coinGeckoMapping'
import { WebSocketStreamManager } from './webSocketStreamManager'
import type { PartialChangeMetrics, WarmupStatus } from '@/types/metrics'
import { BinanceFuturesApiClient } from './binanceFuturesApi'

/**
 * Service for fetching and calculating comprehensive futures metrics
 * 
 * Uses WebSocket streaming for real-time data with zero API requests.
 * 
 * Data sources:
 * - Binance Futures WebSocket (real-time price changes and volumes)
 * - CoinGecko API (market cap data - cached)
 * 
 * Warm-up phase: Gradual data accumulation over 24 hours
 * - 5 min   → 5m metrics ready
 * - 15 min  → 15m metrics ready
 * - 1 hour  → 1h metrics ready
 * - 4 hours → 4h metrics ready
 * - 8 hours → 8h metrics ready
 * - 12 hours → 12h metrics ready
 * - 24 hours → All metrics ready (fully warmed up)
 * 
 * Filtering logic based on:
 * - Price change thresholds
 * - Volume thresholds
 * - Market cap ranges
 */
export class FuturesMetricsService {
  private coinGeckoClient: CoinGeckoApiClient
  private wsStreamManager: WebSocketStreamManager
  private futuresClient: BinanceFuturesApiClient

  constructor(
    coinGeckoClient?: CoinGeckoApiClient
  ) {
    this.coinGeckoClient = coinGeckoClient || new CoinGeckoApiClient()
    this.futuresClient = new BinanceFuturesApiClient()
    this.wsStreamManager = new WebSocketStreamManager({
      autoReconnect: true,
      batchSize: 200,
      enableBackfill: true, // Backfill 288 candles (24h) at startup for instant data
    })
  }

  /**
   * Initialize WebSocket streaming
   * Call this once on app startup to begin streaming data
   * 
   * Strategy:
   * 1. Connect WebSocket and get all tickers (~500 symbols)
   * 2. Sort by 24h quote volume (most liquid first)
   * 3. Take top 200 symbols (Binance WebSocket limit)
   * 4. Subscribe to kline streams for those symbols
   * 
   * @param symbols - Array of symbols to stream (optional, uses top 200 by volume if not provided)
   */
  async initialize(symbols?: string[]): Promise<void> {
    console.log('🚀 Initializing WebSocket streaming...')
    
    let symbolsToStream: string[]
    
    if (symbols) {
      // Use provided symbols
      symbolsToStream = symbols
    } else {
      // Get top 200 most liquid symbols from ticker stream
      symbolsToStream = await this.wsStreamManager.getTopLiquidSymbols(200)
      console.log(`📈 Selected top 200 symbols by 24h volume`)
      console.log(`🔝 Top 10: ${symbolsToStream.slice(0, 10).join(', ')}`)
    }
    
    await this.wsStreamManager.start(symbolsToStream)
    console.log('✅ WebSocket streaming initialized')
  }

  /**
   * Get warm-up status for UI indicators
   * 
   * @returns Current warm-up progress
   */
  getWarmupStatus(): WarmupStatus {
    return this.wsStreamManager.getWarmupStatus()
  }

  /**
   * Subscribe to real-time metrics updates
   * 
   * @param handler - Callback for metrics updates
   * @returns Unsubscribe function
   */
  onMetricsUpdate(handler: (data: { symbol: string; metrics: PartialChangeMetrics }) => void): () => void {
    this.wsStreamManager.on('metricsUpdate', handler)
    return () => {
      // EventEmitter removeListener would go here
      // For now, this is a placeholder
    }
  }

  /**
   * Subscribe to real-time ticker updates
   * 
   * @param handler - Callback for ticker batch updates
   * @returns Unsubscribe function
   */
  onTickerUpdate(handler: (data: { tickers: any[]; timestamp: number }) => void): () => void {
    this.wsStreamManager.on('tickerUpdate', handler)
    return () => {
      // EventEmitter removeListener would go here
    }
  }

  /**
   * Subscribe to tickers ready event (fires when initial market data is available)
   * 
   * @param handler - Callback when tickers are ready
   * @returns Unsubscribe function
   */
  onTickersReady(handler: () => void): () => void {
    this.wsStreamManager.on('tickersReady', handler)
    return () => {
      this.wsStreamManager.off('tickersReady', handler)
    }
  }

  /**
   * Subscribe to backfill progress updates
   * 
   * @param handler - Callback for progress updates
   * @returns Unsubscribe function
   */
  onBackfillProgress(handler: (data: { completed: number; total: number; progress: number }) => void): () => void {
    this.wsStreamManager.on('backfillProgress', handler)
    return () => {
      this.wsStreamManager.off('backfillProgress', handler)
    }
  }

  /**
   * Subscribe to backfill complete event
   * 
   * @param handler - Callback when backfill is complete
   * @returns Unsubscribe function
   */
  onBackfillComplete(handler: () => void): () => void {
    this.wsStreamManager.on('backfillComplete', handler)
    return () => {
      this.wsStreamManager.off('backfillComplete', handler)
    }
  }

  /**
   * Stop WebSocket streaming and cleanup
   */
  stop(): void {
    this.wsStreamManager.stop()
  }

  /**
   * Fetch comprehensive metrics for a single symbol from WebSocket stream
   * 
   * Returns real-time metrics from ring buffers (may have null values during warm-up).
   * Null values are defaulted to 0 for compatibility with filter logic.
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
      // Get from WebSocket stream (may have null values during warm-up)
      const partialMetrics = this.wsStreamManager.getMetrics(symbol)
      
      let priceChanges, volumes
      
      if (partialMetrics) {
        // Map WebSocket metrics to service format, defaulting nulls to 0
        priceChanges = {
          change_5m: partialMetrics.change_5m ?? 0,
          change_15m: partialMetrics.change_15m ?? 0,
          change_1h: partialMetrics.change_1h ?? 0,
          change_8h: partialMetrics.change_8h ?? 0,
          change_1d: partialMetrics.change_1d ?? 0,
        }
        volumes = {
          volume_5m: partialMetrics.quoteVolume_5m ?? 0,
          volume_15m: partialMetrics.quoteVolume_15m ?? 0,
          volume_1h: partialMetrics.quoteVolume_1h ?? 0,
          volume_8h: partialMetrics.quoteVolume_8h ?? 0,
          volume_1d: partialMetrics.quoteVolume_1d ?? 0,
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
   * Get all ticker data from WebSocket stream
   * Includes live market data, funding rates, mark prices
   * 
   * @returns Array of ticker data for all symbols
   */
  getAllTickerData(): any[] {
    return this.wsStreamManager.getAllTickerData()
  }

  /**
   * Get ticker data for specific symbol
   * 
   * @param symbol - Symbol to get ticker for
   * @returns Ticker data or undefined if not available
   */
  getTickerData(symbol: string): any {
    return this.wsStreamManager.getTickerData(symbol)
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
