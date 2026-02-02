import { useState, useEffect, useMemo, useRef } from 'react'
import { TradingChart } from './TradingChart'
import { fetchKlines, calculateIchimoku, type KlineInterval, type IchimokuData, COMMON_INTERVALS, INTERVAL_LABELS } from '@/services/chartData'
import { alertHistoryService } from '@/services/alertHistoryService'
import { useBubbleStream } from '@/hooks/useBubbleStream'
import type { Coin } from '@/types/coin'
import { ChartSkeleton, ErrorState } from '@/components/ui'
import { debug } from '@/utils/debug'

export interface ChartContainerProps {
  coin: Coin
  className?: string
}

/**
 * ChartContainer component with controls
 * 
 * Manages chart data fetching, interval selection, and chart type toggle
 */
export function ChartContainer({ coin, className = '' }: ChartContainerProps) {
  const [interval, setInterval] = useState<KlineInterval>('5m')
  const [showWeeklyVWAP, setShowWeeklyVWAP] = useState(false)
  const [showIchimoku, setShowIchimoku] = useState(false)
  const [showAlerts, setShowAlerts] = useState(true)
  const [showBubbles, setShowBubbles] = useState(true)
  const [bubbleTimeframe, setBubbleTimeframe] = useState<'5m' | '15m' | 'both'>('both')
  const [bubbleSize, setBubbleSize] = useState<'large' | 'medium+' | 'all'>('large')
  
  // Ref for debouncing interval changes
  const intervalTimerRef = useRef<number | null>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [vwapData, setVwapData] = useState<any[]>([]) // Separate data for VWAP (15m interval)
  const [ichimokuData, setIchimokuData] = useState<IchimokuData[]>([]) // Ichimoku indicator data
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertRefresh, setAlertRefresh] = useState(0)

  // Get bubbles for current coin (use fullSymbol to match futures symbol like PIEVERSEUSDT)
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
  
  // Debug: Log bubbles when they change
  useEffect(() => {
    debug.log(`🫧 ChartContainer: ${coin.fullSymbol} has ${filteredBubbles.length}/${allBubbles.length} bubbles (timeframe=${bubbleTimeframe}, size=${bubbleSize})`, filteredBubbles.slice(0, 3))
  }, [filteredBubbles.length, allBubbles.length, coin.fullSymbol, bubbleTimeframe, bubbleSize])

  // Get alerts for current coin from history - refresh every 3 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      setAlertRefresh(prev => prev + 1)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [])

  const coinAlerts = useMemo(() => {
    const allAlerts = alertHistoryService.getHistory()
    return allAlerts.filter(alert => alert.symbol === coin.symbol)
  }, [coin.symbol, alertRefresh])

  // Fetch chart data when coin or interval changes
  useEffect(() => {
    let isCancelled = false

    const loadChartData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchKlines(coin.fullSymbol, interval, 200)
        
        if (!isCancelled) {
          setChartData(data)
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
  }, [coin.symbol, coin.pair, interval])

  // Auto-refresh chart data periodically to update the latest candle
  useEffect(() => {
    console.log('🚀 Starting chart auto-refresh interval')
    let isCancelled = false
    
    const refreshChartData = async () => {
      console.log('🔄 Chart refresh triggered')
      try {
        const data = await fetchKlines(coin.fullSymbol, interval, 200)
        
        if (!isCancelled) {
          console.log(`📊 Fetched ${data.length} candles from API (requested 200)`)
          
          // Only update if data actually changed to avoid unnecessary re-renders
          if (data.length > 0) {
            setChartData(data)
            console.log(`✅ Chart updated: ${data.length} candles, last=${data[data.length-1]?.close}`)
          }
        }
      } catch (err) {
        // Silent fail on refresh - don't show error for background updates
        console.error('❌ Chart refresh failed:', err)
        debug.warn('Chart refresh failed:', err)
      }
    }

    // Refresh every 5 seconds to update the current candle
    console.log('⏱️ Setting up 5-second interval')
    const refreshInterval = window.setInterval(refreshChartData, 5000)
    console.log('✅ Interval created:', refreshInterval)

    return () => {
      console.log('🛑 Cleaning up chart refresh interval')
      isCancelled = true
      window.clearInterval(refreshInterval)
    }
  }, [coin.symbol, coin.pair, interval])

  // Fetch VWAP data separately (only when enabled) with efficient caching
  // Uses 15m interval: 7 days = 672 candles (vs 10,080 for 1m)
  // Refresh every 15 minutes to match interval and minimize API calls
  useEffect(() => {
    if (!showWeeklyVWAP) {
      setVwapData([])
      return
    }

    let isCancelled = false

    const fetchVwapData = async () => {
      try {
        // Fetch 15m candles: 7 days × 24 hours × 4 candles/hour = 672 candles
        // This covers a full week with efficient data usage
        const data = await fetchKlines(coin.fullSymbol, '15m', 672)
        
        if (!isCancelled) {
          setVwapData(data)
        }
      } catch (err) {
        debug.warn('VWAP data fetch failed:', err)
        // Don't block chart display on VWAP failure
      }
    }

    // Initial fetch
    fetchVwapData()

    // Refresh every 15 minutes (matches interval, minimizes API calls)
    const vwapRefreshInterval = window.setInterval(fetchVwapData, 15 * 60 * 1000)

    return () => {
      isCancelled = true
      window.clearInterval(vwapRefreshInterval)
    }
  }, [coin.symbol, coin.pair, showWeeklyVWAP])

  // Calculate Ichimoku when enabled and chart data changes
  useEffect(() => {
    if (!showIchimoku || chartData.length < 52) {
      setIchimokuData([])
      return
    }

    try {
      const calculated = calculateIchimoku(chartData)
      if (calculated) {
        setIchimokuData([calculated])
        debug.log(`📊 Calculated Ichimoku data point`)
      } else {
        setIchimokuData([])
      }
    } catch (err) {
      debug.error('Ichimoku calculation failed:', err)
      setIchimokuData([])
    }
  }, [chartData, showIchimoku])

  const handleIntervalChange = (newInterval: KlineInterval) => {
    // Clear existing timer
    if (intervalTimerRef.current !== null) {
      window.clearTimeout(intervalTimerRef.current)
    }
    
    // Debounce interval changes to prevent rapid API calls
    intervalTimerRef.current = window.setTimeout(() => {
      setInterval(newInterval)
      intervalTimerRef.current = null
    }, 300) // 300ms delay
  }
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (intervalTimerRef.current !== null) {
        window.clearTimeout(intervalTimerRef.current)
      }
    }
  }, [])

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Interval Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Interval:</span>
          <div className="flex gap-1">
            {COMMON_INTERVALS.map((int) => (
              <button
                key={int}
                onClick={() => handleIntervalChange(int)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  interval === int
                    ? 'bg-accent text-white'
                    : 'bg-surface-light text-text-secondary hover:bg-surface-lighter'
                }`}
              >
                {int}
              </button>
            ))}
          </div>
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Indicators:</span>
          <button
            onClick={() => setShowWeeklyVWAP(!showWeeklyVWAP)}
            className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
              showWeeklyVWAP
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'bg-surface-light text-text-secondary hover:bg-surface-lighter'
            }`}
            title="Weekly Volume Weighted Average Price"
          >
            <span className={showWeeklyVWAP ? 'text-amber-500' : 'text-gray-400'}>●</span>
            Weekly VWAP
          </button>
          <button
            onClick={() => setShowIchimoku(!showIchimoku)}
            disabled={chartData.length < 52}
            className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
              showIchimoku
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                : 'bg-surface-light text-text-secondary hover:bg-surface-lighter disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={chartData.length < 52 ? 'Requires 52+ candles' : 'Ichimoku Cloud (Tenkan, Kijun, Senkou A/B, Chikou)'}
          >
            <span className={showIchimoku ? 'text-blue-500' : 'text-gray-400'}>☁</span>
            Ichimoku
          </button>
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
              showAlerts
                ? 'bg-accent/20 text-accent border border-accent/50'
                : 'bg-surface-light text-text-secondary hover:bg-surface-lighter'
            }`}
            title="Show alert markers on chart"
          >
            <span className={showAlerts ? 'text-accent' : 'text-gray-400'}>▲</span>
            Alerts {coinAlerts.length > 0 && `(${coinAlerts.length})`}
          </button>
          <button
            onClick={() => setShowBubbles(!showBubbles)}
            className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
              showBubbles
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'bg-surface-light text-text-secondary hover:bg-surface-lighter'
            }`}
            title="Show volume bubble markers on chart"
          >
            <span className={showBubbles ? 'text-purple-500' : 'text-gray-400'}>🫧</span>
            Bubbles {filteredBubbles.length > 0 && `(${filteredBubbles.length})`}
          </button>
          
          {/* Bubble Filters - Only show when bubbles enabled */}
          {showBubbles && (
            <>
              <select
                value={bubbleTimeframe}
                onChange={(e) => setBubbleTimeframe(e.target.value as '5m' | '15m' | 'both')}
                className="px-2 py-1 text-xs rounded bg-surface-light text-text-secondary border border-border hover:bg-surface-lighter cursor-pointer"
                title="Filter bubbles by timeframe"
              >
                <option value="both">5m + 15m</option>
                <option value="5m">5m only</option>
                <option value="15m">15m only</option>
              </select>
              <select
                value={bubbleSize}
                onChange={(e) => setBubbleSize(e.target.value as 'large' | 'medium+' | 'all')}
                className="px-2 py-1 text-xs rounded bg-surface-light text-text-secondary border border-border hover:bg-surface-lighter cursor-pointer"
                title="Filter bubbles by size"
              >
                <option value="large">Large only</option>
                <option value="medium+">Large + Medium</option>
                <option value="all">All sizes</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-surface-dark border border-border rounded-lg p-4">
        {isLoading ? (
          <ChartSkeleton height={400} />
        ) : error ? (
          <ErrorState
            icon="📉"
            message="Chart Data Error"
            description={error}
            onRetry={() => {
              setError(null)
              setInterval(interval)
            }}
          />
        ) : (
          <TradingChart
            data={chartData}
            height={400}
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
        )}
      </div>

      {/* Chart Info */}
      {!error && !isLoading && chartData.length > 0 && (
        <div className="text-xs text-text-tertiary">
          {INTERVAL_LABELS[interval]} • Last {chartData.length} candles with volume
        </div>
      )}
    </div>
  )
}
