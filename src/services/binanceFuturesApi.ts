import type {
  BinanceFuturesKline,
  ProcessedKlineData,
  ApiError,
  BinanceFuturesExchangeInfo,
  BinanceFuturesSymbol,
  Candle1m,
} from '@/types/api'
import { API_CONFIG } from '@/config/api'

/**
 * Supported kline intervals for futures data
 */
export type KlineInterval = '5m' | '15m' | '1h' | '8h' | '1d'

/**
 * Cache for USDT-M futures symbols (avoid repeated API calls)
 */
let cachedFuturesSymbols: string[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 3600000 // 1 hour in milliseconds

/**
 * Simple rate limiter to prevent 418 errors
 * Binance has strict rate limits, especially through CORS proxies
 * 
 * Strategy: 200ms delay = max 5 req/sec = 300 req/min (conservative to avoid rate limiting)
 * Increased from 50ms due to persistent 418 errors - Binance is very strict
 * Testing: Disable in test environment for speed
 */
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = import.meta.env.VITEST ? 0 : 200 // ms between requests

async function rateLimitedDelay(): Promise<void> {
  if (MIN_REQUEST_INTERVAL === 0) return // Skip in tests
  
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  lastRequestTime = Date.now()
}

/**
 * Binance Futures API client for fetching kline data and exchange information
 * 
 * API Documentation: https://binance-docs.github.io/apidocs/futures/en/
 */
export class BinanceFuturesApiClient {
  private baseUrl: string
  private timeout: number
  private retries: number

  constructor(
    baseUrl: string = API_CONFIG.futuresBaseUrl,
    timeout: number = API_CONFIG.timeout,
    retries: number = API_CONFIG.retries
  ) {
    this.baseUrl = baseUrl
    this.timeout = timeout
    this.retries = retries
  }

  /**
   * Fetch kline/candlestick data for a specific symbol and interval
   * 
   * @param symbol - Trading pair symbol (e.g., 'BTCUSDT')
   * @param interval - Kline interval ('5m', '15m', '1h', '8h', '1d')
   * @param limit - Number of klines to fetch (default: 2 for current + previous)
   * @returns Array of kline data
   * 
   * @example
   * const klines = await client.fetchKlines('BTCUSDT', '1h', 2)
   */
  async fetchKlines(
    symbol: string,
    interval: KlineInterval,
    limit: number = 2
  ): Promise<BinanceFuturesKline[]> {
    const endpoint = '/fapi/v1/klines'
    const params = new URLSearchParams({
      symbol,
      interval,
      limit: limit.toString(),
    })

    const url = API_CONFIG.corsProxy
      ? `${API_CONFIG.corsProxy}${encodeURIComponent(`https://fapi.binance.com${endpoint}?${params}`)}`
      : `${this.baseUrl}${endpoint}?${params}`

    try {
      const data = await this.fetchWithRetry<any[]>(url)
      return this.parseKlineResponse(data)
    } catch (error) {
      console.error(`Failed to fetch klines for ${symbol} ${interval}:`, error)
      throw error
    }
  }

  /**
   * Fetch klines for multiple intervals with rate limiting
   * 
   * Fetches sequentially to avoid 418 rate limit errors
   * 
   * @param symbol - Trading pair symbol
   * @param intervals - Array of intervals to fetch
   * @returns Map of interval to kline data
   * 
   * @example
   * const klines = await client.fetchMultipleKlines('BTCUSDT', ['5m', '15m', '1h'])
   */
  async fetchMultipleKlines(
    symbol: string,
    intervals: KlineInterval[]
  ): Promise<Map<KlineInterval, BinanceFuturesKline[]>> {
    const results = new Map<KlineInterval, BinanceFuturesKline[]>()
    
    // Fetch sequentially with rate limiting to avoid 418 errors
    for (const interval of intervals) {
      await rateLimitedDelay()
      const klines = await this.fetchKlines(symbol, interval, 2)
      results.set(interval, klines)
    }

    return results
  }

  /**
   * Fetch 1m klines for backfill (optimized for 1m sliding windows)
   * 
   * Returns minimal Candle1m format (only essential fields)
   * Used to backfill 24 hours of 1m candles (1440 candles)
   * 
   * @param symbol - Trading pair symbol (e.g., 'BTCUSDT')
   * @param limit - Number of candles to fetch (default: 1440 for 24h, max: 1500)
   * @returns Array of 1m candles in minimal format
   * 
   * @example
   * const candles = await client.fetch1mKlines('BTCUSDT', 1440)
   * // Returns 24 hours of 1m candles
   */
  async fetch1mKlines(
    symbol: string,
    limit: number = 1440
  ): Promise<Candle1m[]> {
    const endpoint = '/fapi/v1/klines'
    const params = new URLSearchParams({
      symbol,
      interval: '1m',
      limit: Math.min(limit, 1500).toString(), // Binance max per request
    })

    const url = API_CONFIG.corsProxy
      ? `${API_CONFIG.corsProxy}${encodeURIComponent(`https://fapi.binance.com${endpoint}?${params}`)}`
      : `${this.baseUrl}${endpoint}?${params}`

    try {
      await rateLimitedDelay()
      const data = await this.fetchWithRetry<any[]>(url)
      
      // Convert to minimal Candle1m format (32 bytes per candle)
      return data.map((kline: any[]) => ({
        openTime: kline[0],
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        quoteVolume: parseFloat(kline[7]),
      }))
    } catch (error) {
      console.error(`❌ Failed to fetch 1m klines for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Backfill 1m candles for multiple symbols (batched with rate limiting)
   * 
   * Fetches 24h of 1m candles for each symbol in batches to avoid rate limiting
   * Provides progress callbacks for UI feedback
   * 
   * @param symbols - Array of symbols to backfill
   * @param options - Backfill configuration
   * @returns Backfill results with successful/failed symbols and data
   * 
   * @example
   * const result = await client.backfill1mCandles(['BTCUSDT', 'ETHUSDT'], {
   *   batchSize: 10,
   *   batchDelay: 1000,
   *   onProgress: (completed, total) => console.log(`${completed}/${total}`)
   * })
   */
  async backfill1mCandles(
    symbols: string[],
    options: {
      batchSize?: number
      batchDelay?: number
      onProgress?: (completed: number, total: number, symbol: string) => void
    } = {}
  ): Promise<{
    successful: string[]
    failed: Array<{ symbol: string; error: string }>
    data: Map<string, Candle1m[]>
  }> {
    const batchSize = options.batchSize ?? 10
    const batchDelay = options.batchDelay ?? 1000 // 1s delay between batches
    
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ symbol: string; error: string }>,
      data: new Map<string, Candle1m[]>(),
    }
    
    console.log(`🔧 Starting backfill for ${symbols.length} symbols...`)
    console.log(`📊 Batch size: ${batchSize}, delay: ${batchDelay}ms`)
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(symbols.length / batchSize)
      
      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} symbols)...`)
      
      const batchPromises = batch.map(async (symbol) => {
        try {
          const candles = await this.fetch1mKlines(symbol, 1440)
          results.data.set(symbol, candles)
          results.successful.push(symbol)
          console.log(`✅ Backfilled ${symbol}: ${candles.length} candles`)
          
          if (options.onProgress) {
            options.onProgress(
              results.successful.length + results.failed.length,
              symbols.length,
              symbol
            )
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(`❌ Failed to backfill ${symbol}: ${errorMsg}`)
          results.failed.push({ symbol, error: errorMsg })
        }
      })
      
      await Promise.all(batchPromises)
      
      // Rate limiting delay between batches
      if (i + batchSize < symbols.length) {
        console.log(`⏳ Waiting ${batchDelay}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, batchDelay))
      }
    }
    
    console.log(`✅ Backfill complete: ${results.successful.length} successful, ${results.failed.length} failed`)
    
    if (results.failed.length > 0) {
      console.warn(`❌ Failed symbols:`, results.failed.map(f => f.symbol).join(', '))
    }
    
    return results
  }

  /**
   * Fetch all USDT-M futures symbols from exchange info
   * Returns cached result if available and fresh
   * 
   * @returns Array of USDT-M futures symbols
   * 
   * @example
   * const symbols = await client.fetchAllFuturesSymbols()
   * // ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', ...]
   */
  async fetchAllFuturesSymbols(): Promise<string[]> {
    const now = Date.now()

    // Return cached symbols if still valid
    if (cachedFuturesSymbols && now - cacheTimestamp < CACHE_DURATION) {
      console.log(`Using cached Futures symbols (${cachedFuturesSymbols.length} symbols)`)
      return cachedFuturesSymbols
    }

    try {
      const endpoint = '/fapi/v1/exchangeInfo'
      const url = API_CONFIG.corsProxy
        ? `${API_CONFIG.corsProxy}${encodeURIComponent(`https://fapi.binance.com${endpoint}`)}`
        : `${this.baseUrl}${endpoint}`

      console.log('Fetching USDT-M futures symbols from exchange info...')
      const data = await this.fetchWithRetry<BinanceFuturesExchangeInfo>(url)

      // Filter to USDT-M perpetual futures with TRADING status
      const futuresSymbols = data.symbols
        .filter((symbol: BinanceFuturesSymbol) =>
          symbol.quoteAsset === 'USDT' &&
          symbol.status === 'TRADING' &&
          symbol.contractType === 'PERPETUAL'
        )
        .map((symbol: BinanceFuturesSymbol) => symbol.symbol)

      console.log(`✅ Loaded ${futuresSymbols.length} USDT-M futures symbols`)

      // Update cache
      cachedFuturesSymbols = futuresSymbols
      cacheTimestamp = now

      return futuresSymbols
    } catch (error) {
      console.error('Failed to fetch Futures symbols from exchange info:', error)

      // If we have old cached data, use it as fallback
      if (cachedFuturesSymbols) {
        console.warn('Using stale cached Futures symbols as fallback')
        return cachedFuturesSymbols
      }

      throw error
    }
  }

  /**
   * Fetch 24hr ticker price change statistics for all symbols
   * 
   * @returns Array of 24hr ticker data for all USDT-M perpetual futures
   * 
   * @example
   * const tickers = await client.fetch24hrTickers()
   */
  async fetch24hrTickers(): Promise<any[]> {
    try {
      const endpoint = '/fapi/v1/ticker/24hr'
      const url = API_CONFIG.corsProxy
        ? `${API_CONFIG.corsProxy}${encodeURIComponent(`https://fapi.binance.com${endpoint}`)}`
        : `${this.baseUrl}${endpoint}`

      const data = await this.fetchWithRetry<any[]>(url)

      // Filter to USDT-M perpetual futures only
      const usdtTickers = data.filter((ticker: any) => ticker.symbol.endsWith('USDT'))

      return usdtTickers
    } catch (error) {
      console.error('Failed to fetch 24hr tickers:', error)
      throw error
    }
  }

  /**
   * Process kline data into structured format with previous and current candles
   * 
   * @param klines - Array of klines (expected: 2 for previous + current)
   * @param interval - The kline interval
   * @returns Processed kline data with previous and current candles
   */
  processKlineData(
    klines: BinanceFuturesKline[],
    interval: KlineInterval
  ): ProcessedKlineData {
    if (klines.length < 2) {
      throw new Error(`Expected at least 2 klines, got ${klines.length}`)
    }

    const [prev, curr] = klines

    return {
      interval,
      previous: {
        openTime: prev.openTime,
        closeTime: prev.closeTime,
        open: parseFloat(prev.open),
        high: parseFloat(prev.high),
        low: parseFloat(prev.low),
        close: parseFloat(prev.close),
        volume: parseFloat(prev.volume),
        quoteVolume: parseFloat(prev.quoteVolume),
      },
      current: {
        openTime: curr.openTime,
        closeTime: curr.closeTime,
        open: parseFloat(curr.open),
        high: parseFloat(curr.high),
        low: parseFloat(curr.low),
        close: parseFloat(curr.close),
        volume: parseFloat(curr.volume),
        quoteVolume: parseFloat(curr.quoteVolume),
      },
    }
  }

  /**
   * Parse raw Binance kline array response into typed objects
   * 
   * @param data - Raw kline array from API
   * @returns Array of typed kline objects
   */
  private parseKlineResponse(data: any[]): BinanceFuturesKline[] {
    return data.map((kline) => ({
      openTime: kline[0],
      open: kline[1],
      high: kline[2],
      low: kline[3],
      close: kline[4],
      volume: kline[5],
      closeTime: kline[6],
      quoteVolume: kline[7],
      trades: kline[8],
      takerBuyBaseVolume: kline[9],
      takerBuyQuoteVolume: kline[10],
      ignore: kline[11],
    }))
  }

  /**
   * Fetch with retry logic, rate limiting, and exponential backoff
   * 
   * @param url - URL to fetch
   * @param attempt - Current attempt number (for recursion)
   * @returns Parsed JSON response
   */
  private async fetchWithRetry<T>(url: string, attempt: number = 1): Promise<T> {
    // Apply rate limiting to all requests
    await rateLimitedDelay()
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error: ApiError = {
          code: response.status,
          message: `HTTP ${response.status}: ${response.statusText}`,
        }
        throw error
      }

      return await response.json()
    } catch (error) {
      // If we've exhausted retries, throw the error
      if (attempt >= this.retries) {
        console.error(`Failed after ${this.retries} attempts:`, error)
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`)

      await new Promise((resolve) => setTimeout(resolve, delay))
      return this.fetchWithRetry<T>(url, attempt + 1)
    }
  }
}

/**
 * Singleton instance for convenient access
 */
export const binanceFuturesApi = new BinanceFuturesApiClient()
