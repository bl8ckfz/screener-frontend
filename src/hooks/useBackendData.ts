/**
 * Simplified Backend Data Hook
 * 
 * Replaces the 978-line useMarketData.ts with a clean ~50-line implementation.
 * All data processing, indicators, and alert evaluation happens in the Go backend.
 * 
 * This hook simply:
 * 1. Polls backend /api/metrics every 5 seconds
 * 2. Transforms backend response to Coin type
 * 3. Returns data with loading/error states
 */

import { useQuery } from '@tanstack/react-query'
import { backendApi } from '@/services/backendApi'
import type { Coin } from '@/types/coin'

/**
 * Transform backend SymbolMetrics to frontend Coin type
 * Backend sends processed data, so transformation is minimal
 */
function transformBackendToCoin(metrics: any[]): Coin[] {
  if (!Array.isArray(metrics)) {
    console.error('Backend metrics is not an array:', metrics)
    return []
  }

  return metrics.map((data, index) => {
    const symbol = data.symbol || ''
    const timeframes = data.timeframes || {}
    
    // Backend provides: 5m, 15m, 1h, 4h, 8h, 1d (no 1m)
    // Use 5m as the "latest" data since it's the most recent
    const tf5m = timeframes['5m'] || {}
    const tf15m = timeframes['15m'] || {}
    const tf1h = timeframes['1h'] || {}
    const tf8h = timeframes['8h'] || {}
    const tf1d = timeframes['1d'] || {}

    // Parse symbol (e.g., BTCUSDT -> BTC + USDT)
    const pair = symbol.endsWith('USDT') ? 'USDT' : 
                 symbol.endsWith('FDUSD') ? 'FDUSD' :
                 symbol.endsWith('TRY') ? 'TRY' : 'USDT'
    const coinSymbol = symbol.replace(pair, '')
    
    const lastPrice = tf5m.close || 0
    const openPrice = tf5m.open || 0
    const highPrice = tf5m.high || 0
    const lowPrice = tf5m.low || 0
    const weightedAvgPrice = (highPrice + lowPrice + lastPrice) / 3 // Pivot price
    const volume = tf5m.volume || 0
    const quoteVolume = tf5m.volume || 0 // Backend volume is in quote currency (USDT/TRY/FDUSD)
    
    // Get fibonacci from 5m timeframe
    const fibonacci = tf5m.fibonacci || {}

    return {
      id: index + 1,
      symbol: coinSymbol,
      fullSymbol: symbol,
      pair,
      
      // Latest price data (from 1m timeframe)
      lastPrice,
      openPrice,
      highPrice,
      lowPrice,
      prevClosePrice: openPrice, // Previous close is the open price
      weightedAvgPrice,
      priceChange: lastPrice - openPrice,
      priceChangePercent: openPrice > 0 ? ((lastPrice - openPrice) / openPrice * 100) : 0,
      
      // Volume data
      volume,
      quoteVolume,
      bidPrice: lastPrice,
      bidQty: 0,
      askPrice: lastPrice,
      askQty: 0,
      count: 0, // Backend doesn't provide this yet
      
      // Time data
      openTime: Date.now() - 60000, // 1 minute ago
      closeTime: Date.now(),
      
      // Technical indicators
      indicators: {
        vcp: tf5m.vcp || 0,
        
        // Price ratios
        priceToWeightedAvg: weightedAvgPrice > 0 ? lastPrice / weightedAvgPrice : 1,
        priceToHigh: highPrice > 0 ? lastPrice / highPrice : 1,
        lowToPrice: lastPrice > 0 ? lowPrice / lastPrice : 1,
        highToLow: lowPrice > 0 ? highPrice / lowPrice : 1,
        
        // Volume ratios
        askToVolume: volume > 0 ? 0 / volume : 0,
        priceToVolume: volume > 0 ? lastPrice / volume : 0,
        quoteToCount: 0, // count not available yet
        tradesPerVolume: 0,
        
        // Fibonacci levels from backend
        fibonacci: {
          resistance1: fibonacci.r3 || 0,
          resistance0618: fibonacci.r2 || 0,
          resistance0382: fibonacci.r1 || 0,
          pivot: fibonacci.pivot || 0,
          support0382: fibonacci.s1 || 0,
          support0618: fibonacci.s2 || 0,
          support1: fibonacci.s3 || 0,
        },
        
        // Weighted average calculations
        pivotToWeightedAvg: weightedAvgPrice > 0 ? (fibonacci.pivot || 0) / weightedAvgPrice : 1,
        pivotToPrice: lastPrice > 0 ? (fibonacci.pivot || 0) / lastPrice : 1,
        
        // Change percentages
        priceChangeFromWeightedAvg: weightedAvgPrice > 0 ? ((lastPrice - weightedAvgPrice) / weightedAvgPrice * 100) : 0,
        priceChangeFromPrevClose: openPrice > 0 ? ((lastPrice - openPrice) / openPrice * 100) : 0,
        
        // Market dominance (will need to calculate these later)
        ethDominance: 1,
        btcDominance: 1,
        paxgDominance: 1,
      },
      
      // Futures metrics with multi-timeframe data
      futuresMetrics: {
        symbol,
        timestamp: Date.now(),
        
        // Price changes (%) - calculated from backend timeframes
        change_5m: tf5m.close && tf5m.open ? ((tf5m.close - tf5m.open) / tf5m.open * 100) : 0,
        change_15m: tf15m.close && tf15m.open ? ((tf15m.close - tf15m.open) / tf15m.open * 100) : 0,
        change_1h: tf1h.close && tf1h.open ? ((tf1h.close - tf1h.open) / tf1h.open * 100) : 0,
        change_8h: tf8h.close && tf8h.open ? ((tf8h.close - tf8h.open) / tf8h.open * 100) : 0,
        change_1d: tf1d.close && tf1d.open ? ((tf1d.close - tf1d.open) / tf1d.open * 100) : 0,
        
        // Volumes (using base volume since backend doesn't provide quote volume yet)
        volume_5m: tf5m.volume || 0,
        volume_15m: tf15m.volume || 0,
        volume_1h: tf1h.volume || 0,
        volume_8h: tf8h.volume || 0,
        volume_1d: tf1d.volume || 0,
        
        // Market cap (backend will provide)
        marketCap: null,
        coinGeckoId: null,
        
        // Filter results (backend calculates)
        passes_filters: false,
        filter_details: {
          price_checks: {
            change_15m_gt_1: false,
            change_1d_lt_15: false,
            change_1h_gt_change_15m: false,
            change_8h_gt_change_1h: false,
          },
          volume_checks: {
            volume_15m_gt_400k: false,
            volume_1h_gt_1m: false,
            three_vol15m_gt_vol1h: false,
            twentysix_vol15m_gt_vol8h: false,
          },
          marketcap_checks: {
            marketcap_gt_23m: false,
            marketcap_lt_2500m: false,
          },
        },
      },
      
      // Timestamp
      lastUpdated: Date.now(),
    } as Coin
  })
}

