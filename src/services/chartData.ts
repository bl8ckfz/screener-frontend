/**
 * Binance Chart Data Service
 * 
 * Fetches historical klines (candlestick) data from Binance API
 * for charting purposes using the /api/v3/klines endpoint
 */

import type { CurrencyPair } from '@/types/coin'

/**
 * Binance Kline (Candlestick) Intervals
 */
export type KlineInterval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M'

/**
 * Raw Binance Kline data format (array of values)
 * [
 *   0: Open time (ms),
 *   1: Open price,
 *   2: High price,
 *   3: Low price,
 *   4: Close price,
 *   5: Volume,
 *   6: Close time (ms),
 *   7: Quote asset volume,
 *   8: Number of trades,
 *   9: Taker buy base asset volume,
 *   10: Taker buy quote asset volume,
 *   11: Unused field
 * ]
 */
export type BinanceKlineRaw = [
  number, // Open time
  string, // Open
  string, // High
  string, // Low
  string, // Close
  string, // Volume
  number, // Close time
  string, // Quote asset volume
  number, // Number of trades
  string, // Taker buy base asset volume
  string, // Taker buy quote asset volume
  string  // Unused
]

/**
 * Processed candlestick data for charting
 */
export interface Candlestick {
  time: number          // Unix timestamp in seconds
  open: number
  high: number
  low: number
  close: number
  volume: number        // Quote asset volume (for VWAP: dollar value, not coin count)
  trades: number
}

/**
 * Chart data response
 */
export interface ChartData {
  symbol: string
  interval: KlineInterval
  candlesticks: Candlestick[]
  startTime: number
  endTime: number
}

/**
 * Fetch historical klines from Binance
 */
export async function fetchKlines(
  symbol: string,
  pair: CurrencyPair,
  interval: KlineInterval = '5m',
  limit: number = 100
): Promise<ChartData> {
  const fullSymbol = `${symbol}${pair}`
  
  // Build API URL - use direct connection like backfill does
  const params = new URLSearchParams({
    symbol: fullSymbol,
    interval,
    limit: limit.toString(),
  })
  
  // Direct connection to Binance Futures API (same as 1m backfill)
  const url = `https://fapi.binance.com/fapi/v1/klines?${params}`
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    })
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`)
    }
    
    const rawData: BinanceKlineRaw[] = await response.json()
    
    // Process raw data into candlesticks
    const candlesticks: Candlestick[] = rawData.map((kline) => ({
      time: Math.floor(kline[0] / 1000), // Convert ms to seconds
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[7]), // Quote asset volume (USDT value for VWAP)
      trades: kline[8],
    }))
    
    return {
      symbol: fullSymbol,
      interval,
      candlesticks,
      startTime: candlesticks[0]?.time || 0,
      endTime: candlesticks[candlesticks.length - 1]?.time || 0,
    }
  } catch (error) {
    console.error('Failed to fetch klines:', error)
    
    // Return mock data for development fallback
    if (import.meta.env.DEV) {
      console.warn('⚠️ Using mock chart data (development fallback)')
      return generateMockChartData(fullSymbol, interval, limit)
    }
    
    throw error
  }
}

/**
 * Generate mock chart data for development/testing
 */
function generateMockChartData(
  symbol: string,
  interval: KlineInterval,
  limit: number
): ChartData {
  const now = Math.floor(Date.now() / 1000)
  const intervalSeconds = getIntervalSeconds(interval)
  
  let basePrice = 40000 + Math.random() * 10000 // Random starting price
  const candlesticks: Candlestick[] = []
  
  for (let i = limit - 1; i >= 0; i--) {
    const time = now - (i * intervalSeconds)
    
    // Simulate realistic price movement
    const volatility = basePrice * 0.02 // 2% volatility
    const change = (Math.random() - 0.5) * volatility
    
    const open = basePrice
    const close = basePrice + change
    const high = Math.max(open, close) + Math.random() * volatility * 0.5
    const low = Math.min(open, close) - Math.random() * volatility * 0.5
    const volume = 100 + Math.random() * 900
    const trades = Math.floor(50 + Math.random() * 200)
    
    candlesticks.push({
      time,
      open,
      high,
      low,
      close,
      volume,
      trades,
    })
    
    basePrice = close // Next candle starts where this one closed
  }
  
  return {
    symbol,
    interval,
    candlesticks,
    startTime: candlesticks[0].time,
    endTime: candlesticks[candlesticks.length - 1].time,
  }
}

/**
 * Get interval duration in seconds
 */
function getIntervalSeconds(interval: KlineInterval): number {
  const map: Record<KlineInterval, number> = {
    '1m': 60,
    '3m': 180,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '2h': 7200,
    '4h': 14400,
    '6h': 21600,
    '8h': 28800,
    '12h': 43200,
    '1d': 86400,
    '3d': 259200,
    '1w': 604800,
    '1M': 2592000, // Approximate 30 days
  }
  return map[interval] || 300 // Default to 5m
}

/**
 * Interval labels for UI
 */
export const INTERVAL_LABELS: Record<KlineInterval, string> = {
  '1m': '1 Minute',
  '3m': '3 Minutes',
  '5m': '5 Minutes',
  '15m': '15 Minutes',
  '30m': '30 Minutes',
  '1h': '1 Hour',
  '2h': '2 Hours',
  '4h': '4 Hours',
  '6h': '6 Hours',
  '8h': '8 Hours',
  '12h': '12 Hours',
  '1d': '1 Day',
  '3d': '3 Days',
  '1w': '1 Week',
  '1M': '1 Month',
}

/**
 * Common chart intervals
 */
export const COMMON_INTERVALS: KlineInterval[] = [
  '1m', '5m', '15m', '1h', '4h', '1d'
]
