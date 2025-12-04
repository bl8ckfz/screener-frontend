import type { FuturesMetrics, ProcessedKlineData } from '@/types/api'
import { BinanceFuturesApiClient } from './binanceFuturesApi'
import { CoinGeckoApiClient } from './coinGeckoApi'
import { getCoinGeckoId as mapSymbolToCoinGeckoId } from '@/config/coinGeckoMapping'
import type { KlineInterval } from './binanceFuturesApi'

/**
 * Service for fetching and calculating comprehensive futures metrics
 * 
 * This service combines data from:
 * - Binance Futures API (price changes and volumes)
 * - CoinGecko API (market cap data)
 * 
 * And applies filtering logic based on:
 * - Price change thresholds
 * - Volume thresholds
 * - Market cap ranges
 */
export class FuturesMetricsService {
  private futuresClient: BinanceFuturesApiClient
  private coinGeckoClient: CoinGeckoApiClient
  private readonly intervals: KlineInterval[] = ['5m', '15m', '1h', '8h', '1d']

  constructor(
    futuresClient?: BinanceFuturesApiClient,
    coinGeckoClient?: CoinGeckoApiClient
  ) {
    this.futuresClient = futuresClient || new BinanceFuturesApiClient()
    this.coinGeckoClient = coinGeckoClient || new CoinGeckoApiClient()
  }

  /**
   * Fetch comprehensive metrics for a single symbol
   * 
   * @param symbol - Binance futures symbol (e.g., 'BTCUSDT')
   * @returns Complete metrics including price changes, volumes, market cap, and filter results
   * 
   * @example
   * const metrics = await service.fetchSymbolMetrics('BTCUSDT')
   * console.log(metrics.change_1h, metrics.volume_1h, metrics.marketCap)
   */
  async fetchSymbolMetrics(symbol: string): Promise<FuturesMetrics> {
    const startTime = Date.now()

    try {
      // Fetch kline data for all intervals in parallel
      const klineData = await this.fetchKlineData(symbol)

      // Calculate price changes for each interval
      const priceChanges = this.calculatePriceChanges(klineData)

      // Extract volumes for each interval
      const volumes = this.extractVolumes(klineData)

      // Fetch market cap (with caching)
      const marketCap = await this.coinGeckoClient.fetchMarketCap(symbol)
      const coinGeckoId = this.getCoinGeckoId(symbol)

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

      const duration = Date.now() - startTime
      console.log(`✅ Fetched metrics for ${symbol} in ${duration}ms`)

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
    onProgress?: (progress: { completed: number; total: number; current: string }) => void
  ): Promise<FuturesMetrics[]> {
    console.log(`📊 Fetching metrics for ${symbols.length} symbols...`)
    const startTime = Date.now()

    const results: FuturesMetrics[] = []
    let completed = 0

    // Process symbols with controlled concurrency to avoid rate limits
    const concurrency = 5 // Process 5 symbols at a time
    for (let i = 0; i < symbols.length; i += concurrency) {
      const batch = symbols.slice(i, i + concurrency)
      const batchPromises = batch.map(async (symbol) => {
        try {
          const metrics = await this.fetchSymbolMetrics(symbol)
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
    const symbols = await this.futuresClient.fetchAllFuturesSymbols()
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

  /**
   * Fetch kline data for all intervals in parallel
   * 
   * @param symbol - Trading pair symbol
   * @returns Map of interval to processed kline data
   */
  private async fetchKlineData(symbol: string): Promise<Map<KlineInterval, ProcessedKlineData>> {
    const klinesMap = await this.futuresClient.fetchMultipleKlines(symbol, this.intervals)
    const processedMap = new Map<KlineInterval, ProcessedKlineData>()

    for (const [interval, klines] of klinesMap.entries()) {
      const processed = this.futuresClient.processKlineData(klines, interval)
      processedMap.set(interval, processed)
    }

    return processedMap
  }

  /**
   * Calculate price changes for all intervals
   * 
   * @param klineData - Map of interval to processed kline data
   * @returns Object with price changes for each interval
   */
  private calculatePriceChanges(
    klineData: Map<KlineInterval, ProcessedKlineData>
  ): {
    change_5m: number
    change_15m: number
    change_1h: number
    change_8h: number
    change_1d: number
  } {
    const calculate = (interval: KlineInterval): number => {
      const data = klineData.get(interval)
      if (!data) return 0

      const { previous, current } = data
      return ((current.close / previous.close) - 1) * 100
    }

    return {
      change_5m: calculate('5m'),
      change_15m: calculate('15m'),
      change_1h: calculate('1h'),
      change_8h: calculate('8h'),
      change_1d: calculate('1d'),
    }
  }

  /**
   * Extract quote volumes (USDT) for all intervals
   * 
   * @param klineData - Map of interval to processed kline data
   * @returns Object with volumes for each interval
   */
  private extractVolumes(
    klineData: Map<KlineInterval, ProcessedKlineData>
  ): {
    volume_5m: number
    volume_15m: number
    volume_1h: number
    volume_8h: number
    volume_1d: number
  } {
    const extract = (interval: KlineInterval): number => {
      const data = klineData.get(interval)
      if (!data) return 0

      // Use current candle's quote volume (USDT volume)
      return data.current.quoteVolume
    }

    return {
      volume_5m: extract('5m'),
      volume_15m: extract('15m'),
      volume_1h: extract('1h'),
      volume_8h: extract('8h'),
      volume_1d: extract('1d'),
    }
  }

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

/**
 * Singleton instance for convenient access
 */
export const futuresMetricsService = new FuturesMetricsService()
