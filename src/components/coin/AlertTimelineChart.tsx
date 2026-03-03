import { useMemo, useState, useRef, useEffect } from 'react'
import type { AlertHistoryEntry } from '@/types/alertHistory'
import type { Alert } from '@/types/alert'
import { useStore } from '@/hooks/useStore'
import { resolveAlertColor } from '@/types/alertColors'

interface AlertTimelineChartProps {
  symbol: string
  fullSymbol?: string
  alerts?: Alert[]
  height?: number
}

// Static text color classes (Tailwind classes can't be dynamic)
const ALERT_TEXT_CLASSES: Record<string, string> = {
  // Bullish
  futures_big_bull_60: 'text-green-400',
  futures_pioneer_bull: 'text-emerald-300',
  futures_5_big_bull: 'text-lime-400',
  futures_15_big_bull: 'text-green-500',
  futures_bottom_hunter: 'text-purple-400',
  // Bearish
  futures_big_bear_60: 'text-red-400',
  futures_pioneer_bear: 'text-pink-300',
  futures_5_big_bear: 'text-orange-400',
  futures_15_big_bear: 'text-red-500',
  futures_top_hunter: 'text-purple-400',
  // V2 Optimized
  futures_bottom_hunter_v2: 'text-violet-400',
  futures_top_hunter_v2: 'text-violet-400',
  futures_big_bull_60_v2: 'text-green-400',
  futures_big_bear_60_v2: 'text-red-400',
  // Whale
  futures_whale_detector: 'text-cyan-400',
  futures_whale_accumulation: 'text-emerald-400',
  futures_whale_distribution: 'text-red-400',
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
    // V2 Optimized
    bottom_hunter_v2: '🟢 Bottom Hunter V2',
    top_hunter_v2: '🔴 Top Hunter V2',
    big_bull_60_v2: '🟢 Big Bull 60m V2',
    big_bear_60_v2: '🔴 Big Bear 60m V2',
    // Whale
    whale_detector: '🐋 Whale Detector',
    whale_accumulation: '🐋⬆ Whale Accumulation',
    whale_distribution: '🐋⬇ Whale Distribution',
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

export function AlertTimelineChart({ symbol, fullSymbol: _fullSymbol, alerts = [], height: _unusedHeight }: AlertTimelineChartProps) {
  const alertColors = useStore((state) => state.alertColors)
  // Visible time range (in milliseconds from now)
  const [visibleRange, setVisibleRange] = useState(60 * 60 * 1000) // Start at 1 hour
  const chartRef = useRef<HTMLDivElement>(null)
  const showDate = visibleRange >= 24 * 60 * 60 * 1000

  // Transform Alert[] to AlertHistoryEntry[] for internal use
  const filteredAlerts = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000 // 48h max
    return alerts
      .filter(alert => alert.timestamp >= cutoff)
      .map(alert => ({
        id: alert.id,
        symbol: alert.symbol,
        alertType: alert.type,
        timestamp: alert.timestamp,
        priceAtTrigger: alert.value,
        changePercent: 0,
        metadata: {
          value: alert.value,
          threshold: alert.threshold,
        },
      } as AlertHistoryEntry))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [alerts])

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

  // Calculate visible time range (anchored to current time like Heatmap)
  // Include filteredAlerts.length so Date.now() refreshes when new alerts arrive
  const timeRange = useMemo(() => {
    const now = Date.now()
    const min = now - visibleRange
    const max = now
    return { min, max }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRange, filteredAlerts.length])

  // TradingView-style wheel zoom handler
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      const delta = -e.deltaY
      const zoomFactor = delta > 0 ? 0.85 : 1.15 // Scroll up = zoom in (decrease range)
      
      setVisibleRange(prev => {
        const newRange = prev * zoomFactor
        // Constrain between 1 hour and 48 hours
        return Math.max(60 * 60 * 1000, Math.min(newRange, 48 * 60 * 60 * 1000))
      })
    }

    const chartElement = chartRef.current
    if (chartElement) {
      chartElement.addEventListener('wheel', handleWheel, { passive: false, capture: true })
      return () => {
        chartElement.removeEventListener('wheel', handleWheel, { capture: true })
      }
    }
  }, [filteredAlerts.length])

  // Reset zoom when symbol changes
  useEffect(() => {
    setVisibleRange(60 * 60 * 1000) // Reset to 1 hour
  }, [symbol])

  const formatDateTimeShort = (timestamp: number): string => {
    const date = new Date(timestamp)
    const month = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
    return `${month} ${formatTime(timestamp)}`
  }

  // Generate dynamic time labels based on zoom level
  // Include filteredAlerts.length so labels stay in sync with timeRange refresh
  const timeLabels = useMemo(() => {
    const now = Date.now()
    const min = now - visibleRange
    const max = now
    
    // Adjust label count based on zoom level
    const labelCount = visibleRange < 5 * 60 * 1000 ? 12 : // <5min: 12 labels
                       visibleRange < 60 * 60 * 1000 ? 8 :  // <1h: 8 labels
                       visibleRange < 6 * 60 * 60 * 1000 ? 6 : // <6h: 6 labels
                       4 // else: 4 labels
    
    return Array.from({ length: labelCount }, (_, i) => {
      const timestamp = min + (i / (labelCount - 1)) * (max - min)
      return { 
        position: (i / (labelCount - 1)) * 100, 
        label: showDate ? formatDateTimeShort(timestamp) : formatTime(timestamp)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRange, showDate, filteredAlerts.length])

  // Calculate chart width (must be before early return)
  const chartWidth = useMemo(() => {
    return timeRange.max - timeRange.min
  }, [timeRange])

  // Group alerts by type for row display (must be before early return)
  const alertsByType = useMemo(() => {
    const groups = new Map<string, AlertHistoryEntry[]>()
    
    // Only include alerts within the visible time range
    filteredAlerts.forEach((alert) => {
      if (alert.timestamp >= timeRange.min && alert.timestamp <= timeRange.max) {
        const existing = groups.get(alert.alertType) || []
        existing.push(alert)
        groups.set(alert.alertType, existing)
      }
    })
    
    // Convert to array with metadata, only including types with alerts in visible range
    return alertTypes
      .map(type => ({
        alertType: type,
        alerts: groups.get(type) || [],
        count: (groups.get(type) || []).length
      }))
      .filter(group => group.count > 0) // Hide rows with no alerts in visible range
  }, [filteredAlerts, alertTypes, timeRange])

  if (filteredAlerts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="text-center">
          <p className="text-sm font-medium">No alerts in the selected time range</p>
          <p className="text-xs text-gray-600 mt-1">
            Use 24H or 48H buttons to view older alerts
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-2" ref={chartRef}>
      {/* Header with Zoom Controls */}
      <div className="flex items-center justify-between px-1 md:px-2">
        <h4 className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Alert Timeline
        </h4>
        {/* Zoom Controls */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button
            onClick={() => setVisibleRange(48 * 60 * 60 * 1000)}
            className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs rounded transition-colors ${
              visibleRange === 48 * 60 * 60 * 1000
                ? 'bg-accent text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="View 48 hours"
          >
            48H
          </button>
          <button
            onClick={() => setVisibleRange(24 * 60 * 60 * 1000)}
            className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs rounded transition-colors ${
              visibleRange === 24 * 60 * 60 * 1000
                ? 'bg-accent text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="View 24 hours"
          >
            24H
          </button>
          <button
            onClick={() => setVisibleRange(60 * 60 * 1000)}
            className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs rounded transition-colors ${
              visibleRange === 60 * 60 * 1000
                ? 'bg-accent text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title="View 1 hour"
          >
            1H
          </button>
          <span className="text-[10px] md:text-xs text-gray-500">
            {visibleRange < 60 * 60 * 1000
              ? `${Math.round(visibleRange / (60 * 1000))}m`
              : `${Math.round(visibleRange / (60 * 60 * 1000))}h`}
          </span>
        </div>
      </div>

      {/* Alert Type Rows */}
      <div className="space-y-1.5">
        {alertsByType.map((group) => {
          const colors = {
            text: ALERT_TEXT_CLASSES[group.alertType] || 'text-gray-400',
            dot: resolveAlertColor(alertColors, group.alertType, '#6b7280'),
          }
          
          return (
            <div
              key={group.alertType}
              className="rounded-lg border border-gray-700 bg-gray-900/20 hover:bg-gray-900/40 transition-all"
              style={{ overflow: 'visible' }}
            >
              {/* Alert Type Header */}
              <div className="px-2 py-1.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${colors.text}`}>
                      {getAlertTypeName(group.alertType)}
                    </span>
                    <span className="text-xs text-gray-500">
                      [{group.count} alerts]
                    </span>
                  </div>
                </div>

                {/* Timeline Bar */}
                <div className="relative h-10 bg-gray-900/30 rounded" style={{ overflow: 'visible' }}>
                  {/* Alert Dots */}
                  {group.alerts.map((entry, index) => {
                    const xPos = ((entry.timestamp - timeRange.min) / chartWidth) * 100
                    const isNearLeft = xPos < 30
                    const isNearRight = xPos > 70

                    return (
                      <div
                        key={`${entry.id}-${index}`}
                        className="absolute group z-10"
                        style={{
                          left: `${xPos}%`,
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        {/* Dot */}
                        <div
                          className="w-3 h-3 rounded-full transition-all hover:scale-150 hover:ring-2 hover:ring-white/50 cursor-pointer shadow-lg relative z-10"
                          style={{
                            backgroundColor: colors.dot,
                          }}
                        />
                        
                        {/* Tooltip - positioned dynamically to stay within bounds */}
                        <div 
                          className={`absolute hidden group-hover:block z-50 pointer-events-none top-full mt-2 ${
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
              </div>
            </div>
          )
        })}
      </div>

      {/* Enhanced Time Axis with Tick Marks */}
      <div className="relative h-8 px-6 mt-1">
        <div className="absolute left-6 right-6 top-0">
          {timeLabels.map(({ position, label }, index) => {
            const isFirst = index === 0
            const isLast = index === timeLabels.length - 1
            
            return (
              <div
                key={index}
                className={`absolute ${
                  isFirst ? '' : isLast ? 'transform -translate-x-full' : 'transform -translate-x-1/2'
                }`}
                style={{ left: `${position}%` }}
              >
                {/* Tick mark */}
                <div className="w-px h-2 bg-gray-600 mx-auto" />
                {/* Time label */}
                <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                  {label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-2 text-xs text-gray-500">
        <span>Total alerts: </span>
        <span className="font-medium text-gray-300">{filteredAlerts.length}</span>
      </div>
    </div>
  )
}
