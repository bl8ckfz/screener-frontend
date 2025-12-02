import type {
  BinanceTicker24hr,
  ProcessedTicker,
  ApiError,
  ApiRequestOptions,
  BinanceExchangeInfo,
  BinanceSymbol,
} from '@/types/api'
import { API_CONFIG } from '@/config/api'

/**
 * Cache for USDT trading pairs (avoid repeated API calls)
 */
let cachedUSDTPairs: string[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 3600000 // 1 hour in milliseconds

/**
 * Binance API client for fetching 24hr ticker data
 */
export class BinanceApiClient {
  private baseUrl: string
  private timeout: number
  private retries: number

  constructor(
    baseUrl: string = API_CONFIG.baseUrl,
    timeout: number = API_CONFIG.timeout,
    retries: number = API_CONFIG.retries
  ) {
    this.baseUrl = baseUrl
    this.timeout = timeout
    this.retries = retries
  }

  /**
   * Fetch USDT trading pairs from exchange info
   * Returns cached result if available and fresh
   */
  async fetchUSDTPairs(): Promise<string[]> {
    const now = Date.now()
    
    // Return cached pairs if still valid
    if (cachedUSDTPairs && now - cacheTimestamp < CACHE_DURATION) {
      console.log(`Using cached USDT pairs (${cachedUSDTPairs.length} symbols)`)
      return cachedUSDTPairs
    }

    try {
      const endpoint = '/exchangeInfo'
      const url = API_CONFIG.corsProxy
        ? `${API_CONFIG.corsProxy}${encodeURIComponent('https://api.binance.com/api/v3' + endpoint)}`
        : `${this.baseUrl}${endpoint}`

      console.log('Fetching USDT pairs from exchange info...')
      const data = await this.fetchWithRetry<BinanceExchangeInfo>(url)

      // Filter to USDT trading pairs with TRADING status
      const usdtPairs = data.symbols
        .filter((symbol: BinanceSymbol) => 
          symbol.quoteAsset === 'USDT' && 
          symbol.status === 'TRADING'
        )
        .map((symbol: BinanceSymbol) => symbol.symbol)

      console.log(`✅ Loaded ${usdtPairs.length} USDT trading pairs`)
      
      // Update cache
      cachedUSDTPairs = usdtPairs
      cacheTimestamp = now

      return usdtPairs
    } catch (error) {
      console.error('Failed to fetch USDT pairs from exchange info:', error)
      
      // If we have old cached data, use it as fallback
      if (cachedUSDTPairs) {
        console.warn('Using stale cached USDT pairs as fallback')
        return cachedUSDTPairs
      }
      
      throw error
    }
  }

  /**
   * Fetch 24hr ticker data for all symbols (filtered to USDT pairs only)
   */
  async fetch24hrTickers(): Promise<BinanceTicker24hr[]> {
    // Get valid USDT pairs first
    const usdtPairs = await this.fetchUSDTPairs()

    // Fetch all tickers
    const endpoint = '/ticker/24hr'
    const url = API_CONFIG.corsProxy 
      ? `${API_CONFIG.corsProxy}${encodeURIComponent('https://api.binance.com/api/v3' + endpoint)}`
      : `${this.baseUrl}${endpoint}`
    const data = await this.fetchWithRetry<BinanceTicker24hr[]>(url)

    // Ensure we have an array
    if (!Array.isArray(data)) {
      console.error('Unexpected response format:', data)
      throw new Error('Invalid response format: expected array')
    }

    // Filter to only USDT pairs
    const filtered = data.filter(ticker => usdtPairs.includes(ticker.symbol))
    console.log(`Filtered ${data.length} tickers to ${filtered.length} USDT pairs`)

    return filtered
  }

  /**
   * Fetch 24hr ticker data for a specific symbol
   */
  async fetch24hrTicker(symbol: string): Promise<BinanceTicker24hr> {
    const endpoint = `/ticker/24hr?symbol=${symbol.toUpperCase()}`
    const url = API_CONFIG.corsProxy 
      ? `${API_CONFIG.corsProxy}${encodeURIComponent('https://api.binance.com/api/v3' + endpoint)}`
      : `${this.baseUrl}${endpoint}`
    return this.fetchWithRetry<BinanceTicker24hr>(url)
  }

  /**
   * Fetch with automatic retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    options?: ApiRequestOptions
  ): Promise<T> {
    const maxRetries = options?.retries ?? this.retries
    const timeout = options?.timeout ?? this.timeout
    const retryDelay = options?.retryDelay ?? 1000

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, timeout)

        if (!response.ok) {
          // Try to parse Binance error response
          const errorData: ApiError = await response.json()
          throw new Error(
            `Binance API Error ${errorData.code}: ${errorData.msg}`
          )
        }

        const data: T = await response.json()
        return data
      } catch (error) {
        lastError = error as Error

        // Don't retry on the last attempt
        if (attempt < maxRetries) {
          console.warn(
            `API request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
          )
          await this.delay(retryDelay * (attempt + 1)) // Exponential backoff
        }
      }
    }

    throw new Error(
      `Failed to fetch from Binance API after ${maxRetries + 1} attempts: ${lastError?.message}`
    )
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-cache',
      })
      return response
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Parse raw ticker data to ProcessedTicker with numeric values
   */
  static parseTickerData(ticker: BinanceTicker24hr): ProcessedTicker {
    return {
      symbol: ticker.symbol,
      priceChange: parseFloat(ticker.priceChange),
      priceChangePercent: parseFloat(ticker.priceChangePercent),
      weightedAvgPrice: parseFloat(ticker.weightedAvgPrice),
      prevClosePrice: parseFloat(ticker.prevClosePrice),
      lastPrice: parseFloat(ticker.lastPrice),
      lastQty: parseFloat(ticker.lastQty),
      bidPrice: parseFloat(ticker.bidPrice),
      bidQty: parseFloat(ticker.bidQty),
      askPrice: parseFloat(ticker.askPrice),
      askQty: parseFloat(ticker.askQty),
      openPrice: parseFloat(ticker.openPrice),
      highPrice: parseFloat(ticker.highPrice),
      lowPrice: parseFloat(ticker.lowPrice),
      volume: parseFloat(ticker.volume),
      quoteVolume: parseFloat(ticker.quoteVolume),
      openTime: ticker.openTime,
      closeTime: ticker.closeTime,
      firstId: ticker.firstId,
      lastId: ticker.lastId,
      count: ticker.count,
    }
  }

  /**
   * Parse all tickers in a batch
   */
  static parseTickerBatch(tickers: BinanceTicker24hr[]): ProcessedTicker[] {
    return tickers.map((ticker) => BinanceApiClient.parseTickerData(ticker))
  }
}

/**
 * Singleton instance for easy access
 */
export const binanceApi = new BinanceApiClient()
