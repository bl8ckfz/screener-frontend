import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TradingChart } from './TradingChart'
import { AlertTimelineChart } from './AlertTimelineChart'
import { ExternalLinks } from './ExternalLinks'
import { fetchKlines, calculateIchimoku, type KlineInterval, type IchimokuData, COMMON_INTERVALS, INTERVAL_LABELS } from '@/services/chartData'
import { alertHistoryService } from '@/services/alertHistoryService'
import { alertHistory } from '@/services/alertHistory'
import { USE_BACKEND_API } from '@/services/backendApi'
import { useBubbleStream } from '@/hooks/useBubbleStream'
import { useStore } from '@/hooks/useStore'
import type { Coin } from '@/types/coin'
import type { AlertHistoryEntry } from '@/types/alertHistory'
import type { AlertHistoryItem, CombinedAlertType } from '@/types/alert'
import { ChartSkeleton, ErrorState, EmptyState } from '@/components/ui'
import { debug } from '@/utils/debug'

export interface ChartSectionProps {
  selectedCoin: Coin | null
  onClose?: () => void
  className?: string
}

/**
 * ChartSection Component
 * 
 * Unified wrapper for TradingChart and AlertTimelineChart.
 * Displays charts for the selected coin with controls for interval, indicators, etc.
 * Shows empty state when no coin is selected.
 * 
 * Phase 8.1.1: Extract Chart Section Component
 */
