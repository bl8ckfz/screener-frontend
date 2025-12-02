/**
 * Binance API 24hr Ticker Response
 * https://api.binance.com/api/v3/ticker/24hr
 */
export interface BinanceTicker24hr {
  symbol: string // e.g., "BTCUSDT"
  priceChange: string // Absolute price change
  priceChangePercent: string // Price change percentage
  weightedAvgPrice: string // Weighted average price
  prevClosePrice: string // Previous close price
  lastPrice: string // Current/last price
  lastQty: string // Last quantity
  bidPrice: string // Best bid price
  bidQty: string // Best bid quantity
  askPrice: string // Best ask price
  askQty: string // Best ask quantity
  openPrice: string // Open price (24h ago)
  highPrice: string // Highest price (24h)
  lowPrice: string // Lowest price (24h)
  volume: string // Base asset volume
  quoteVolume: string // Quote asset volume
  openTime: number // Open time timestamp
  closeTime: number // Close time timestamp
  firstId: number // First trade ID
  lastId: number // Last trade ID
  count: number // Number of trades
}

/**
 * Parsed and processed ticker data
 */
export interface ProcessedTicker {
  symbol: string
  priceChange: number
  priceChangePercent: number
  weightedAvgPrice: number
  prevClosePrice: number
  lastPrice: number
  lastQty: number
  bidPrice: number
  bidQty: number
  askPrice: number
  askQty: number
  openPrice: number
  highPrice: number
  lowPrice: number
  volume: number
  quoteVolume: number
  openTime: number
  closeTime: number
  firstId: number
  lastId: number
  count: number
}

/**
 * API error response
 */
export interface ApiError {
  code: number
  msg: string
}

/**
 * API request options
 */
export interface ApiRequestOptions {
  timeout?: number
  retries?: number
  retryDelay?: number
}

/**
 * Binance Exchange Info Symbol
 * https://api.binance.com/api/v3/exchangeInfo
 */
export interface BinanceSymbol {
  symbol: string
  status: string
  baseAsset: string
  quoteAsset: string
  [key: string]: any // Other fields we don't need
}

/**
 * Binance Exchange Info Response
 */
export interface BinanceExchangeInfo {
  symbols: BinanceSymbol[]
  [key: string]: any // Other fields we don't need
}
