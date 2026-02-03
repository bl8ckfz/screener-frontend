import { useState, useMemo } from 'react'
import type { AlertHistoryEntry } from '@/types/alertHistory'
import type { Alert } from '@/types/alert'

interface AlertHeatmapTimelineProps {
  symbol: string
  fullSymbol?: string
  alerts?: Alert[] // Real-time WebSocket alerts (no HTTP polling)
  timeRange?: number // in milliseconds, default 60 minutes
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
  alerts = [], // Real-time WebSocket alerts
  timeRange = 60 * 60 * 1000 // Default 1 hour
}: AlertHeatmapTimelineProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())
  
  const querySymbol = fullSymbol || symbol

  // Use real-time WebSocket alerts (NO HTTP POLLING)
  const realtimeEntries = useMemo(() => {
    // Filter alerts for this symbol and convert to AlertHistoryEntry format
    return alerts
      .filter(alert => alert.symbol === querySymbol)
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
  }, [alerts, querySymbol])

  // Filter alerts for this symbol in the time range
  const filteredAlerts = useMemo(() => {
    const cutoff = Date.now() - timeRange
    return realtimeEntries.filter(
      (entry) => entry.timestamp >= cutoff
    ).sort((a, b) => b.timestamp - a.timestamp) // Sort by time descending (newest first)
  }, [realtimeEntries, timeRange])

  // Group alerts by type and bucket into 1-minute intervals
  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, AlertHistoryEntry[]>()
    
    // Group by alert type
    filteredAlerts.forEach((alert) => {
      const existing = groups.get(alert.alertType) || []
      existing.push(alert)
      groups.set(alert.alertType, existing)
    })

    // Convert to GroupedAlerts with buckets
    const result: GroupedAlerts[] = []
    const now = Date.now()
    const bucketSize = 60 * 1000 // 1 minute
    const numBuckets = Math.ceil(timeRange / bucketSize)

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
      const timeRangeMinutes = timeRange / (60 * 1000)
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
  }, [filteredAlerts, timeRange])

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

  if (filteredAlerts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="text-center">
          <p className="text-sm font-medium">No alerts in the selected time range</p>
          <p className="text-xs text-gray-600 mt-1">
            Alerts for {symbol} will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300">Alert Intensity Heatmap</h3>
        <div className="text-xs text-gray-500">
          {timeRange / (60 * 1000)}m view • {filteredAlerts.length} total alerts
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-2 py-2 bg-gray-900/30 rounded text-xs">
        <span className="text-gray-400 font-medium">Intensity:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-900/5 border border-gray-700 rounded"></div>
          <span className="text-gray-500">0</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-700/30 border border-gray-600 rounded"></div>
          <span className="text-gray-500">1-3</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-600/50 border border-gray-500 rounded"></div>
          <span className="text-gray-500">4-6</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-500/70 border border-gray-400 rounded"></div>
          <span className="text-gray-500">7-10</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-400/90 border border-gray-300 rounded"></div>
          <span className="text-gray-500">11+</span>
        </div>
      </div>

      {/* Grouped Alerts */}
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
                  {group.buckets.map((bucket, index) => (
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
                      {bucket.count > 0 && (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/80">
                          {bucket.count}
                        </div>
                      )}
                    </div>
                  ))}
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
    </div>
  )
}
