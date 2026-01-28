/**
 * Chart Types - Temporary stubs until backend implementation
 * TODO: Replace with backend chart data API
 * 
 * IMPORTANT: Chart functionality is temporarily disabled during cleanup.
 * These components will be re-enabled when backend chart API is implemented.
 */

export type KlineInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M'

export interface Candlestick {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IchimokuData {
  time: number
  tenkan: number
  kijun: number
  senkouA: number
  senkouB: number
  chikou: number
  tenkanSen?: number  // Alias for compatibility
  kijunSen?: number   // Alias for compatibility
  chikouSpan?: number // Alias for compatibility
  senkouSpanA?: number // Alias for compatibility
  senkouSpanB?: number // Alias for compatibility
}

export const COMMON_INTERVALS: KlineInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d']

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

// Stub function - will be replaced with backend API
// Returns array of Candlestick directly (not wrapped in object)
export async function fetchKlines(
  _symbol: string,
  _interval: KlineInterval,
  _limit?: number
): Promise<Candlestick[]> {
  console.warn('fetchKlines stub called - backend implementation needed')
  return []
}

// Stub function - will be replaced with backend calculation
// Returns single IchimokuData object (not array)
export function calculateIchimoku(_candles: Candlestick[]): IchimokuData | null {
  console.warn('calculateIchimoku stub called - backend implementation needed')
  return null
}

// Stub function for VWAP
// Returns array of VWAP values with time property
export function calculateWeeklyVWAP(_candles: Candlestick[]): Array<{ time: number; vwap: number }> {
  console.warn('calculateWeeklyVWAP stub called - backend implementation needed')
  return []
}
