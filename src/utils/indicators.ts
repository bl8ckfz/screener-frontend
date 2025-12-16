import type { Coin, FibonacciLevels, TechnicalIndicators } from '@/types/coin'
import { memoize } from './performance'

/**
 * Calculate VCP (Volatility Contraction Pattern) - Internal implementation
 * Formula: (P/WA) * [((close-low)-(high-close))/(high-low)]
 *
 * Where:
 * - P = lastPrice
 * - WA = weightedAvgPrice
 * - close = lastPrice
 * - high = highPrice
 * - low = lowPrice
 */
function calculateVCPInternal(
  lastPrice: number,
  weightedAvgPrice: number,
  highPrice: number,
  lowPrice: number
): number {
  if (highPrice === lowPrice) return 0 // Avoid division by zero

  const priceToWA = lastPrice / weightedAvgPrice
  const numerator = lastPrice - lowPrice - (highPrice - lastPrice)
  const denominator = highPrice - lowPrice

  const vcp = priceToWA * (numerator / denominator)

  return roundTo3Decimals(vcp)
}

// Memoized version with 60s cache
const calculateVCPMemoized = memoize(calculateVCPInternal, {
  maxSize: 200,
  maxAge: 60000,
})

/**
 * Calculate VCP (Volatility Contraction Pattern)
 * Accepts coin with either 'price' or 'lastPrice', 'high' or 'highPrice', 'low' or 'lowPrice'
 */
export function calculateVCP(coin: Partial<Coin & { price?: number; high?: number; low?: number }>): number {
  const price = coin.price || coin.lastPrice || 0
  const weightedAvg = coin.weightedAvgPrice || 0
  const high = coin.high || coin.highPrice || 0
  const low = coin.low || coin.lowPrice || 0
  
  return calculateVCPMemoized(price, weightedAvg, high, low)
}

/**
 * Calculate Fibonacci pivot levels - Internal implementation
 * Based on high, low, and close prices
 */
function calculateFibonacciInternal(
  highPrice: number,
  lowPrice: number,
  lastPrice: number
): FibonacciLevels {
  // Pivot point (weighted average of high, low, close)
  const pivot = (highPrice + lowPrice + lastPrice) / 3
  const range = highPrice - lowPrice

  return {
    pivot: roundTo3Decimals(pivot),
    resistance1: roundTo3Decimals(pivot + 1.0 * range),
    resistance0618: roundTo3Decimals(pivot + 0.618 * range),
    resistance0382: roundTo3Decimals(pivot + 0.382 * range),
    support0382: roundTo3Decimals(pivot - 0.382 * range),
    support0618: roundTo3Decimals(pivot - 0.618 * range),
    support1: roundTo3Decimals(pivot - 1.0 * range),
  }
}

// Memoized version with 60s cache
const calculateFibonacciMemoized = memoize(calculateFibonacciInternal, {
  maxSize: 200,
  maxAge: 60000,
})

/**
 * Calculate Fibonacci pivot levels
 */
export function calculateFibonacci(coin: Coin): FibonacciLevels {
  return calculateFibonacciMemoized(coin.highPrice, coin.lowPrice, coin.lastPrice)
}

/**
 * Calculate Fibonacci pivot levels (alias for test compatibility)
 * Accepts coin with either 'price' or 'lastPrice', 'high' or 'highPrice', 'low' or 'lowPrice'
 * Returns object with both naming conventions for backward compatibility
 */
export function calculateFibonacciPivots(
  coin: Partial<Coin & { price?: number; high?: number; low?: number }>
): FibonacciLevels & { r3?: number; r2?: number; r1?: number; s1?: number; s2?: number; s3?: number; pp?: number } {
  const price = coin.price || coin.lastPrice || 0
  const high = coin.high || coin.highPrice || 0
  const low = coin.low || coin.lowPrice || 0
  const result = calculateFibonacciMemoized(high, low, price)
  
  // Add aliases for test compatibility
  return {
    ...result,
    pp: result.pivot,
    r3: result.resistance1,
    r2: result.resistance0618,
    r1: result.resistance0382,
    s1: result.support0382,
    s2: result.support0618,
    s3: result.support1,
  }
}

/**
 * Calculate all technical indicators for a coin
 */
