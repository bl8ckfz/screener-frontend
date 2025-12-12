import { useState, useEffect, useMemo } from 'react'
import { TradingChart, type ChartType } from './TradingChart'
import { fetchKlines, type KlineInterval, COMMON_INTERVALS, INTERVAL_LABELS } from '@/services/chartData'
import { alertHistoryService } from '@/services/alertHistoryService'
import { useBubbleStream } from '@/hooks/useBubbleStream'
import type { Coin } from '@/types/coin'
import { ChartSkeleton, ErrorState } from '@/components/ui'

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
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [showWeeklyVWAP, setShowWeeklyVWAP] = useState(false)
  const [showAlerts, setShowAlerts] = useState(true)
  const [showBubbles, setShowBubbles] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertRefresh, setAlertRefresh] = useState(0)

  // Get bubbles for current coin
  const { bubbles } = useBubbleStream({ symbolFilter: coin.symbol })

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
        const data = await fetchKlines(coin.symbol, coin.pair, interval, 100)
        
        if (!isCancelled) {
          setChartData(data.candlesticks)
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chart data')
          console.error('Chart data error:', err)
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
    let isCancelled = false
    
    const refreshChartData = async () => {
      try {
        const data = await fetchKlines(coin.symbol, coin.pair, interval, 100)
        
        if (!isCancelled) {
          setChartData(data.candlesticks)
        }
      } catch (err) {
        // Silent fail on refresh - don't show error for background updates
        console.warn('Chart refresh failed:', err)
      }
    }

    // Refresh every 5 seconds to update the current candle
    const refreshInterval = window.setInterval(refreshChartData, 5000)

    return () => {
      isCancelled = true
      window.clearInterval(refreshInterval)
    }
  }, [coin.symbol, coin.pair, interval])

  const handleIntervalChange = (newInterval: KlineInterval) => {
    setInterval(newInterval)
  }

  const handleChartTypeChange = (newType: ChartType) => {
    setChartType(newType)
  }

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

        {/* Chart Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Type:</span>
          <div className="flex gap-1">
            {(['candlestick', 'line', 'area'] as ChartType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleChartTypeChange(type)}
                className={`px-3 py-1 text-xs rounded capitalize transition-colors ${
                  chartType === type
                    ? 'bg-accent text-white'
                    : 'bg-surface-light text-text-secondary hover:bg-surface-lighter'
                }`}
                title={type === 'candlestick' ? 'Candlestick Chart' : type === 'line' ? 'Line Chart' : 'Area Chart'}
              >
                {type === 'candlestick' ? '🕯️' : type === 'line' ? '📈' : '📊'} {type}
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
            Bubbles {bubbles.length > 0 && `(${bubbles.length})`}
          </button>
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
            symbol={`${coin.symbol}/${coin.pair}`}
            type={chartType}
            height={400}
            showVolume={chartType === 'candlestick'}
            showWeeklyVWAP={showWeeklyVWAP}
            showAlerts={showAlerts}
            alerts={coinAlerts}
            showBubbles={showBubbles}
            bubbles={bubbles}
          />
        )}
      </div>

      {/* Chart Info */}
      {!error && !isLoading && chartData.length > 0 && (
        <div className="text-xs text-text-tertiary">
          {INTERVAL_LABELS[interval]} • Last {chartData.length} candles
          {chartType === 'candlestick' && ' with volume'}
        </div>
      )}
    </div>
  )
}
