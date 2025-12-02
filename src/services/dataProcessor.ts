import type { ProcessedTicker } from '@/types/api'
import type { Coin } from '@/types/coin'

/**
 * Parse USDT symbol to extract coin name
 * All symbols are expected to end with "USDT"
 */
export function parseSymbol(symbol: string): {
  coin: string
  pair: 'USDT'
} | null {
  // All symbols should end with USDT (validated by exchange info filter)
  if (!symbol.endsWith('USDT')) {
    return null
  }

  const coin = symbol.slice(0, -4) // Remove "USDT" suffix

  return {
    coin,
    pair: 'USDT',
  }
}

/**
 * Filter tickers to only valid USDT pairs
 * Note: API already filters to USDT, but this ensures data integrity
 */
export function filterTickersByPair(
  tickers: ProcessedTicker[]
): ProcessedTicker[] {
  return tickers.filter((ticker) => {
    const parsed = parseSymbol(ticker.symbol)
    return parsed !== null
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
 * Process batch of tickers into coins (USDT pairs only)
 */
export function processTickersForPair(
  tickers: ProcessedTicker[]
): Coin[] {
  const filteredTickers = filterTickersByPair(tickers)

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
