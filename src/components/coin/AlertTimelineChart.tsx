import { useMemo } from 'react'
import { useStore } from '@/hooks/useStore'
import { alertHistoryService } from '@/services/alertHistoryService'

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

// Format timestamp to readable time
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
}

export function AlertTimelineChart({ symbol, height = 300 }: AlertTimelineChartProps) {
  // Watch for alert history changes
  const alertHistoryRefresh = useStore((state) => state.alertHistoryRefresh)

  // Filter alerts for this symbol in last 24 hours
  const filteredAlerts = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const allAlerts = alertHistoryService.getHistory()
    return allAlerts.filter(
      (entry) => entry.symbol === symbol && entry.timestamp >= oneDayAgo
    ).sort((a, b) => a.timestamp - b.timestamp) // Sort by time ascending
  }, [symbol, alertHistoryRefresh])

  // Get unique alert types present in the data
  const alertTypes = useMemo(() => {
    const types = new Set(filteredAlerts.map(entry => entry.alertType))
    return Array.from(types).sort()
  }, [filteredAlerts])

  // Calculate time range for X-axis
  const timeRange = useMemo(() => {
    if (filteredAlerts.length === 0) {
      const now = Date.now()
      return { min: now - 24 * 60 * 60 * 1000, max: now }
    }
    const timestamps = filteredAlerts.map(a => a.timestamp)
    const min = Math.min(...timestamps)
    const max = Math.max(...timestamps)
    // Add 5% padding on each side
    const padding = (max - min) * 0.05
    return { 
      min: min - padding, 
      max: max + padding 
    }
  }, [filteredAlerts])

  if (filteredAlerts.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-500" style={{ height }}>
        <div className="text-center">
          <p className="text-sm font-medium">No alerts in the last 24 hours</p>
          <p className="text-xs text-gray-600 mt-1">
            Alerts for {symbol} will appear here
          </p>
        </div>
      </div>
    )
  }

  const rowHeight = Math.max(40, height / alertTypes.length)
  const chartWidth = timeRange.max - timeRange.min

  return (
    <div className="w-full overflow-x-auto">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 px-2">
        {alertTypes.map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ALERT_TYPE_COLORS[type] || ALERT_TYPE_COLORS.custom }}
            />
            <span className="text-xs text-gray-400">
              {ALERT_TYPE_NAMES[type] || type}
            </span>
          </div>
        ))}
      </div>

      {/* Dot Plot Chart */}
      <div className="relative bg-gray-900/30 rounded border border-gray-700" style={{ height }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-32 border-r border-gray-700 bg-gray-900/50">
          {alertTypes.map((type) => (
            <div
              key={type}
              className="flex items-center px-3 text-xs text-gray-400 border-b border-gray-800"
              style={{ height: rowHeight }}
            >
              {ALERT_TYPE_NAMES[type] || type}
            </div>
          ))}
        </div>

        {/* Chart area with dots */}
        <div className="absolute left-32 right-0 top-0 bottom-0 overflow-hidden">
          {/* Grid lines */}
          {alertTypes.map((_, index) => (
            <div
              key={index}
              className="absolute left-0 right-0 border-b border-gray-800"
              style={{ top: (index + 1) * rowHeight }}
            />
          ))}

          {/* Alert dots */}
          {filteredAlerts.map((entry, index) => {
            const typeIndex = alertTypes.indexOf(entry.alertType)
            const xPos = ((entry.timestamp - timeRange.min) / chartWidth) * 100
            const yPos = typeIndex * rowHeight + rowHeight / 2

            return (
              <div
                key={`${entry.id}-${index}`}
                className="absolute group"
                style={{
                  left: `${xPos}%`,
                  top: yPos,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full transition-all hover:scale-150 hover:ring-2 hover:ring-white/50 cursor-pointer"
                  style={{
                    backgroundColor: ALERT_TYPE_COLORS[entry.alertType] || ALERT_TYPE_COLORS.custom,
                  }}
                />
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs whitespace-nowrap shadow-lg">
                    <div className="font-medium text-white">
                      {ALERT_TYPE_NAMES[entry.alertType] || entry.alertType}
                    </div>
                    <div className="text-gray-400 mt-0.5">
                      {formatTime(entry.timestamp)}
                    </div>
                    <div className="text-gray-400">
                      Price: ${entry.priceAtTrigger.toFixed(2)}
                    </div>
                    <div className={entry.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {entry.changePercent >= 0 ? '+' : ''}{entry.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Time axis labels (approximate) */}
        <div className="absolute left-32 right-0 -bottom-6 flex justify-between text-xs text-gray-500 px-2">
          <span>{formatTime(timeRange.min)}</span>
          <span>{formatTime((timeRange.min + timeRange.max) / 2)}</span>
          <span>{formatTime(timeRange.max)}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-8 px-2 text-xs text-gray-500">
        <span>Total alerts (24h): </span>
        <span className="font-medium text-gray-300">{filteredAlerts.length}</span>
      </div>
    </div>
  )
}