/**
 * Main hook: Fetch all metrics from backend
 * 
 * Replaces the complex useMarketData pipeline with simple polling
 */
export function useBackendData() {
  return useQuery({
    queryKey: ['backendMetrics'],
    queryFn: async () => {
      const metrics = await backendApi.getAllMetrics()
      const coins = transformBackendToCoin(metrics)

      try {
        const symbols = coins.map((coin) => coin.fullSymbol)
        const tickers = await backendApi.getAllTickers(symbols)
        const tickerMap = new Map<string, any>()
        tickers.forEach((ticker) => {
          if (ticker?.symbol) {
            tickerMap.set(ticker.symbol, ticker)
          }
        })

        return coins.map((coin) => {
          const ticker = tickerMap.get(coin.fullSymbol)
          if (!ticker) return coin

          const lastPrice = Number(ticker.lastPrice ?? coin.lastPrice)
          const openPrice = Number(ticker.openPrice ?? coin.openPrice)
          const highPrice = Number(ticker.highPrice ?? coin.highPrice)
          const lowPrice = Number(ticker.lowPrice ?? coin.lowPrice)
          const quoteVolume = Number(ticker.quoteVolume ?? coin.quoteVolume)

          return {
            ...coin,
            lastPrice,
            openPrice,
            highPrice,
            lowPrice,
            quoteVolume,
            priceChange: Number(ticker.priceChange ?? coin.priceChange),
            priceChangePercent: Number(ticker.priceChangePercent ?? coin.priceChangePercent),
            weightedAvgPrice: Number(ticker.weightedAvgPrice ?? coin.weightedAvgPrice),
          }
        })
      } catch (error) {
        // Silently return coins without ticker merge for timeout errors
        if (error instanceof Error && error.message.includes('timeout')) {
          return coins
        }
        console.warn('Failed to merge tickers:', error)
        return coins
      }
    },
    refetchInterval: 2000, // 2 second polling for near-realtime price updates
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 1000, // Consider data stale after 1 second
    gcTime: 30000, // Keep in cache for 30 seconds (previously cacheTime)
  })
}