export function calculateTechnicalIndicators(
  coin: Coin,
  ethCoin?: Coin,
  btcCoin?: Coin,
  paxgCoin?: Coin
): TechnicalIndicators {
  const {
    lastPrice,
    weightedAvgPrice,
    highPrice,
    lowPrice,
    prevClosePrice,
    volume,
    quoteVolume,
    askQty,
    count,
  } = coin

  // Calculate VCP
  const vcp = calculateVCP(coin)

  // Price ratios
  const priceToWeightedAvg = safeDivide(lastPrice, weightedAvgPrice)
  const priceToHigh = safeDivide(lastPrice, highPrice)
  const lowToPrice = safeDivide(lowPrice, lastPrice)
  const highToLow = safeDivide(highPrice, lowPrice)

  // Volume ratios
  const askToVolume = safeDivide(askQty, volume)
  const priceToVolume = safeDivide(lastPrice, volume)
  const quoteToCount = safeDivide(quoteVolume, count)
  const tradesPerVolume = safeDivide(count, volume)

  // Fibonacci levels
  const fibonacci = calculateFibonacci(coin)

  // Pivot calculations
  const pivotToWeightedAvg = safeDivide(fibonacci.pivot, weightedAvgPrice)
  const pivotToPrice = safeDivide(fibonacci.pivot, lastPrice)

  // Change percentages
  const priceChangeFromWeightedAvg = ((lastPrice / weightedAvgPrice) * 100 - 100)
  const priceChangeFromPrevClose = prevClosePrice > 0
    ? ((lastPrice / prevClosePrice) * 100 - 100)
    : 0

  // Market dominance (relative to ETH, BTC, PAXG)
  const ethDominance = calculateDominance(coin, ethCoin)
  const btcDominance = calculateDominance(coin, btcCoin)
  const paxgDominance = calculateDominance(coin, paxgCoin)

  return {
    vcp: roundTo3Decimals(vcp),
    priceToWeightedAvg: roundTo3Decimals(priceToWeightedAvg),
    priceToHigh: roundTo3Decimals(priceToHigh),
    lowToPrice: roundTo3Decimals(lowToPrice),
    highToLow: roundTo3Decimals(highToLow),
    askToVolume: roundTo3Decimals(askToVolume),
    priceToVolume: roundTo3Decimals(priceToVolume),
    quoteToCount: roundTo3Decimals(quoteToCount),
    tradesPerVolume: roundTo3Decimals(tradesPerVolume),
    fibonacci,
    pivotToWeightedAvg: roundTo3Decimals(pivotToWeightedAvg),
    pivotToPrice: roundTo3Decimals(pivotToPrice),
    priceChangeFromWeightedAvg: roundTo3Decimals(priceChangeFromWeightedAvg),
    priceChangeFromPrevClose: roundTo3Decimals(priceChangeFromPrevClose),
    ethDominance: roundTo3Decimals(ethDominance),
    btcDominance: roundTo3Decimals(btcDominance),
    paxgDominance: roundTo3Decimals(paxgDominance),
  }
}

/**
 * Calculate market dominance for an array of coins based on volume percentages
 * Returns dominance percentages for ETH, BTC, and PAXG
 */
export function calculateMarketDominance(
  coins: Coin[]
): { btcDominance: number; ethDominance: number; paxgDominance: number } {
  if (coins.length === 0) {
    return { btcDominance: 0, ethDominance: 0, paxgDominance: 0 }
  }

  // Find specific coins
  const ethCoin = coins.find((c) => c.symbol === 'ETH' || c.symbol === 'ETHUSDT')
  const btcCoin = coins.find((c) => c.symbol === 'BTC' || c.symbol === 'BTCUSDT')
  const paxgCoin = coins.find((c) => c.symbol === 'PAXG' || c.symbol === 'PAXGUSDT')

  // Calculate total volume
  const totalVolume = coins.reduce((sum, coin) => sum + (coin.quoteVolume || 0), 0)

  if (totalVolume === 0) {
    return { btcDominance: 0, ethDominance: 0, paxgDominance: 0 }
  }

  // Calculate percentages
  const btcVolume = btcCoin?.quoteVolume || 0
  const ethVolume = ethCoin?.quoteVolume || 0
  const paxgVolume = paxgCoin?.quoteVolume || 0

  return {
    btcDominance: (btcVolume / totalVolume) * 100,
    ethDominance: (ethVolume / totalVolume) * 100,
    paxgDominance: (paxgVolume / totalVolume) * 100,
  }
}

