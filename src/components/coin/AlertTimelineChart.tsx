import { useMemo, useEffect, useRef } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi, LineData } from 'lightweight-charts'
import { useStore } from '@/hooks/useStore'
import { alertHistoryService } from '@/services/alertHistoryService'
import type { AlertType } from '@/types/alert'

interface AlertTimelineChartProps {
  symbol: string
  height?: number
}

// Color scheme for different alert types
const ALERT_TYPE_COLORS: Record<string, string> = {
  pioneer_bull: '#10b981', // green-500
  pioneer_bear: '#ef4444', // red-500
  '5m_big_bull': '#34d399', // green-400
  '5m_big_bear': '#f87171', // red-400
  '15m_big_bull': '#059669', // green-600
  '15m_big_bear': '#dc2626', // red-600
  bottom_hunter: '#3b82f6', // blue-500
  top_hunter: '#f59e0b', // amber-500
  price_pump: '#22c55e', // green-500
  price_dump: '#ef4444', // red-500
  volume_spike: '#8b5cf6', // violet-500
  custom: '#6b7280', // gray-500
}

// Display names for alert types
const ALERT_TYPE_NAMES: Record<string, string> = {
  pioneer_bull: 'Pioneer Bull',
  pioneer_bear: 'Pioneer Bear',
  '5m_big_bull': '5m Big Bull',
  '5m_big_bear': '5m Big Bear',
  '15m_big_bull': '15m Big Bull',
  '15m_big_bear': '15m Big Bear',
  bottom_hunter: 'Bottom Hunter',
  top_hunter: 'Top Hunter',
  price_pump: 'Price Pump',
  price_dump: 'Price Dump',
  volume_spike: 'Volume Spike',
  custom: 'Custom',
}

export function AlertTimelineChart({ symbol, height = 200 }: AlertTimelineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())

  // Watch for alert history changes
  const alertHistoryRefresh = useStore((state) => state.alertHistoryRefresh)

  // Filter alerts for this symbol in last 24 hours
  const filteredAlerts = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const allAlerts = alertHistoryService.getHistory()
    return allAlerts.filter(
      (entry) => entry.symbol === symbol && entry.timestamp >= oneDayAgo
    )
  }, [symbol, alertHistoryRefresh])

  // Group alerts by type and create time series data
  const alertTimeSeries = useMemo(() => {
    if (filteredAlerts.length === 0) return new Map<string, LineData[]>()

    // Group by alert type
    const groupedByType = filteredAlerts.reduce((acc, entry) => {
      const type = entry.alertType
      if (!acc.has(type)) {
        acc.set(type, [])
      }
      acc.get(type)!.push(entry)
      return acc
    }, new Map<AlertType, typeof filteredAlerts>())

    // Convert to time series data (15-minute buckets)
    const timeSeriesMap = new Map<AlertType, LineData[]>()
    const bucketSize = 15 * 60 * 1000 // 15 minutes in ms

    groupedByType.forEach((entries, type) => {
      // Create buckets for last 24 hours
      const now = Date.now()
      const startTime = now - 24 * 60 * 60 * 1000
      const buckets = new Map<number, number>()

      // Initialize all buckets to 0
      for (let time = startTime; time <= now; time += bucketSize) {
        const bucketKey = Math.floor(time / bucketSize) * bucketSize
        buckets.set(bucketKey, 0)
      }

      // Count alerts per bucket
      entries.forEach((entry) => {
        const bucketKey = Math.floor(entry.timestamp / bucketSize) * bucketSize
        buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1)
      })

      // Convert to LineData format
      const lineData: LineData[] = Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([timestamp, count]) => ({
          time: Math.floor(timestamp / 1000) as never, // Convert to seconds for lightweight-charts
          value: count,
        }))

      timeSeriesMap.set(type, lineData)
    })

    return timeSeriesMap
  }, [filteredAlerts])

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af', // gray-400
      },
      grid: {
        vertLines: { color: '#374151' }, // gray-700
        horzLines: { color: '#374151' },
      },
      width: chartContainerRef.current.clientWidth,
      height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#4b5563', // gray-600
      },
      rightPriceScale: {
        borderColor: '#4b5563',
      },
      crosshair: {
        mode: 1, // Magnet mode
        vertLine: {
          width: 1,
          color: '#6b7280',
          style: 2, // Dashed
        },
        horzLine: {
          width: 1,
          color: '#6b7280',
          style: 2,
        },
      },
    })

    chartRef.current = chart

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesMapRef.current.clear()
    }
  }, [height])

  // Update series data
  useEffect(() => {
    if (!chartRef.current) return

    // Remove all existing series
    seriesMapRef.current.forEach((series) => {
      chartRef.current!.removeSeries(series)
    })
    seriesMapRef.current.clear()

    // Add new series for each alert type
    alertTimeSeries.forEach((data, type) => {
      const color = ALERT_TYPE_COLORS[type] || ALERT_TYPE_COLORS.custom
      const series = chartRef.current!.addLineSeries({
        color,
        lineWidth: 2,
        title: ALERT_TYPE_NAMES[type] || type,
        priceLineVisible: false,
        lastValueVisible: false,
      })

      series.setData(data)
      seriesMapRef.current.set(type, series)
    })

    // Fit content
    chartRef.current.timeScale().fitContent()
  }, [alertTimeSeries])

  if (filteredAlerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="text-sm font-medium">No alerts in the last 24 hours</p>
          <p className="text-xs text-gray-600 mt-1">
            Alerts for {symbol} will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3 px-2">
        {Array.from(alertTimeSeries.keys()).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5"
              style={{ backgroundColor: ALERT_TYPE_COLORS[type] || ALERT_TYPE_COLORS.custom }}
            />
            <span className="text-xs text-gray-400">
              {ALERT_TYPE_NAMES[type] || type}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="relative" />

      {/* Summary Stats */}
      <div className="mt-3 px-2 text-xs text-gray-500">
        <span>Total alerts (24h): </span>
        <span className="font-medium text-gray-300">{filteredAlerts.length}</span>
      </div>
    </div>
  )
}
