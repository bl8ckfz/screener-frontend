import { useEffect, useState, useCallback, useMemo } from 'react'
import { FuturesMetricsService } from '@/services/futuresMetricsService'
import type { WarmupStatus, PartialChangeMetrics } from '@/types/metrics'
import type { FuturesMetrics } from '@/types/api'

/**
 * Convert WebSocket PartialChangeMetrics to FuturesMetrics format
 * Alert engine expects FuturesMetrics interface
 */
function convertToFuturesMetrics(partial: PartialChangeMetrics): FuturesMetrics {
  return {
    symbol: partial.symbol,
    timestamp: partial.timestamp,
    
    // Price changes (convert null to 0 for alerts)
    change_5m: partial.change_5m ?? 0,
    change_15m: partial.change_15m ?? 0,
    change_1h: partial.change_1h ?? 0,
    change_8h: partial.change_8h ?? 0,
    change_1d: partial.change_1d ?? 0,
    
    // Volumes (use quote volume, convert null to 0)
    volume_5m: partial.quoteVolume_5m ?? 0,
    volume_15m: partial.quoteVolume_15m ?? 0,
    volume_1h: partial.quoteVolume_1h ?? 0,
    volume_8h: partial.quoteVolume_8h ?? 0,
    volume_1d: partial.quoteVolume_1d ?? 0,
    
    // Market cap (not available from WebSocket)
    marketCap: null,
    coinGeckoId: null,
    
    // Filter results (not used by alerts)
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
  }
}

// Create singleton instance
const futuresMetricsService = new FuturesMetricsService()

/**
 * Hook for WebSocket-based real-time futures streaming
 * 
 * Features:
 * - Instant market data (<2 seconds via ticker stream)
 * - Smart symbol selection (top 200 by 24h volume)
 * - Background backfill for historical metrics (non-blocking)
 * - Real-time price/volume updates via WebSocket
 * - Zero ongoing API requests (only startup backfill)
 * - Auto-reconnection on disconnect
 * 
 * Flow:
 * 1. Connect WebSocket and fetch all tickers (~500 symbols)
 * 2. Sort by 24h quote volume, select top 200 most liquid
 * 3. Display market data immediately → tickersReady=true (~1s)
 * 4. Background backfill of historical data → backfillProgress (0-100%)
 * 5. All features available → backfillComplete=true (~60s)
 * 
 * @example
 * const {
 *   tickersReady,      // true when market data available
 *   backfillProgress,  // 0-100% historical data loading
 *   backfillComplete,  // true when all data loaded
 *   metricsMap,        // real-time metrics
 *   warmupStatus,      // detailed timeframe readiness
 * } = useFuturesStreaming()
 * 
 * // Show loading indicator during backfill
 * if (tickersReady && !backfillComplete) {
 *   return <div>Loading historical data: {backfillProgress}%</div>
 * }
 */
