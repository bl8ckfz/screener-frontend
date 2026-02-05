import { useMemo, useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '@/hooks/useStore'
import { alertHistoryService } from '@/services/alertHistoryService'
import { alertHistory } from '@/services/alertHistory'
import { USE_BACKEND_API } from '@/services/backendApi'
import type { AlertHistoryEntry } from '@/types/alertHistory'
import type { AlertHistoryItem, CombinedAlertType } from '@/types/alert'

interface AlertTimelineChartProps {
  symbol: string
  fullSymbol?: string
  height?: number
}

// Color scheme matching Heatmap
const ALERT_TYPE_COLORS: Record<string, { text: string; dot: string }> = {
  // Bullish
  futures_big_bull_60: { text: 'text-green-400', dot: '#14532d' },
  futures_pioneer_bull: { text: 'text-emerald-300', dot: '#a7f3d0' },
  futures_5_big_bull: { text: 'text-lime-400', dot: '#84cc16' },
  futures_15_big_bull: { text: 'text-green-500', dot: '#16a34a' },
  futures_bottom_hunter: { text: 'text-purple-400', dot: '#a855f7' },
  
  // Bearish
  futures_big_bear_60: { text: 'text-red-400', dot: '#7f1d1d' },
  futures_pioneer_bear: { text: 'text-pink-300', dot: '#fce7f3' },
  futures_5_big_bear: { text: 'text-orange-400', dot: '#f87171' },
  futures_15_big_bear: { text: 'text-red-500', dot: '#dc2626' },
  futures_top_hunter: { text: 'text-purple-400', dot: '#a855f7' },
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

function normalizeSymbol(symbol: string): string {
  if (symbol.endsWith('USDT')) return symbol.replace('USDT', '')
  if (symbol.endsWith('FDUSD')) return symbol.replace('FDUSD', '')
  if (symbol.endsWith('TRY')) return symbol.replace('TRY', '')
  return symbol
}

function toAlertHistoryEntry(alert: AlertHistoryItem): AlertHistoryEntry {
  const normalizedSymbol = normalizeSymbol(alert.symbol)
  return {
    id: alert.id || `${alert.timestamp}-${normalizedSymbol}-${alert.type}`,
    symbol: normalizedSymbol,
    alertType: alert.type as CombinedAlertType,
    timestamp: alert.timestamp,
    priceAtTrigger: alert.value ?? 0,
    changePercent: 0,
    metadata: {
      value: alert.value,
      threshold: alert.threshold,
    },
  }
}

export function AlertTimelineChart({ symbol, fullSymbol, height: _unusedHeight }: AlertTimelineChartProps) {
  // Watch for alert history changes
  const alertHistoryRefresh = useStore((state) => state.alertHistoryRefresh)
  
  // Visible time range (in milliseconds from now)
  const [visibleRange, setVisibleRange] = useState(60 * 60 * 1000) // Start at 1 hour (max zoom)
  const chartRef = useRef<HTMLDivElement>(null)

  const querySymbol = fullSymbol || symbol

  const backendAlertsQuery = useQuery({
    queryKey: ['backendAlerts', querySymbol],
    queryFn: () => alertHistory.getAllBySymbol(querySymbol),
    enabled: USE_BACKEND_API && !!querySymbol,
    staleTime: 30000,
    refetchInterval: 30000,
    retry: 2,
  })

  const backendEntries = useMemo(() => {
    if (!USE_BACKEND_API) return []
    const alerts = backendAlertsQuery.data || []
    return alerts.map((alert) => toAlertHistoryEntry(alert))
  }, [backendAlertsQuery.data])

  const localEntries = useMemo(() => {
    if (USE_BACKEND_API) return []
    return alertHistoryService.getHistory()
  }, [alertHistoryRefresh])

  // Filter alerts for this symbol in last 24 hours
  const filteredAlerts = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const allAlerts = USE_BACKEND_API ? backendEntries : localEntries
    return allAlerts.filter(
      (entry) => entry.symbol === symbol && entry.timestamp >= oneDayAgo
    ).sort((a, b) => a.timestamp - b.timestamp) // Sort by time ascending
  }, [symbol, backendEntries, localEntries])

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
  const timeRange = useMemo(() => {
    const now = Date.now()
    const min = now - visibleRange
    const max = now
    return { min, max }
  }, [visibleRange])

  // TradingView-style wheel zoom handler
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      const delta = -e.deltaY
      const zoomFactor = delta > 0 ? 0.85 : 1.15 // Scroll up = zoom in (decrease range)
      
      setVisibleRange(prev => {
        const newRange = prev * zoomFactor
        // Constrain between 1 hour and 24 hours
        return Math.max(60 * 60 * 1000, Math.min(newRange, 24 * 60 * 60 * 1000))
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

  const handleResetZoom = () => {
    setVisibleRange(24 * 60 * 60 * 1000)
  }

  // Generate dynamic time labels based on zoom level (matching Heatmap)
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
        label: formatTime(timestamp) 
      }
    })
  }, [visibleRange])

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
            onClick={handleResetZoom}
            className="px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="Reset to 24h"
          >
            24h
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
          const colors = ALERT_TYPE_COLORS[group.alertType] || { text: 'text-gray-400', dot: '#6b7280' }
          
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
