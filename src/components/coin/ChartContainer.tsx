import { useState, useEffect, useMemo, useRef } from 'react'
import { TradingChart } from './TradingChart'
import { fetchKlines, type KlineInterval, COMMON_INTERVALS, INTERVAL_LABELS } from '@/services/chartData'
import { alertHistoryService } from '@/services/alertHistoryService'
import { alertHistory } from '@/services/alertHistory'
import type { Coin } from '@/types/coin'
import type { AlertHistoryEntry } from '@/types/alertHistory'
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
  const [showAlerts, setShowAlerts] = useState(true)
  
  // Ref for debouncing interval changes
  const intervalTimerRef = useRef<number | null>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertRefresh, setAlertRefresh] = useState(0)
  const [historicalAlerts, setHistoricalAlerts] = useState<AlertHistoryEntry[]>([])

  // Timer for refreshing localStorage alerts (real-time)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setAlertRefresh(prev => prev + 1)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [])

  // Get alerts for current coin from backend API - fetch once and refresh every 10 seconds
  useEffect(() => {
    let isCancelled = false

    const fetchHistoricalAlerts = async () => {
      try {
        // Fetch from backend API (up to 2000 alerts, 48h retention)
        const backendAlerts = await alertHistory.getAllBySymbol(coin.symbol)
        
        if (!isCancelled) {
          // Transform to AlertHistoryEntry format expected by chart
          const transformed: AlertHistoryEntry[] = backendAlerts.map(alert => ({
            id: alert.id,
            symbol: alert.symbol,
            alertType: alert.type as any,
            timestamp: alert.timestamp,
            priceAtTrigger: alert.value || 0,
            changePercent: 0,
            metadata: {
              value: alert.value,
              threshold: alert.threshold,
            },
          }))
          
          debug.log(`📊 Fetched ${transformed.length} historical alerts for ${coin.symbol} from backend`)
          setHistoricalAlerts(transformed)
        }
      } catch (err) {
        if (!isCancelled) {
          debug.warn('Failed to fetch historical alerts:', err)
          // Fallback to localStorage alerts
          const localAlerts = alertHistoryService.getHistory().filter(alert => alert.symbol === coin.symbol)
          setHistoricalAlerts(localAlerts)
        }
      }
    }

    fetchHistoricalAlerts()

    // Refresh every 10 seconds
    const timer = window.setInterval(fetchHistoricalAlerts, 10000)

    return () => {
      isCancelled = true
      window.clearInterval(timer)
    }
  }, [coin.symbol])

  // Merge backend alerts with real-time localStorage alerts for complete history
  const coinAlerts = useMemo(() => {
    // Get recent alerts from localStorage (last 3 seconds of real-time data)
    const recentAlerts = alertHistoryService.getHistory()
      .filter(alert => alert.symbol === coin.symbol && Date.now() - alert.timestamp < 3000)
    
    // Combine with historical alerts from backend, remove duplicates by ID
    const alertMap = new Map<string, AlertHistoryEntry>()
    
    // Add historical alerts first
    historicalAlerts.forEach(alert => alertMap.set(alert.id, alert))
    
    // Add/override with recent alerts
    recentAlerts.forEach(alert => alertMap.set(alert.id, alert))
    
    // Return sorted by timestamp (newest first)
    return Array.from(alertMap.values()).sort((a, b) => b.timestamp - a.timestamp)
  }, [coin.symbol, historicalAlerts, alertRefresh])

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
  }, [coin.fullSymbol, interval])

  // Interval-close resync: fetch exactly when candle closes (no dependency loop)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    let isCancelled = false

    const getIntervalSeconds = (ivl: string): number => {
      const map: Record<string, number> = {
        '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
        '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600,
        '8h': 28800, '12h': 43200, '1d': 86400, '3d': 259200,
        '1w': 604800, '1M': 2592000
      }
      return map[ivl] || 300
    }

    const scheduleNextFetch = async () => {
      const intervalSeconds = getIntervalSeconds(interval)
      const nowSec = Math.floor(Date.now() / 1000)
      // Calculate next candle boundary (aligned to interval)
      const nextClose = Math.ceil(nowSec / intervalSeconds) * intervalSeconds
      const delayMs = Math.max(500, (nextClose - nowSec + 1) * 1000)

      timeoutId = setTimeout(async () => {
        if (isCancelled) return

        try {
          const data = await fetchKlines(coin.fullSymbol, interval, 200)
          if (!isCancelled && data.length > 0) {
            setChartData(data)
          }
        } catch (err) {
          debug.warn('Chart refresh failed:', err)
        }

        // Recursively schedule next fetch
        if (!isCancelled) {
          scheduleNextFetch()
        }
      }, delayMs)
    }

    scheduleNextFetch()

    return () => {
      isCancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [coin.fullSymbol, interval])

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
            showAlerts={showAlerts}
            alerts={coinAlerts}
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
