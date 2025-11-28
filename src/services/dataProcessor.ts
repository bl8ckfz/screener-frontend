import type { ProcessedTicker } from '@/types/api'
import type { Coin, CurrencyPair } from '@/types/coin'

/**
 * List of known problematic/delisted coins to filter out
 * (from fast.html bozuklar array)
 */
const EXCLUDED_COINS = [
  'BCHABC',
  'BCHSV',
  'USDS',
  'USDSB',
  'BKRW',
  'LUNA',
  'LUNC',
  'USTC',
]

/**
 * Currency pair configurations
 * Maps pair suffix to its length for parsing
 */
const CURRENCY_PAIRS: Record<string, { suffix: string; length: number }> = {
  // 5-character pairs (check longest first)
  FDUSD: { suffix: 'FDUSD', length: 5 },

  // 4-character pairs
  USDT: { suffix: 'USDT', length: 4 },
  USDC: { suffix: 'USDC', length: 4 },
  BUSD: { suffix: 'BUSD', length: 4 },
  TUSD: { suffix: 'TUSD', length: 4 },
  BIDR: { suffix: 'BIDR', length: 4 },
  EURI: { suffix: 'EURI', length: 4 },
  USDP: { suffix: 'USDP', length: 4 },
  BKRW: { suffix: 'BKRW', length: 4 },

  // 3-character pairs
  USD: { suffix: 'USD', length: 3 },
  EUR: { suffix: 'EUR', length: 3 },
  GBP: { suffix: 'GBP', length: 3 },
  JPY: { suffix: 'JPY', length: 3 },
  AUD: { suffix: 'AUD', length: 3 },
  BRL: { suffix: 'BRL', length: 3 },
  RUB: { suffix: 'RUB', length: 3 },
  NGN: { suffix: 'NGN', length: 3 },
  ARS: { suffix: 'ARS', length: 3 },
  COP: { suffix: 'COP', length: 3 },
  CZK: { suffix: 'CZK', length: 3 },
  MXN: { suffix: 'MXN', length: 3 },
  PLN: { suffix: 'PLN', length: 3 },
  RON: { suffix: 'RON', length: 3 },
  UAH: { suffix: 'UAH', length: 3 },
  ZAR: { suffix: 'ZAR', length: 3 },
  IDR: { suffix: 'IDR', length: 3 },
  BTC: { suffix: 'BTC', length: 3 },
  ETH: { suffix: 'ETH', length: 3 },
  BNB: { suffix: 'BNB', length: 3 },
  PAX: { suffix: 'PAX', length: 3 },
  DAI: { suffix: 'DAI', length: 3 },
}

/**
 * Parse symbol to extract coin name and currency pair
 */
export function parseSymbol(symbol: string): {
  coin: string
  pair: CurrencyPair
} | null {
  // Check each currency pair from longest to shortest
  const pairEntries = Object.entries(CURRENCY_PAIRS).sort(
    (a, b) => b[1].length - a[1].length
  )

  for (const [pairName, config] of pairEntries) {
    if (symbol.endsWith(config.suffix)) {
      const coin = symbol.slice(0, -config.length)

      // Filter out excluded coins
      if (EXCLUDED_COINS.includes(coin)) {
        return null
      }

      return {
        coin,
        pair: pairName as CurrencyPair,
      }
    }
  }

  return null
}

/**
 * Filter tickers by currency pair
 */
export function filterTickersByPair(
  tickers: ProcessedTicker[],
  pair: CurrencyPair
): ProcessedTicker[] {
  return tickers.filter((ticker) => {
    const parsed = parseSymbol(ticker.symbol)
    return parsed && parsed.pair === pair
  })
}

/**
 * Convert ProcessedTicker to basic Coin data (without indicators)
 */
export function tickerToCoin(
  ticker: ProcessedTicker,
  index: number
): Coin | null {
  const parsed = parseSymbol(ticker.symbol)
  if (!parsed) return null

  const coin: Coin = {
    id: index,
    symbol: parsed.coin,
    fullSymbol: ticker.symbol,
    pair: parsed.pair,

    // Price data
    lastPrice: ticker.lastPrice,
    openPrice: ticker.openPrice,
    highPrice: ticker.highPrice,
    lowPrice: ticker.lowPrice,
    prevClosePrice: ticker.prevClosePrice,
    weightedAvgPrice: ticker.weightedAvgPrice,
    priceChange: ticker.priceChange,
    priceChangePercent: ticker.priceChangePercent,

    // Volume data
    volume: ticker.volume,
    quoteVolume: ticker.quoteVolume,
    bidPrice: ticker.bidPrice,
    bidQty: ticker.bidQty,
    askPrice: ticker.askPrice,
    askQty: ticker.askQty,
    count: ticker.count,

    // Time data
    openTime: ticker.openTime,
    closeTime: ticker.closeTime,

    // Indicators will be calculated separately
    indicators: {
      vcp: 0,
      priceToWeightedAvg: 0,
      priceToHigh: 0,
      lowToPrice: 0,
      highToLow: 0,
      askToVolume: 0,
      priceToVolume: 0,
      quoteToCount: 0,
      tradesPerVolume: 0,
      fibonacci: {
        resistance1: 0,
        resistance0618: 0,
        resistance0382: 0,
        support0382: 0,
        support0618: 0,
        support1: 0,
        pivot: 0,
      },
      pivotToWeightedAvg: 0,
      pivotToPrice: 0,
      priceChangeFromWeightedAvg: 0,
      priceChangeFromPrevClose: 0,
      ethDominance: 0,
      btcDominance: 0,
      paxgDominance: 0,
    },

    // Empty history for now
    history: {},

    // Metadata
    lastUpdated: Date.now(),
  }

  return coin
}

/**
 * Process batch of tickers into coins for a specific pair
 */
export function processTickersForPair(
  tickers: ProcessedTicker[],
  pair: CurrencyPair
): Coin[] {
  const filteredTickers = filterTickersByPair(tickers, pair)

  const coins: Coin[] = []
  let index = 0

  for (const ticker of filteredTickers) {
    const coin = tickerToCoin(ticker, index)
    if (coin) {
      coins.push(coin)
      index++
    }
  }

  return coins
}

/**
 * Find specific coins by symbol (for reference calculations like ETH, BTC, PAXG)
 */
export function findCoinBySymbol(coins: Coin[], symbol: string): Coin | null {
  return coins.find((coin) => coin.symbol === symbol) || null
}

/**
 * Get market statistics from coin array
 */
export function getMarketStats(coins: Coin[]) {
  const bullishCoins = coins.filter((c) => c.priceChangePercent > 0)
  const bearishCoins = coins.filter((c) => c.priceChangePercent < 0)
  const neutralCoins = coins.filter((c) => c.priceChangePercent === 0)

  const totalPriceChange = coins.reduce(
    (sum, c) => sum + c.priceChangePercent,
    0
  )
  const totalWeightedAvg = coins.reduce((sum, c) => sum + c.weightedAvgPrice, 0)
  const totalVolume = coins.reduce((sum, c) => sum + c.quoteVolume, 0)

  return {
    totalCoins: coins.length,
    bullishCount: bullishCoins.length,
    bearishCount: bearishCoins.length,
    neutralCount: neutralCoins.length,
    bullishPercent: (bullishCoins.length / coins.length) * 100,
    bearishPercent: (bearishCoins.length / coins.length) * 100,
    neutralPercent: (neutralCoins.length / coins.length) * 100,
    avgPriceChange: totalPriceChange / coins.length,
    avgWeightedAvg: totalWeightedAvg / coins.length,
    avgVolume: totalVolume / coins.length,
  }
}
