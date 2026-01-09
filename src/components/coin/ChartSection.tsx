import { useState, useEffect, useMemo } from 'react'
import { TradingChart } from './TradingChart'
import { AlertTimelineChart } from './AlertTimelineChart'
import { ExternalLinks } from './ExternalLinks'
import { fetchKlines, type KlineInterval, COMMON_INTERVALS, INTERVAL_LABELS } from '@/services/chartData'
import { alertHistoryService } from '@/services/alertHistoryService'
import { useBubbleStream } from '@/hooks/useBubbleStream'
import { useStore } from '@/hooks/useStore'
import { calculateIchimoku, type IchimokuData } from '@/utils/indicators'
import type { Coin } from '@/types/coin'
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

  // Get bubbles for current coin (use fullSymbol to match futures symbol)
  const { bubbles: allBubbles } = useBubbleStream({ symbolFilter: selectedCoin?.fullSymbol })
  
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
  
  const coinAlerts = useMemo(() => {
    if (!selectedCoin) return []
    const allAlerts = alertHistoryService.getHistory()
    return allAlerts.filter(alert => alert.symbol === selectedCoin.symbol)
  }, [selectedCoin?.symbol, alertHistoryRefresh])

  // Fetch chart data when coin or interval changes
  useEffect(() => {
    if (!selectedCoin) {
      setChartData([])
      setVwapData([])
      setIchimokuData([])
      return
    }

    let isCancelled = false

    const loadChartData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchKlines(selectedCoin.symbol, selectedCoin.pair, interval, 100)
        
        if (!isCancelled) {
          setChartData(data.candlesticks)
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chart data')
          debug.error('Chart data error:', err)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadChartData()

    return () => {
      isCancelled = true
    }
  }, [selectedCoin, interval])

  // Auto-refresh chart data periodically to update the latest candle
  useEffect(() => {
    if (!selectedCoin) return

    console.log('🚀 Starting chart auto-refresh interval (ChartSection)')
    let isCancelled = false

    const refreshChartData = async () => {
      console.log('🔄 Chart refresh triggered (ChartSection)')
      try {
        const data = await fetchKlines(selectedCoin.symbol, selectedCoin.pair, interval, 100)

        if (!isCancelled) {
          const candles = [...data.candlesticks]
          console.log(`🔄 Chart refresh: ${candles.length} candles, last=${candles[candles.length - 1]?.close}`)
          setChartData(candles)
        }
      } catch (err) {
        console.error('❌ Chart refresh failed:', err)
        debug.warn('Chart refresh failed:', err)
      }
    }

    console.log('⏱️ Setting up 5-second interval (ChartSection)')
    const refreshInterval = window.setInterval(refreshChartData, 5000)
    console.log('✅ Interval created (ChartSection):', refreshInterval)

    return () => {
      console.log('🛑 Cleaning up chart refresh interval (ChartSection)')
      isCancelled = true
      window.clearInterval(refreshInterval)
    }
  }, [selectedCoin?.symbol, selectedCoin?.pair, interval])

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
        const data = await fetchKlines(selectedCoin.symbol, selectedCoin.pair, '15m', 672) // 672 * 15m = 1 week
        
        if (!isCancelled) {
          setVwapData(data.candlesticks)
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
      setIchimokuData(ichimoku)
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
    <div className={`bg-gray-800 rounded-lg transition-all duration-300 ${className}`}>
      {/* Header with coin info and close button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
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
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-700">
        {/* Interval Selector */}
        <div className="flex items-center gap-1">
          {COMMON_INTERVALS.map((int) => (
            <button
              key={int}
              onClick={() => setInterval(int)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
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
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowWeeklyVWAP(!showWeeklyVWAP)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              showWeeklyVWAP
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            VWAP
          </button>
          <button
            onClick={() => setShowIchimoku(!showIchimoku)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              showIchimoku
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Ichimoku
          </button>
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              showAlerts
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Alerts
          </button>
          <button
            onClick={() => setShowBubbles(!showBubbles)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
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
      <div className="p-4">
        <TradingChart
          data={chartData}
          symbol={selectedCoin.fullSymbol}
          height={360} // Mobile: 300px, Desktop: 480px handled by responsive CSS (20% increase)
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

      {/* Alert Timeline Chart */}
      <div className="px-4 pb-4">
        <div className="bg-gray-900 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Alert Timeline (24h)
          </h4>
          <AlertTimelineChart symbol={selectedCoin.symbol} height={150} />
        </div>
      </div>

      {/* External Links */}
      <div className="px-4 pb-4">
        <ExternalLinks coin={selectedCoin} />
      </div>
    </div>
  )
}
