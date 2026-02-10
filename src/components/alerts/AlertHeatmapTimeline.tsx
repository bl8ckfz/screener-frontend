import { useState, useMemo, useRef, useEffect } from 'react'
import type { AlertHistoryEntry } from '@/types/alertHistory'
import type { Alert } from '@/types/alert'
import { debug } from '@/utils/debug'

interface AlertHeatmapTimelineProps {
  symbol: string
  fullSymbol?: string
  alerts?: Alert[] // Real-time WebSocket alerts (no HTTP polling)
}

interface AlertBucket {
  timestamp: number
  count: number
  alerts: AlertHistoryEntry[]
}

interface GroupedAlerts {
  alertType: string
  buckets: AlertBucket[]
  totalCount: number
  latestTimestamp: number
  alertsPerMinute: number
}

// Color scheme matching alert badges
const ALERT_TYPE_COLORS: Record<string, { bg: string; text: string; intensity: string[] }> = {
  futures_big_bull_60: {
    bg: 'bg-green-900/20',
    text: 'text-green-400',
    intensity: ['bg-green-900/10', 'bg-green-800/30', 'bg-green-700/50', 'bg-green-600/70', 'bg-green-500/90'],
  },
  futures_pioneer_bull: {
    bg: 'bg-emerald-900/20',
    text: 'text-emerald-300',
    intensity: ['bg-emerald-900/10', 'bg-emerald-800/30', 'bg-emerald-700/50', 'bg-emerald-600/70', 'bg-emerald-500/90'],
  },
  futures_5_big_bull: {
    bg: 'bg-lime-900/20',
    text: 'text-lime-400',
    intensity: ['bg-lime-900/10', 'bg-lime-800/30', 'bg-lime-700/50', 'bg-lime-600/70', 'bg-lime-500/90'],
  },
  futures_15_big_bull: {
    bg: 'bg-green-900/20',
    text: 'text-green-500',
    intensity: ['bg-green-900/10', 'bg-green-800/30', 'bg-green-700/50', 'bg-green-600/70', 'bg-green-500/90'],
  },
  futures_bottom_hunter: {
    bg: 'bg-purple-900/20',
    text: 'text-purple-400',
    intensity: ['bg-purple-900/10', 'bg-purple-800/30', 'bg-purple-700/50', 'bg-purple-600/70', 'bg-purple-500/90'],
  },
  futures_big_bear_60: {
    bg: 'bg-red-900/20',
    text: 'text-red-400',
    intensity: ['bg-red-900/10', 'bg-red-800/30', 'bg-red-700/50', 'bg-red-600/70', 'bg-red-500/90'],
  },
  futures_pioneer_bear: {
    bg: 'bg-pink-900/20',
    text: 'text-pink-300',
    intensity: ['bg-pink-900/10', 'bg-pink-800/30', 'bg-pink-700/50', 'bg-pink-600/70', 'bg-pink-500/90'],
  },
  futures_5_big_bear: {
    bg: 'bg-orange-900/20',
    text: 'text-orange-400',
    intensity: ['bg-orange-900/10', 'bg-orange-800/30', 'bg-orange-700/50', 'bg-orange-600/70', 'bg-orange-500/90'],
  },
  futures_15_big_bear: {
    bg: 'bg-red-900/20',
    text: 'text-red-500',
    intensity: ['bg-red-900/10', 'bg-red-800/30', 'bg-red-700/50', 'bg-red-600/70', 'bg-red-500/90'],
  },
  futures_top_hunter: {
    bg: 'bg-purple-900/20',
    text: 'text-purple-400',
    intensity: ['bg-purple-900/10', 'bg-purple-800/30', 'bg-purple-700/50', 'bg-purple-600/70', 'bg-purple-500/90'],
  },
}

const getAlertTypeName = (type: string): string => {
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

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  })
}

const formatTimeShort = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
}

/**
 * Get intensity color class based on alert count in bucket
 */
const getIntensityColor = (count: number, alertType: string): string => {
  const colors = ALERT_TYPE_COLORS[alertType]?.intensity || [
    'bg-gray-800/10',
    'bg-gray-700/30',
    'bg-gray-600/50',
    'bg-gray-500/70',
    'bg-gray-400/90',
  ]
  
  // Map count to intensity levels
  if (count === 0) return 'bg-gray-900/5'
  if (count === 1) return colors[0]
  if (count <= 3) return colors[1]
  if (count <= 6) return colors[2]
  if (count <= 10) return colors[3]
  return colors[4]
}

