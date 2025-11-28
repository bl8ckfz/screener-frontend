import { useState, useEffect } from 'react'
import { TradingChart, type ChartType } from './TradingChart'
import { fetchKlines, type KlineInterval, COMMON_INTERVALS, INTERVAL_LABELS } from '@/services/chartData'
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
  const [chartData, setChartData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