/**
 * Calculate dominance ratio relative to reference coin
 * Handles sign differences properly (from fast.html logic)
 */
function calculateDominance(coin: Coin, referenceCoin?: Coin): number {
  if (!referenceCoin) return 0

  const coinChange = coin.priceChangePercent
  const refChange = referenceCoin.priceChangePercent

  const coinSign = Math.sign(coinChange)
  const refSign = Math.sign(refChange)

  let dominance = coinChange / refChange

  // Adjust sign based on both coins' directions
  if (coinSign === -1 && refSign === -1) {
    dominance = -dominance
  } else if (coinSign === -1 && refSign === 1) {
    dominance = -dominance
  } else if (coinSign === 1 && refSign === -1) {
    dominance = -dominance
  }

  return dominance
}

/**
 * Safe division that returns 1 if denominator is 0
 */
function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 1
  return numerator / denominator
}

/**
 * Round number to 3 decimal places
 */
function roundTo3Decimals(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Round number to 6 decimal places (for VWAP precision)
 */
function roundTo6Decimals(value: number): number {
  return Math.round(value * 1000000) / 1000000
}

/**
 * VWAP data point
 */
export interface VWAPData {
  time: number
  vwap: number
}

/**
 * Candlestick data structure (matches chartData.ts)
 * Binance Standard VWAP uses: quoteVolume / volume
 */
export interface CandlestickForVWAP {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number       // Base asset volume (coin/token count)
  quoteVolume: number  // Quote asset volume (USDT = Σ(price × qty))
}

/**
 * Calculate weekly VWAP from candlestick data (Binance Standard)
 * VWAP = Σ(Quote Volume) / Σ(Base Volume)
 * Quote volume already contains Σ(price × qty) from actual trades
 * Resets every Monday (ISO week start)
 */
export function calculateWeeklyVWAP(candlesticks: CandlestickForVWAP[]): VWAPData[] {
  if (candlesticks.length === 0) return []

  const result: VWAPData[] = []
  let cumulativeQuoteVolume = 0  // Σ(price × qty) in USDT
  let cumulativeBaseVolume = 0   // Σ(qty) in base asset
  let currentWeek = -1

  candlesticks.forEach((candle) => {
    const date = new Date(candle.time * 1000)
    const week = getISOWeek(date)
    const year = date.getFullYear()
    const weekKey = year * 100 + week // Unique identifier for each week

    // Reset accumulation on new week
    if (currentWeek !== -1 && weekKey !== currentWeek) {
      cumulativeQuoteVolume = 0
      cumulativeBaseVolume = 0
    }
    currentWeek = weekKey

    // Accumulate volumes (Binance standard approach)
    cumulativeQuoteVolume += candle.quoteVolume
    cumulativeBaseVolume += candle.volume

    // Calculate VWAP: weighted average price from actual trades
    const vwap = cumulativeBaseVolume > 0 
      ? cumulativeQuoteVolume / cumulativeBaseVolume 
      : candle.close // Fallback to close price

    result.push({
      time: candle.time,
      vwap: roundTo6Decimals(vwap),
    })
  })

  return result
}

/**
 * Get ISO week number (1-53)
 * Week starts on Monday
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf())
  const dayNumber = (date.getDay() + 6) % 7 // Monday = 0, Sunday = 6
  target.setDate(target.getDate() - dayNumber + 3) // Thursday of the week
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000) // 604800000 = 7 * 24 * 60 * 60 * 1000
}

/**
 * Apply all technical indicators to an array of coins
 */
export function applyTechnicalIndicators(coins: Coin[]): Coin[] {
  // Find reference coins for dominance calculations
  const ethCoin = coins.find((c) => c.symbol === 'ETH')
  const btcCoin = coins.find((c) => c.symbol === 'BTC')
  const paxgCoin = coins.find((c) => c.symbol === 'PAXG')

  return coins.map((coin) => ({
    ...coin,
    indicators: calculateTechnicalIndicators(coin, ethCoin, btcCoin, paxgCoin),
  }))
}