export function AlertHeatmapTimeline({ 
  symbol, 
  fullSymbol,
  alerts = [] // Real-time WebSocket alerts
}: AlertHeatmapTimelineProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())
  const [visibleRange, setVisibleRange] = useState(60 * 60 * 1000) // Start at 1 hour
  const [rangeEnd, setRangeEnd] = useState(() => Date.now())
  const chartRef = useRef<HTMLDivElement>(null)
  
  const querySymbol = fullSymbol || symbol

  // Use real-time WebSocket alerts (NO HTTP POLLING)
  const realtimeEntries = useMemo(() => {
    // Filter alerts for this symbol - support both fullSymbol and normalized symbol matching
    const normalizedSymbol = symbol.replace(/USDT$|FDUSD$|TRY$/, '')
    
    const filtered = alerts
      .filter(alert => {
        // Match against full symbol (e.g., ZAMAUSDT) or normalized (e.g., ZAMA)
        return alert.symbol === querySymbol || 
               alert.symbol === normalizedSymbol ||
               alert.symbol.replace(/USDT$|FDUSD$|TRY$/, '') === normalizedSymbol
      })
      .map(alert => ({
        id: alert.id,
        symbol: alert.symbol,
        alertType: alert.type,
        timestamp: alert.timestamp,
        priceAtTrigger: alert.value,
        changePercent: 0, // Not available from WebSocket
        metadata: {
          value: alert.value,
          threshold: alert.threshold,
        },
      }))
    
    // Debug: Log alert filtering for troubleshooting
    if (filtered.length > 0) {
      debug.log(`🔥 AlertHeatmap: Found ${filtered.length} alerts for ${symbol} (querySymbol: ${querySymbol})`)
      debug.log(`   Total alerts passed: ${alerts.length}`)
      debug.log(`   Sample alert symbols:`, alerts.slice(0, 5).map(a => a.symbol))
    }
    
    return filtered
  }, [alerts, querySymbol, symbol])

  // Filter alerts for this symbol in the time range
  const filteredAlerts = useMemo(() => {
    const cutoff = rangeEnd - visibleRange
    const filtered = realtimeEntries.filter(
      (entry) => entry.timestamp >= cutoff && entry.timestamp <= rangeEnd
    ).sort((a, b) => b.timestamp - a.timestamp) // Sort by time descending (newest first)
    
    // Debug: Log time filtering
    debug.log(`🕒 AlertHeatmap: Showing ${filtered.length}/${realtimeEntries.length} alerts within ${Math.round(visibleRange / (60 * 60 * 1000))}h range`)
    if (realtimeEntries.length > filtered.length) {
      const oldestFiltered = filtered.length > 0 ? new Date(filtered[filtered.length - 1].timestamp).toLocaleTimeString() : 'N/A'
      const oldestAvailable = realtimeEntries.length > 0 ? new Date(realtimeEntries[realtimeEntries.length - 1].timestamp).toLocaleTimeString() : 'N/A'
      debug.log(`   Oldest shown: ${oldestFiltered}, Oldest available: ${oldestAvailable}`)
    }
    
    return filtered
  }, [realtimeEntries, visibleRange])

  // Group alerts by type and bucket into adaptive intervals based on zoom level
  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, AlertHistoryEntry[]>()
    
    // Group by alert type
    filteredAlerts.forEach((alert) => {
      const existing = groups.get(alert.alertType) || []
      existing.push(alert)
      groups.set(alert.alertType, existing)
    })

    // Convert to GroupedAlerts with adaptive buckets
    const result: GroupedAlerts[] = []
    const now = rangeEnd
    
    // Adaptive bucket size based on zoom level
    // <2h: 1 minute buckets, 2-8h: 5 minute buckets, >8h: 15 minute buckets
    const bucketSize = visibleRange < 2 * 60 * 60 * 1000 ? 60 * 1000 :
                       visibleRange < 8 * 60 * 60 * 1000 ? 5 * 60 * 1000 :
                       15 * 60 * 1000
    
    const numBuckets = Math.ceil(visibleRange / bucketSize)

    groups.forEach((alerts, alertType) => {
      // Create buckets for the entire time range
      const buckets: AlertBucket[] = []
      
      for (let i = 0; i < numBuckets; i++) {
        const bucketEnd = now - (i * bucketSize)
        const bucketStart = bucketEnd - bucketSize
        const bucketTimestamp = bucketStart
        
        const bucketAlerts = alerts.filter(
          (alert) => alert.timestamp >= bucketStart && alert.timestamp < bucketEnd
        )
        
        buckets.push({
          timestamp: bucketTimestamp,
          count: bucketAlerts.length,
          alerts: bucketAlerts.sort((a, b) => b.timestamp - a.timestamp),
        })
      }
      
      // Reverse buckets to show oldest first (left to right)
      buckets.reverse()
      
      const totalCount = alerts.length
      const latestTimestamp = alerts[0]?.timestamp || 0
      const timeRangeMinutes = visibleRange / (60 * 1000)
      const alertsPerMinute = totalCount / timeRangeMinutes

      result.push({
        alertType,
        buckets,
        totalCount,
        latestTimestamp,
        alertsPerMinute,
      })
    })

    // Sort by total count descending
    return result.sort((a, b) => b.totalCount - a.totalCount)
  }, [filteredAlerts, visibleRange])

  // TradingView-style wheel zoom handler
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      const delta = -e.deltaY
      const zoomFactor = delta > 0 ? 0.85 : 1.15 // Scroll up = zoom in

      const rect = chartElement?.getBoundingClientRect()
      const position = rect ? (e.clientX - rect.left) / rect.width : 0.5
      const anchorRatio = Math.min(Math.max(position, 0), 1)
      
      setVisibleRange(prev => {
        const newRange = Math.max(60 * 60 * 1000, Math.min(prev * zoomFactor, 48 * 60 * 60 * 1000))
        const anchorTime = rangeEnd - prev + (anchorRatio * prev)
        let newStart = anchorTime - (anchorRatio * newRange)
        let newEnd = newStart + newRange

        // Prevent zooming into the future; clamp end to now and shift start
        const now = Date.now()
        if (newEnd > now) {
          newEnd = now
          newStart = newEnd - newRange
        }

        setRangeEnd(newEnd)
        return newRange
      })
    }

    const chartElement = chartRef.current
    if (chartElement) {
      chartElement.addEventListener('wheel', handleWheel, { passive: false, capture: true })
      return () => {
        chartElement.removeEventListener('wheel', handleWheel, { capture: true })
      }
    }
  }, [filteredAlerts.length, rangeEnd])

  // Reset zoom when symbol changes
  useEffect(() => {
    setVisibleRange(60 * 60 * 1000) // Reset to 1 hour
    setRangeEnd(Date.now())
  }, [symbol])

  // Generate dynamic time labels based on zoom level
  const timeLabels = useMemo(() => {
    const min = rangeEnd - visibleRange
    const max = rangeEnd
    
    // Adjust label count based on zoom level
    const labelCount = visibleRange < 5 * 60 * 1000 ? 12 : // <5min: 12 labels
                       visibleRange < 60 * 60 * 1000 ? 8 :  // <1h: 8 labels
                       visibleRange < 6 * 60 * 60 * 1000 ? 6 : // <6h: 6 labels
                       4 // else: 4 labels
    
    return Array.from({ length: labelCount }, (_, i) => {
      const timestamp = min + (i / (labelCount - 1)) * (max - min)
      return { 
        position: (i / (labelCount - 1)) * 100, 
        label: formatTimeShort(timestamp) 
      }
    })
  }, [visibleRange])

  const toggleExpand = (alertType: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(alertType)) {
        next.delete(alertType)
      } else {
        next.add(alertType)
      }
      return next
    })
  }

  return (
    <div className="w-full space-y-2" ref={chartRef}>
      {/* Header - Always visible */}
      <div className="flex items-center justify-between px-1 md:px-2">
        <h4 className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Alert Intensity Heatmap
        </h4>
        {/* Zoom Controls */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button
            onClick={() => {
              setVisibleRange(48 * 60 * 60 * 1000)
              setRangeEnd(Date.now())
            }}
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
            onClick={() => {
              setVisibleRange(24 * 60 * 60 * 1000)
              setRangeEnd(Date.now())
            }}
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
            onClick={() => {
              setVisibleRange(60 * 60 * 1000)
              setRangeEnd(Date.now())
            }}
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

      {/* Empty State or Grouped Alerts */}
      {filteredAlerts.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <p className="text-sm font-medium">No alerts in the selected time range</p>
            <p className="text-xs text-gray-600 mt-1">
              Use 24H or 48H buttons to view older alerts
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
        {groupedAlerts.map((group) => {
          const isExpanded = expandedTypes.has(group.alertType)
          const colors = ALERT_TYPE_COLORS[group.alertType] || {
            bg: 'bg-gray-900/20',
            text: 'text-gray-400',
            intensity: [],
          }

          return (
            <div
              key={group.alertType}
              className={`rounded-lg border border-gray-700 overflow-hidden transition-all ${
                isExpanded ? 'bg-gray-900/50' : 'bg-gray-900/20 hover:bg-gray-900/40'
              }`}
            >
              {/* Collapsed View - Heatmap Bar */}
              <button
                onClick={() => toggleExpand(group.alertType)}
                className="w-full px-3 py-2 text-left transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${colors.text}`}>
                      {getAlertTypeName(group.alertType)}
                    </span>
                    <span className="text-xs text-gray-500">
                      [{group.totalCount} alerts]
                    </span>
                    <span className="text-xs text-gray-600">
                      {group.alertsPerMinute.toFixed(1)}/min
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Last: {formatTimeShort(group.latestTimestamp)}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Heatmap Bar */}
                <div className="flex gap-0.5 h-6 rounded overflow-hidden">
                  {group.buckets.map((bucket, index) => {
                    // Only show numbers if buckets are wide enough (< 100 buckets = wide enough)
                    const showNumbers = group.buckets.length < 100
                    
                    return (
                      <div
                        key={index}
                        className={`flex-1 transition-all hover:ring-1 hover:ring-white/30 ${getIntensityColor(
                          bucket.count,
                          group.alertType
                        )}`}
                        title={`${formatTimeShort(bucket.timestamp)}: ${bucket.count} alert${
                          bucket.count !== 1 ? 's' : ''
                        }`}
                      >
                        {bucket.count > 0 && showNumbers && (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/80">
                            {bucket.count}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </button>

              {/* Expanded View - Individual Alerts */}
              {isExpanded && (
                <div className="border-t border-gray-700 bg-gray-950/50">
                  <div className="px-3 py-2">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">
                      Individual Alerts ({group.totalCount})
                    </h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {group.buckets.flatMap((bucket) => bucket.alerts).map((alert, index) => (
                        <div
                          key={alert.id || index}
                          className="flex items-center justify-between px-2 py-1.5 bg-gray-900/50 rounded text-xs hover:bg-gray-900/70 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-gray-500 w-16">
                              {formatTime(alert.timestamp)}
                            </span>
                            <span className="font-mono text-gray-300">
                              ${alert.priceAtTrigger.toFixed(2)}
                            </span>
                            <span
                              className={`font-mono ${
                                alert.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}
                            >
                              {alert.changePercent >= 0 ? '+' : ''}
                              {alert.changePercent.toFixed(2)}%
                            </span>
                          </div>
                          <span className="text-gray-600 text-[10px]">
                            {index === 0 ? 'Latest' : `${index + 1}/${group.totalCount}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Export/Actions */}
                  <div className="border-t border-gray-800 px-3 py-2 flex items-center justify-between bg-gray-950/30">
                    <div className="text-xs text-gray-500">
                      Rate: <span className="font-mono text-gray-400">{group.alertsPerMinute.toFixed(2)}</span> alerts/min
                      {group.alertsPerMinute > 10 && (
                        <span className="ml-2 text-yellow-500 font-semibold">⚠️ High frequency</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      {/* Enhanced Time Axis with Tick Marks - Always visible */}
      <div className="relative w-full h-8 mt-2 border-t border-gray-700 px-4">
        <div className="absolute left-4 right-4 top-0">
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

      {/* Summary Stats - Always visible */}
      <div className="mt-8 px-2 text-xs text-gray-500">
        <span>Total alerts: </span>
        <span className="font-medium text-gray-300">{filteredAlerts.length}</span>
      </div>
    </div>
  )
}