export function useFuturesStreaming() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [tickersReady, setTickersReady] = useState(false) // New: tickers available instantly
  const [backfillProgress, setBackfillProgress] = useState(0) // Track background backfill
  const [backfillComplete, setBackfillComplete] = useState(false)
  const [metricsMap, setMetricsMap] = useState<Map<string, PartialChangeMetrics>>(new Map())
  const [warmupStatus, setWarmupStatus] = useState<WarmupStatus | null>(null)
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const [error, setError] = useState<Error | null>(null)

  // Initialize WebSocket streaming on mount
  useEffect(() => {
    let isSubscribed = true

    const init = async () => {
      try {
        console.log('🚀 Initializing futures streaming...')
        
        // Subscribe to events BEFORE initializing (so we don't miss the tickersReady event)
        const unsubTickersReady = futuresMetricsService.on('tickersReady', () => {
          if (!isSubscribed) return
          console.log('📊 Initial tickers ready - market data can be displayed')
          setTickersReady(true)
        })
        
        // Subscribe to backfill progress updates
        const unsubBackfillProgress = futuresMetricsService.onBackfillProgress(({ progress }: { progress: number }) => {
          if (!isSubscribed) return
          setBackfillProgress(progress)
          
          // Mark backfill complete when done
          if (progress >= 100) {
            console.log('✅ Backfill complete - all historical data loaded!')
            setBackfillComplete(true)
            setBackfillProgress(100)
          }
        })
        
        // NOW initialize streaming (this will emit tickersReady event)
        await futuresMetricsService.initialize()
        
        if (!isSubscribed) return
        
        setIsInitialized(true)
        setLastUpdate(Date.now()) // Mark connection time to prevent "stale" status
        console.log('✅ Futures streaming initialized')
        
        // Subscribe to real-time metrics updates
        const unsubMetrics = futuresMetricsService.onMetricsUpdate(({ symbol, metrics }: { symbol: string; metrics: PartialChangeMetrics }) => {
          if (!isSubscribed) return
          
          setMetricsMap(prev => {
            const next = new Map(prev)
            next.set(symbol, metrics)
            return next
          })
          
          // Update last update timestamp
          setLastUpdate(Date.now())
        })
        
        // Subscribe to ticker updates to keep lastUpdate fresh
        const unsubTicker = futuresMetricsService.onTickerUpdate(() => {
          if (!isSubscribed) return
          setLastUpdate(Date.now())
        })
        
        // Track warm-up progress every 5 seconds
        const warmupInterval = setInterval(() => {
          if (!isSubscribed) return
          
          const status = futuresMetricsService.getWarmupStatus()
          setWarmupStatus(status)
          
          // Stop tracking once fully warmed up
          if (status && status.overallProgress >= 100) {
            clearInterval(warmupInterval)
            console.log('🔥 Fully warmed up - all timeframes ready!')
          }
        }, 5000)
        
        // Cleanup on unmount
        return () => {
          isSubscribed = false
          unsubTickersReady()
          unsubBackfillProgress()
          unsubMetrics()
          unsubTicker()
          clearInterval(warmupInterval)
          futuresMetricsService.stop()
        }
      } catch (err) {
        console.error('❌ Failed to initialize futures streaming:', err)
        if (isSubscribed) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }

    init()

    return () => {
      isSubscribed = false
    }
  }, [])

  /**
   * Get metrics for a specific symbol
   * Returns null if symbol not in stream or timeframe not ready
   */
  const getMetrics = useCallback((symbol: string): PartialChangeMetrics | null => {
    return metricsMap.get(symbol) || null
  }, [metricsMap])

  /**
   * Get all metrics as array (for screener table)
   * Converts partial metrics to FuturesMetrics format with nulls defaulted to 0
   */
  const getAllMetrics = useCallback((): Omit<FuturesMetrics, 'passes_filters' | 'filter_details' | 'marketCap' | 'coinGeckoId'>[] => {
    return Array.from(metricsMap.values()).map(partial => ({
      symbol: partial.symbol,
      timestamp: partial.timestamp,
      change_5m: partial.change_5m ?? 0,
      change_15m: partial.change_15m ?? 0,
      change_1h: partial.change_1h ?? 0,
      change_8h: partial.change_8h ?? 0,
      change_1d: partial.change_1d ?? 0,
      volume_5m: partial.quoteVolume_5m ?? 0,
      volume_15m: partial.quoteVolume_15m ?? 0,
      volume_1h: partial.quoteVolume_1h ?? 0,
      volume_8h: partial.quoteVolume_8h ?? 0,
      volume_1d: partial.quoteVolume_1d ?? 0,
    }))
  }, [metricsMap])

  // Convert PartialChangeMetrics to FuturesMetrics for alert engine compatibility
  const futuresMetricsMap = useMemo(() => {
    const converted = new Map<string, FuturesMetrics>()
    metricsMap.forEach((partial, symbol) => {
      converted.set(symbol, convertToFuturesMetrics(partial))
    })
    console.log(`🔄 Converted ${converted.size} WebSocket metrics to FuturesMetrics format`)
    return converted
  }, [metricsMap])
  
  // Get live ticker data from WebSocket
  const getTickerData = useCallback(() => {
    return futuresMetricsService.getAllTickerData()
  }, [])

  // Get expected symbol count
  const getTrackedSymbolCount = useCallback(() => {
    return futuresMetricsService.getTrackedSymbols().length
  }, [])
  
  return {
    // State
    isInitialized,
    tickersReady, // New: true when market data available (~1s)
    backfillProgress, // New: 0-100% background loading progress
    backfillComplete, // New: true when all historical data loaded
    error,
    lastUpdate,
    
    // Data (converted to FuturesMetrics format for alerts)
    metricsMap: futuresMetricsMap,
    warmupStatus,
    
    // Ticker data from WebSocket (for market data list)
    getTickerData,
    getTrackedSymbolCount,
    
    // Helpers
    getMetrics,
    getAllMetrics,
    
    // Status checks
    isFullyWarmedUp: warmupStatus?.overallProgress === 100,
    symbolCount: metricsMap.size,
  }
}
