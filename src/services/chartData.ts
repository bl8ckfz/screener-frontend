/**
 * Chart Data Service - Binance Futures Klines API
 * 
 * Fetches historical candlestick data directly from Binance Futures API.
 * This is separate from the backend metrics API which provides real-time aggregated data.
 * 
 * Separation of concerns:
 * - Backend: Real-time metrics with indicators (5s polling)
 * - Binance: Historical chart data (on-demand)
 */

export type KlineInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M'

export interface Candlestick {
  time: number // Unix timestamp in seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
  trades: number
}

const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1'
const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_URL
const USE_BACKEND_API = import.meta.env.VITE_USE_BACKEND_API === 'true'

/**
 * Fetch klines (candlestick data) from Binance Futures API
 * 
 * @param symbol - Trading pair (e.g., 'BTCUSDT')
 * @param interval - Timeframe interval
 * @param limit - Number of candles to fetch (max 1500)
 * @returns Array of candlesticks
 */
export async function fetchKlines(
  symbol: string,
  interval: KlineInterval,
  limit: number = 500
): Promise<Candlestick[]> {
  try {
    const safeLimit = Math.min(limit, 1500)
    const base = USE_BACKEND_API && BACKEND_API_BASE
      ? `${BACKEND_API_BASE}/api/klines`
      : `${BINANCE_FUTURES_API}/klines`

    const url = `${base}?symbol=${symbol}&interval=${interval}&limit=${safeLimit}`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    return data.map((kline: any[]) => ({
      time: Math.floor(kline[0] / 1000), // Open time (seconds)
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]), // Base asset volume
      quoteVolume: parseFloat(kline[7]), // Quote asset volume
      trades: parseInt(kline[8]), // Number of trades
    }))
  } catch (error) {
    console.error('Failed to fetch klines:', error)
    throw error
  }
}

/**
 * Common interval configurations
 */
export const COMMON_INTERVALS: KlineInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d']

/**
 * Interval display labels
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
 * Calculate interval duration in milliseconds
 */
export function getIntervalMs(interval: KlineInterval): number {
  const map: Record<KlineInterval, number> = {
    '1m': 60 * 1000,
    '3m': 3 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
  }
  return map[interval]
}

/**
 * Ichimoku Cloud indicator data
 * TODO: Calculate server-side or use external library
 */
export interface IchimokuData {
  time: number
  tenkan: number
  kijun: number
  senkouA: number
  senkouB: number
  chikou: number
  tenkanSen?: number
  kijunSen?: number
  chikouSpan?: number
  senkouSpanA?: number
  senkouSpanB?: number
}

/**
 * Calculate Ichimoku Cloud indicator (stub - disabled for now)
 * TODO: Implement proper Ichimoku calculation or backend API
 */
export function calculateIchimoku(_candles: Candlestick[]): IchimokuData | null {
  // Disabled during cleanup - charts will work without Ichimoku overlay
  return null
}

/**
 * Calculate Weekly VWAP (Volume Weighted Average Price)
 * TODO: Implement or backend API
 */
export function calculateWeeklyVWAP(_candles: Candlestick[]): Array<{ time: number; vwap: number }> {
  // Disabled during cleanup
  return []
}
