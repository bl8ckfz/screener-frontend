import { useMemo } from 'react'
import { useStore } from '@/hooks/useStore'
import { alertHistoryService } from '@/services/alertHistoryService'

interface AlertTimelineChartProps {
  symbol: string
  height?: number
}

// Color scheme for futures alerts - bullish in green gamma, bearish in red gamma
const ALERT_TYPE_COLORS: Record<string, string> = {
  // Bullish alerts - green gamma
  futures_big_bull_60: '#22c55e', // green-500
  futures_pioneer_bull: '#10b981', // green-500 (emerald)
  futures_5_big_bull: '#84cc16', // lime-500
  futures_15_big_bull: '#4ade80', // green-400
  futures_bottom_hunter: '#a855f7', // purple for hunter alignment
  
  // Bearish alerts - red gamma
  futures_big_bear_60: '#ef4444', // red-500
  futures_pioneer_bear: '#dc2626', // red-600
  futures_5_big_bear: '#f87171', // red-400
  futures_15_big_bear: '#fb923c', // orange-400 (red-orange)
  futures_top_hunter: '#a855f7', // purple for hunter alignment
}

// Display names for futures alert types - without "futures_" prefix
const getAlertTypeName = (type: string): string => {
  // Remove futures_ prefix if present
  const cleanType = type.replace(/^futures_/, '')
  
  const names: Record<string, string> = {
    big_bull_60: '60 Big Bull',
    big_bear_60: '60 Big Bear',
    pioneer_bull: 'Pioneer Bull',
    pioneer_bear: 'Pioneer Bear',
    '5_big_bull': '5 Big Bull',
    '5_big_bear': '5 Big Bear',
    '15_big_bull': '15 Big Bull',
    '15_big_bear': '15 Big Bear',
    bottom_hunter: 'Bottom Hunter',
    top_hunter: 'Top Hunter',
  }
  
  return names[cleanType] || cleanType.split('_').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ')
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

export function AlertTimelineChart({ symbol, height: _unusedHeight }: AlertTimelineChartProps) {
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

  // Get unique alert types in chronological order; new types appear after existing ones
  const alertTypes = useMemo(() => {
    const types: string[] = []
    for (const entry of filteredAlerts) {
      if (!types.includes(entry.alertType)) {
        types.push(entry.alertType)
      }
    }
    return types
  }, [filteredAlerts])

  // Calculate dynamic height based on number of alert types
  // Minimum 40px per row, with reasonable bounds
  const dynamicHeight = useMemo(() => {
    const rowCount = alertTypes.length || 1
    const minRowHeight = 45
    const calculatedHeight = rowCount * minRowHeight
    // Min 200px, max 800px for reasonable display
    return Math.max(200, Math.min(calculatedHeight, 800))
  }, [alertTypes.length])

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
      <div className="flex items-center justify-center text-gray-500" style={{ height: 200 }}>
        <div className="text-center">
          <p className="text-sm font-medium">No alerts in the last 24 hours</p>
          <p className="text-xs text-gray-600 mt-1">
            Alerts for {symbol} will appear here
          </p>
        </div>
      </div>
    )
  }

  const rowHeight = dynamicHeight / alertTypes.length
  const chartWidth = timeRange.max - timeRange.min

  return (
    <div className="w-full overflow-x-auto overflow-y-visible">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 px-2">
        {alertTypes.map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ALERT_TYPE_COLORS[type] || ALERT_TYPE_COLORS.custom }}
            />
            <span className="text-xs text-gray-400">
              {getAlertTypeName(type)}
            </span>
          </div>
        ))}
      </div>

      {/* Dot Plot Chart */}
      <div className="relative bg-gray-900/30 rounded border border-gray-700" style={{ height: dynamicHeight, overflow: 'visible' }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-36 border-r border-gray-700 bg-gray-900/50">
          {alertTypes.map((type) => (
            <div
              key={type}
              className="flex items-center px-3 text-xs text-gray-400 border-b border-gray-800"
              style={{ height: rowHeight, minHeight: '40px' }}
            >
              <span className="truncate">{getAlertTypeName(type)}</span>
            </div>
          ))}
        </div>

        {/* Chart area with dots */}
        <div className="absolute left-36 right-0 top-0 bottom-0 overflow-visible">
          {/* Grid lines */}
          {alertTypes.map((_, index) => (
            <div
              key={index}
              className="absolute left-0 right-0 border-b border-gray-800 z-0"
              style={{ top: (index + 1) * rowHeight }}
            />
          ))}

          {/* Alert dots */}
          {filteredAlerts.map((entry, index) => {
            const typeIndex = alertTypes.indexOf(entry.alertType)
            const xPos = ((entry.timestamp - timeRange.min) / chartWidth) * 100
            const yPos = typeIndex * rowHeight + rowHeight / 2
            
            // Determine tooltip position based on location in chart
            const isNearTop = typeIndex < alertTypes.length / 2
            const isNearLeft = xPos < 30
            const isNearRight = xPos > 70

            return (
              <div
                key={`${entry.id}-${index}`}
                className="absolute group z-10"
                style={{
                  left: `${xPos}%`,
                  top: yPos,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Dot */}
                <div
                  className="w-3 h-3 rounded-full transition-all hover:scale-150 hover:ring-2 hover:ring-white/50 cursor-pointer shadow-lg relative z-10"
                  style={{
                    backgroundColor: ALERT_TYPE_COLORS[entry.alertType] || ALERT_TYPE_COLORS.custom,
                  }}
                />
                
                {/* Tooltip - positioned dynamically to stay within bounds */}
                <div 
                  className={`absolute hidden group-hover:block z-50 pointer-events-none ${
                    isNearTop ? 'top-full mt-2' : 'bottom-full mb-2'
                  } ${
                    isNearLeft ? 'left-0' : isNearRight ? 'right-0' : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  <div className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs whitespace-nowrap shadow-xl z-50">
                    <div className="font-medium text-white">
                      {getAlertTypeName(entry.alertType)}
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
        <div className="absolute left-36 right-0 -bottom-6 flex justify-between text-xs text-gray-500 px-2">
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
