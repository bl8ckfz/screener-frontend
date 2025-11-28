/**
 * Currency pair types supported by the screener
 */
export type CurrencyPair =
  | 'USDT'
  | 'USDC'
  | 'USD'
  | 'BTC'
  | 'ETH'
  | 'BNB'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'AUD'
  | 'BRL'
  | 'RUB'
  | 'NGN'
  | 'ARS'
  | 'COP'
  | 'CZK'
  | 'MXN'
  | 'PLN'
  | 'RON'
  | 'UAH'
  | 'ZAR'
  | 'IDR'
  | 'BUSD'
  | 'TUSD'
  | 'FDUSD'
  | 'PAX'
  | 'DAI'
  | 'BIDR'
  | 'EURI'
  | 'USDP'
  | 'BKRW'

/**
 * Timeframe for historical comparison
 */
export type Timeframe =
  | '5s'
  | '10s'
  | '15s'
  | '30s'
  | '45s'
  | '60s'
  | '1m'
  | '3m'
  | '5m'
  | '15m'

/**
 * Array of all supported timeframes
 */
export const TIMEFRAMES: Timeframe[] = [
  '5s',
  '10s',
  '15s',
  '30s',
  '45s',
  '60s',
  '1m',
  '3m',
  '5m',
  '15m',
]

/**
 * Historical snapshot of coin data at a specific timeframe
 */
export interface TimeframeSnapshot {
  volume: number
  price: number
  weightedAvg: number
  priceToWA: number // price/weightedAvg ratio
  vcp: number // Volatility Contraction Pattern
  timestamp: number
}

/**
 * Fibonacci pivot levels
 */
export interface FibonacciLevels {
  resistance1: number // WA + 1.0 * (high-low)
  resistance0618: number // WA + 0.618 * (high-low)
  resistance0382: number // WA + 0.382 * (high-low)
  support0382: number // WA - 0.382 * (high-low)
  support0618: number // WA - 0.618 * (high-low)
  support1: number // WA - 1.0 * (high-low)
  pivot: number // (high + low + close) / 3
}

/**
 * Technical indicators calculated for each coin
 */
export interface TechnicalIndicators {
  // VCP - Volatility Contraction Pattern: (P/WA) * [((close-low)-(high-close))/(high-low)]
  vcp: number

  // Price ratios
  priceToWeightedAvg: number // lastPrice / weightedAvgPrice
  priceToHigh: number // lastPrice / highPrice
  lowToPrice: number // lowPrice / lastPrice
  highToLow: number // highPrice / lowPrice

  // Volume ratios
  askToVolume: number // askQty / volume
  priceToVolume: number // lastPrice / volume
  quoteToCount: number // quoteVolume / count
  tradesPerVolume: number // count / volume

  // Fibonacci levels
  fibonacci: FibonacciLevels

  // Weighted average based calculations
  pivotToWeightedAvg: number // pivot / weightedAvgPrice
  pivotToPrice: number // pivot / lastPrice

  // Change percentages
  priceChangeFromWeightedAvg: number // % change from weighted avg
  priceChangeFromPrevClose: number // % change from previous close

  // Market dominance ratios (vs ETH, BTC, PAXG)
  ethDominance: number // priceChange / ETH priceChange
  btcDominance: number // priceChange / BTC priceChange
  paxgDominance: number // priceChange / PAXG priceChange
}

/**
 * Coin data with all calculated fields
 */
export interface Coin {
  // Basic identification
  id: number // Row index
  symbol: string // Coin symbol (e.g., "BTC", "ETH")
  fullSymbol: string // Full symbol with pair (e.g., "BTCUSDT")
  pair: CurrencyPair // Trading pair

  // Price data (from API)
  lastPrice: number
  openPrice: number
  highPrice: number
  lowPrice: number
  prevClosePrice: number
  weightedAvgPrice: number
  priceChange: number
  priceChangePercent: number

  // Volume data (from API)
  volume: number // Base asset volume
  quoteVolume: number // Quote asset volume
  bidPrice: number
  bidQty: number
  askPrice: number
  askQty: number
  count: number // Number of trades

  // Time data
  openTime: number
  closeTime: number

  // Technical indicators
  indicators: TechnicalIndicators

  // Historical data for different timeframes
  history: {
    '5s'?: TimeframeSnapshot
    '10s'?: TimeframeSnapshot
    '15s'?: TimeframeSnapshot
    '30s'?: TimeframeSnapshot
    '45s'?: TimeframeSnapshot
    '60s'?: TimeframeSnapshot
    '1m'?: TimeframeSnapshot
    '3m'?: TimeframeSnapshot
    '5m'?: TimeframeSnapshot
    '15m'?: TimeframeSnapshot
  }

  // Delta calculations (change from historical snapshots)
  deltas?: {
    [key in Timeframe]?: {
      priceChange: number
      priceChangePercent: number
      volumeChange: number
      volumeChangePercent: number
      vcpChange: number
    }
  }

  // Metadata
  lastUpdated: number
}

/**
 * Simplified coin data for list display
 */
export interface CoinListItem {
  symbol: string
  lastPrice: number
  priceChangePercent: number
  volume: number
  quoteVolume: number
  vcp: number
  priceToWeightedAvg: number
}

/**
 * Coin sorting options
 */
export type CoinSortField =
  | 'symbol'
  | 'lastPrice'
  | 'priceChangePercent'
  | 'volume'
  | 'quoteVolume'
  | 'vcp'
  | 'priceToWeightedAvg'
  | 'highToLow'
  | 'count'

export type SortDirection = 'asc' | 'desc'

export interface CoinSort {
  field: CoinSortField
  direction: SortDirection
}
