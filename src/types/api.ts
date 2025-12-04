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
  message?: string
  msg?: string
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

/**
 * Binance Futures Kline (Candlestick) Data
 * https://binance-docs.github.io/apidocs/futures/en/#kline-candlestick-data
 */
export interface BinanceFuturesKline {
  openTime: number // [0] Kline open time
  open: string // [1] Open price
  high: string // [2] High price
  low: string // [3] Low price
  close: string // [4] Close price
  volume: string // [5] Volume (base asset)
  closeTime: number // [6] Kline close time
  quoteVolume: string // [7] Quote asset volume (USDT volume)
  trades: number // [8] Number of trades
  takerBuyBaseVolume: string // [9] Taker buy base asset volume
  takerBuyQuoteVolume: string // [10] Taker buy quote asset volume
  ignore: string // [11] Unused field
}

/**
 * Processed kline data with previous and current candles
 */
export interface ProcessedKlineData {
  interval: '5m' | '15m' | '1h' | '8h' | '1d'
  previous: {
    open: number
    high: number
    low: number
    close: number
    volume: number
    quoteVolume: number
    openTime: number
    closeTime: number
  }
  current: {
    open: number
    high: number
    low: number
    close: number
    volume: number
    quoteVolume: number
    openTime: number
    closeTime: number
  }
}

/**
 * Binance Futures Exchange Info Symbol
 */
export interface BinanceFuturesSymbol {
  symbol: string
  status: string
  baseAsset: string
  quoteAsset: string
  contractType: string // 'PERPETUAL' or 'CURRENT_QUARTER', etc.
  [key: string]: any // Other fields we don't need
}

/**
 * Binance Futures Exchange Info Response
 */
export interface BinanceFuturesExchangeInfo {
  symbols: BinanceFuturesSymbol[]
  [key: string]: any // Other fields we don't need
}

/**
 * CoinGecko coin data response
 */
export interface CoinGeckoMarketData {
  id: string
  symbol: string
  name: string
  market_data: {
    market_cap: {
      usd: number
    }
    current_price: {
      usd: number
    }
    total_volume: {
      usd: number
    }
    circulating_supply: number
  }
}

/**
 * Futures metrics with all calculated values
 */
export interface FuturesMetrics {
  symbol: string
  timestamp: number

  // Price changes (%)
  change_5m: number
  change_15m: number
  change_1h: number
  change_8h: number
  change_1d: number

  // Volumes (quote asset - USDT)
  volume_5m: number
  volume_15m: number
  volume_1h: number
  volume_8h: number
  volume_1d: number

  // Market cap from CoinGecko
  marketCap: number | null
  coinGeckoId: string | null

  // Filter results
  passes_filters: boolean
  filter_details: {
    price_checks: {
      change_15m_gt_1: boolean // change_15m > 1
      change_1d_lt_15: boolean // change_1d < 15
      change_1h_gt_change_15m: boolean // change_1h > change_15m
      change_8h_gt_change_1h: boolean // change_8h > change_1h
    }
    volume_checks: {
      volume_15m_gt_400k: boolean // volume_15m > 400000
      volume_1h_gt_1m: boolean // volume_1h > 1000000
      three_vol15m_gt_vol1h: boolean // 3 * volume_15m > volume_1h
      twentysix_vol15m_gt_vol8h: boolean // 26 * volume_15m > volume_8h
    }
    marketcap_checks: {
      marketcap_gt_23m: boolean // marketcap > 23000000
      marketcap_lt_2500m: boolean // marketcap < 2500000000
    }
  }
}