export function ChartSection({ selectedCoin, onClose, className = '' }: ChartSectionProps) {
  const [interval, setInterval] = useState<KlineInterval>('5m')
  const [showWeeklyVWAP, setShowWeeklyVWAP] = useState(false)
  const [showIchimoku, setShowIchimoku] = useState(false)
  const [showAlerts, setShowAlerts] = useState(true)
  const [showBubbles, setShowBubbles] = useState(true)
  const [bubbleTimeframe] = useState<'5m' | '15m' | 'both'>('both')
  const [bubbleSize] = useState<'large' | 'medium+' | 'all'>('large')
  
  const [chartData, setChartData] = useState<any[]>([])
  const [vwapData, setVwapData] = useState<any[]>([]) // Separate data for VWAP (15m interval)
  const [ichimokuData, setIchimokuData] = useState<IchimokuData[]>([]) // Ichimoku indicator data
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const visibilityRef = useRef(!document.hidden)
  const driftTimerRef = useRef<number | null>(null)

  // Get bubbles for current coin (use fullSymbol to match futures symbol)
  // Bubble detection disabled - using stub
  const { bubbles: allBubbles } = useBubbleStream(false)
  
  // Filter bubbles by timeframe and size
  const filteredBubbles = useMemo(() => {
    let filtered = allBubbles
    
    // Filter by timeframe
    if (bubbleTimeframe !== 'both') {
      filtered = filtered.filter(b => b.timeframe === bubbleTimeframe)
    }
    
    // Filter by size
    if (bubbleSize === 'large') {
      filtered = filtered.filter(b => b.size === 'large')
    } else if (bubbleSize === 'medium+') {
      filtered = filtered.filter(b => b.size === 'large' || b.size === 'medium')
    }
    
    return filtered
  }, [allBubbles, bubbleTimeframe, bubbleSize])
  
  // Get alerts for current coin from history - updates reactively when alerts change
  const alertHistoryRefresh = useStore((state) => state.alertHistoryRefresh)
  
  const backendAlertsQuery = useQuery({
    queryKey: ['backendAlerts', selectedCoin?.fullSymbol],
    queryFn: () => alertHistory.getAllBySymbol(selectedCoin!.fullSymbol),
    enabled: USE_BACKEND_API && !!selectedCoin?.fullSymbol,
    staleTime: 30000,
    refetchInterval: 30000,
    retry: 2,
  })

  const backendEntries = useMemo(() => {
    if (!USE_BACKEND_API) return []
    const alerts = backendAlertsQuery.data || []
    return alerts.map((alert) => toAlertHistoryEntry(alert))
  }, [backendAlertsQuery.data])

  const localEntries = useMemo(() => {
    if (USE_BACKEND_API) return []
    return alertHistoryService.getHistory()
  }, [alertHistoryRefresh])

  const coinAlerts = useMemo(() => {
    if (!selectedCoin) return []
    const allAlerts = USE_BACKEND_API ? backendEntries : localEntries
    return allAlerts.filter((alert) => alert.symbol === selectedCoin.symbol)
  }, [selectedCoin?.symbol, backendEntries, localEntries])

  const getIntervalSeconds = useCallback((ivl: KlineInterval) => {
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
      '1M': 2592000,
    }
    return map[ivl] || 300
  }, [])

  const loadChartData = useCallback(
    async (options?: { limit?: number }) => {
      if (!selectedCoin) return
      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchKlines(selectedCoin.fullSymbol, interval, options?.limit ?? 200)
        setChartData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chart data')
        debug.error('Chart data error:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [interval, selectedCoin]
  )

  // Initial load + interval/coin change
  useEffect(() => {
    if (!selectedCoin) {
      setChartData([])
      setVwapData([])
      setIchimokuData([])
      return
    }
    loadChartData()
  }, [loadChartData, selectedCoin])

  // Visibility tracking to pause live updates in background tabs
  useEffect(() => {
    const handler = () => {
      visibilityRef.current = !document.hidden
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // Interval-close resync: fetch a small window at candle close
  useEffect(() => {
    if (!selectedCoin || chartData.length === 0) return
    const intervalSeconds = getIntervalSeconds(interval)
    const last = chartData[chartData.length - 1]
    const nowSec = Math.floor(Date.now() / 1000)
    const nextClose = last.time + intervalSeconds
    const delayMs = Math.max(500, (nextClose - nowSec + 1) * 1000)

    const timer = window.setTimeout(() => {
      // Small resync to keep candles aligned; limit fetch size
      loadChartData({ limit: 120 })
    }, delayMs)

    return () => clearTimeout(timer)
  }, [chartData, getIntervalSeconds, interval, loadChartData, selectedCoin])

  // Drift correction: infrequent full resync
  useEffect(() => {
    if (!selectedCoin) return
    const intervalId = window.setInterval(() => {
      loadChartData({ limit: 150 })
    }, 120000) // every 2 minutes

    driftTimerRef.current = intervalId
    return () => {
      if (driftTimerRef.current) {
        clearInterval(driftTimerRef.current)
        driftTimerRef.current = null
      }
    }
  }, [loadChartData, selectedCoin])

  // Fetch VWAP data (15m interval) when toggled on or coin changes
  useEffect(() => {
    if (!selectedCoin || !showWeeklyVWAP) {
      setVwapData([])
      return
    }

    let isCancelled = false

    const loadVwapData = async () => {
      try {
        // Use 15m interval for VWAP calculation (more efficient than 1m)
        const data = await fetchKlines(selectedCoin.fullSymbol, '15m', 672) // 672 * 15m = 1 week
        
        if (!isCancelled) {
          setVwapData(data)
        }
      } catch (err) {
        debug.error('VWAP data error:', err)
      }
    }

    loadVwapData()

    return () => {
      isCancelled = true
    }
  }, [selectedCoin, showWeeklyVWAP])

  // Calculate Ichimoku data when toggled on or chart data changes
  useEffect(() => {
    if (!showIchimoku || chartData.length === 0) {
      setIchimokuData([])
      return
    }

    try {
      const ichimoku = calculateIchimoku(chartData)
      if (ichimoku) {
        setIchimokuData([ichimoku])
      } else {
        setIchimokuData([])
      }
    } catch (err) {
      debug.error('Ichimoku calculation error:', err)
    }
  }, [chartData, showIchimoku])

  // Show empty state when no coin selected
  if (!selectedCoin) {
    return (
      <div className={`bg-gray-800 rounded-lg ${className}`}>
        <div className="h-[400px] md:h-[550px] flex items-center justify-center">
          <EmptyState
            icon="📊"
            title="No Coin Selected"
            description="Click on an alert in the table below to view its chart and timeline"
          />
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading && chartData.length === 0) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <ChartSkeleton />
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <ErrorState
          message={error}
          description="Failed to load chart data"
          onRetry={() => setInterval(interval)} // Trigger refetch
        />
      </div>
    )
  }

  return (
    <div className={`bg-gray-800 rounded-lg transition-all duration-300 w-full max-w-full overflow-hidden ${className}`}>
      {/* Header with coin info and close button - hidden on mobile */}
      <div className="hidden md:flex items-center justify-between p-3 md:p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-white">
            {selectedCoin.symbol}
            <span className="text-gray-400 text-sm ml-2">/ {selectedCoin.pair}</span>
          </h3>
          <div className={`text-sm font-mono ${
            selectedCoin.priceChangePercent > 0
              ? 'text-bullish'
              : selectedCoin.priceChangePercent < 0
                ? 'text-bearish'
                : 'text-neutral'
          }`}>
            {selectedCoin.priceChangePercent > 0 ? '+' : ''}
            {selectedCoin.priceChangePercent.toFixed(2)}%
          </div>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Deselect coin"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Chart Controls */}
      <div className="flex items-center gap-0.5 md:gap-2 p-1 md:p-4 border-b border-gray-700 overflow-x-auto scrollbar-hide">
        {/* Interval Selector */}
        <div className="flex items-center gap-0.5">
          {COMMON_INTERVALS.map((int) => (
            <button
              key={int}
              onClick={() => setInterval(int)}
              className={`px-1.5 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded transition-colors ${
                interval === int
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {INTERVAL_LABELS[int]}
            </button>
          ))}
        </div>

        {/* Indicator Toggles */}
        <div className="flex items-center gap-0.5 md:gap-2 ml-auto">
          <button
            onClick={() => setShowWeeklyVWAP(!showWeeklyVWAP)}
            className={`px-1.5 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded transition-colors ${
              showWeeklyVWAP
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            VWAP
          </button>
          <button
            onClick={() => setShowIchimoku(!showIchimoku)}
            className={`px-1.5 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded transition-colors ${
              showIchimoku
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Ichimoku
          </button>
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className={`px-1.5 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded transition-colors ${
              showAlerts
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Alerts
          </button>
          <button
            onClick={() => setShowBubbles(!showBubbles)}
            className={`px-1.5 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded transition-colors ${
              showBubbles
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Bubbles
          </button>
        </div>
      </div>

      {/* Trading Chart */}
      <div className="px-1 md:px-4 pt-1 md:pt-4 w-full max-w-full overflow-hidden">
        <div className="bg-gray-900 rounded-lg p-1 md:p-3 w-full max-w-full overflow-hidden">
          <TradingChart
            data={chartData}
            symbol={selectedCoin.fullSymbol}
            height={220} // Further reduced for mobile viewport
            livePrice={selectedCoin.lastPrice}
            showVolume={true}
            showWeeklyVWAP={showWeeklyVWAP}
            vwapData={vwapData}
            showIchimoku={showIchimoku}
            ichimokuData={ichimokuData}
            showAlerts={showAlerts}
            alerts={coinAlerts}
            showBubbles={showBubbles}
            bubbles={filteredBubbles}
          />
        </div>
      </div>

      {/* Alert Timeline Chart */}
      <div className="px-1 md:px-4 pt-1 md:pt-4 pb-1 md:pb-4 w-full max-w-full overflow-hidden">
        <div className="bg-gray-900 rounded-lg p-1 md:p-3 w-full max-w-full overflow-hidden">
          <h4 className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">
            Alert Timeline (24h)
          </h4>
          <AlertTimelineChart symbol={selectedCoin.symbol} fullSymbol={selectedCoin.fullSymbol} height={100} />
        </div>
      </div>

      {/* External Links */}
      <div className="px-1 md:px-4 pb-1 md:pb-4 w-full max-w-full">
        <ExternalLinks coin={selectedCoin} />
      </div>
    </div>
  )
}

function normalizeSymbol(symbol: string): string {
  if (symbol.endsWith('USDT')) return symbol.replace('USDT', '')
  if (symbol.endsWith('FDUSD')) return symbol.replace('FDUSD', '')
  if (symbol.endsWith('TRY')) return symbol.replace('TRY', '')
  return symbol
}

function toAlertHistoryEntry(alert: AlertHistoryItem): AlertHistoryEntry {
  const symbol = normalizeSymbol(alert.symbol)
  return {
    id: alert.id || `${alert.timestamp}-${symbol}-${alert.type}`,
    symbol,
    alertType: alert.type as CombinedAlertType,
    timestamp: alert.timestamp,
    priceAtTrigger: alert.value ?? 0,
    changePercent: 0,
    metadata: {
      value: alert.value,
      threshold: alert.threshold,
    },
  }
}
