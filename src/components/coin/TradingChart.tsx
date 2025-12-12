import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { Candlestick } from '@/services/chartData'
import type { AlertHistoryEntry } from '@/types/alertHistory'
import type { Bubble } from '@/types/bubble'
import { calculateWeeklyVWAP } from '@/utils/indicators'

export type ChartType = 'candlestick' | 'line' | 'area'

export interface TradingChartProps {
  data: Candlestick[]
  symbol: string
  type?: ChartType
  height?: number
  showVolume?: boolean
  showWeeklyVWAP?: boolean
  showAlerts?: boolean
  alerts?: AlertHistoryEntry[]
  showBubbles?: boolean
  bubbles?: Bubble[]
  className?: string
}

/**
 * Determine alert marker size based on alert type priority
 */
const getAlertMarkerSize = (alertType: string): 0 | 1 | 2 => {
  // High priority alerts - large markers
  if (alertType.includes('60') || alertType.includes('pioneer')) {
    return 2
  }
  // Medium/low priority alerts - normal size (was 0, now 1 for visibility)
  return 1
}

/**
 * Get alert marker color and position based on alert type
 */
const getAlertMarkerStyle = (alertType: string): { color: string; position: 'aboveBar' | 'belowBar'; shape: 'circle' | 'arrowUp' | 'arrowDown' } => {
  // Bullish alerts - green, below bar, arrow up
  if (alertType.includes('bull') || alertType.includes('bottom_hunter')) {
    return {
      color: '#22c55e', // green-500
      position: 'belowBar' as const,
      shape: 'arrowUp' as const,
    }
  }
  // Bearish alerts - red, above bar, arrow down
  return {
    color: '#ef4444', // red-500
    position: 'aboveBar' as const,
    shape: 'arrowDown' as const,
  }
}

/**
 * Get display name for alert type
 */
const getAlertDisplayName = (alertType: string): string => {
  const cleanType = alertType.replace(/^futures_/, '')
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

/**
 * Get bubble marker size based on bubble size classification
 */
const getBubbleMarkerSize = (size: 'small' | 'medium' | 'large'): 0 | 1 | 2 => {
  switch (size) {
    case 'large': return 2
    case 'medium': return 1
    case 'small': return 0
  }
}

/**
 * Get bubble marker color and style based on side and timeframe
 */
const getBubbleMarkerStyle = (bubble: Bubble): { 
  color: string
  position: 'aboveBar' | 'belowBar'
  shape: 'circle' | 'arrowUp' | 'arrowDown'
} => {
  // Buy pressure - green, below bar
  // Sell pressure - red, above bar
  // Differentiate 5m vs 15m with solid vs outlined (via color opacity)
  
  if (bubble.side === 'buy') {
    return {
      color: bubble.timeframe === '5m' ? '#10b981' : '#34d399', // green-500 vs green-400
      position: 'belowBar' as const,
      shape: 'circle' as const,
    }
  } else {
    return {
      color: bubble.timeframe === '5m' ? '#ef4444' : '#f87171', // red-500 vs red-400
      position: 'aboveBar' as const,
      shape: 'circle' as const,
    }
  }
}

/**
 * Get display text for bubble marker
 */
const getBubbleDisplayText = (bubble: Bubble): string => {
  const sizeSymbol = bubble.size === 'large' ? 'L' : bubble.size === 'medium' ? 'M' : 'S'
  const timeframe = bubble.timeframe
  const zScore = bubble.zScore.toFixed(1)
  return `${sizeSymbol}${timeframe} (z=${zScore})`
}


/**
 * TradingChart component using lightweight-charts library
 * 
 * Displays candlestick, line, or area charts with volume overlay and alert markers
 */
export function TradingChart({
  data,
  symbol,
  type = 'candlestick',
  height = 400,
  showVolume = true,
  showWeeklyVWAP = false,
  showAlerts = false,
  alerts = [],
  showBubbles = false,
  bubbles = [],
  className = '',
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const weeklyVWAPRef = useRef<ISeriesApi<'Line'> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const chartInitializedRef = useRef(false)

  // Create chart instance once on mount
  useEffect(() => {
    if (!chartContainerRef.current || chartInitializedRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' }, // surface-dark
        textColor: '#cbd5e1', // text-secondary
      },
      grid: {
        vertLines: { color: '#1e293b', style: LineStyle.Solid }, // surface
        horzLines: { color: '#1e293b', style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#475569', // surface-lighter
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2B95FF', // accent
        },
        horzLine: {
          color: '#475569',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2B95FF',
        },
      },
      rightPriceScale: {
        borderColor: '#334155', // border
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    })

    chartRef.current = chart
    chartInitializedRef.current = true

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        chartInitializedRef.current = false
      }
    }
  }, [height, showVolume])

  // Update data and series when data/settings change
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return

    setIsLoading(true)

    const chart = chartRef.current

    // Remove existing series (with null checks to prevent errors)
    try {
      if (mainSeriesRef.current) {
        chart.removeSeries(mainSeriesRef.current)
        mainSeriesRef.current = null
      }
    } catch (e) {
      // Series may already be removed, ignore
      mainSeriesRef.current = null
    }
    
    try {
      if (volumeSeriesRef.current) {
        chart.removeSeries(volumeSeriesRef.current)
        volumeSeriesRef.current = null
      }
    } catch (e) {
      volumeSeriesRef.current = null
    }
    
    try {
      if (weeklyVWAPRef.current) {
        chart.removeSeries(weeklyVWAPRef.current)
        weeklyVWAPRef.current = null
      }
    } catch (e) {
      weeklyVWAPRef.current = null
    }

    // Calculate appropriate price precision based on price range
    const prices = data.map(candle => candle.close)
    const maxPrice = Math.max(...prices)
    const minPrice = Math.min(...prices)
    const avgPrice = (maxPrice + minPrice) / 2
    
    // Determine precision: show at least 4 significant digits
    let precision = 2 // Default for prices >= 100
    if (avgPrice < 0.001) {
      precision = 8 // Very small values (< $0.001)
    } else if (avgPrice < 0.01) {
      precision = 6 // Small values (< $0.01)
    } else if (avgPrice < 1) {
      precision = 4 // Medium values (< $1)
    } else if (avgPrice < 100) {
      precision = 3 // Standard values (< $100)
    }

    // Create main series based on chart type
    let mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area'>

    if (type === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: '#10b981', // bullish
        downColor: '#ef4444', // bearish
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
        priceFormat: {
          type: 'price',
          precision,
          minMove: 1 / Math.pow(10, precision),
        },
      })

      const candlestickData: CandlestickData[] = data.map((candle) => ({
        time: candle.time as any, // lightweight-charts expects Time type
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))

      mainSeries.setData(candlestickData)
    } else if (type === 'line') {
      mainSeries = chart.addLineSeries({
        color: '#2B95FF', // accent
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        lastValueVisible: true,
        priceLineVisible: true,
        priceFormat: {
          type: 'price',
          precision,
          minMove: 1 / Math.pow(10, precision),
        },
      })

      const lineData = data.map((candle) => ({
        time: candle.time as any, // lightweight-charts expects Time type
        value: candle.close,
      }))

      mainSeries.setData(lineData)
    } else {
      // area
      mainSeries = chart.addAreaSeries({
        topColor: 'rgba(43, 149, 255, 0.4)', // accent with opacity
        bottomColor: 'rgba(43, 149, 255, 0.0)',
        lineColor: '#2B95FF',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        lastValueVisible: true,
        priceLineVisible: true,
        priceFormat: {
          type: 'price',
          precision,
          minMove: 1 / Math.pow(10, precision),
        },
      })

      const areaData = data.map((candle) => ({
        time: candle.time as any, // lightweight-charts expects Time type
        value: candle.close,
      }))

      mainSeries.setData(areaData)
    }

    mainSeriesRef.current = mainSeries

    // Add volume series if enabled
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: '#475569', // surface-lighter
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '', // Create separate price scale
      })

      // Color volume bars based on price movement
      const volumeData: HistogramData[] = data.map((candle, index) => {
        const prevClose = index > 0 ? data[index - 1].close : candle.open
        const isUp = candle.close >= prevClose

        return {
          time: candle.time as any, // lightweight-charts expects Time type
          value: candle.volume,
          color: isUp
            ? 'rgba(16, 185, 129, 0.3)' // bullish-bg
            : 'rgba(239, 68, 68, 0.3)', // bearish-bg
        }
      })

      volumeSeries.setData(volumeData)
      volumeSeriesRef.current = volumeSeries

      // Position volume series at bottom
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      })
    }

    // Add weekly VWAP series if enabled
    if (showWeeklyVWAP && data.length > 0) {
      const weeklyVWAPSeries = chart.addLineSeries({
        color: '#f59e0b', // Amber-500 for weekly VWAP
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      })

      const weeklyVWAPData = calculateWeeklyVWAP(data)
      weeklyVWAPSeries.setData(
        weeklyVWAPData.map((d) => ({
          time: d.time as any,
          value: d.vwap,
        }))
      )

      weeklyVWAPRef.current = weeklyVWAPSeries
    }

    // Add alert markers if enabled
    if (showAlerts && alerts.length > 0 && mainSeries) {
      console.log(`🎯 Processing ${alerts.length} alerts for markers`)
      console.log('Alert types:', alerts.map(a => a.alertType))
      
      const markers: SeriesMarker<Time>[] = alerts
        .map(alert => {
          // Convert alert timestamp (ms) to candle time (seconds)
          const alertTime = Math.floor(alert.timestamp / 1000)
          
          // Find closest candle within reasonable range (5 minutes = 300 seconds)
          const closestCandle = data.reduce((closest, candle) => {
            const candleTime = typeof candle.time === 'number' ? candle.time : Number(candle.time)
            const currentDiff = Math.abs(candleTime - alertTime)
            const closestDiff = closest ? Math.abs((typeof closest.time === 'number' ? closest.time : Number(closest.time)) - alertTime) : Infinity
            return currentDiff < closestDiff ? candle : closest
          }, null as typeof data[0] | null)
          
          if (!closestCandle) {
            console.warn(`⚠️  No candle found for alert at ${new Date(alert.timestamp).toISOString()}`)
            return null
          }
          
          const candleTime = typeof closestCandle.time === 'number' ? closestCandle.time : Number(closestCandle.time)
          const timeDiff = Math.abs(candleTime - alertTime)
          
          // Skip if alert is more than 5 minutes away from any candle
          if (timeDiff > 300) {
            console.warn(`⚠️  Alert too far from candles (${Math.floor(timeDiff / 60)}m away)`)
            return null
          }
          
          const style = getAlertMarkerStyle(alert.alertType)
          const size = getAlertMarkerSize(alert.alertType)
          const displayName = getAlertDisplayName(alert.alertType)
          
          console.log(`✅ Creating marker for ${alert.alertType} (${displayName}) - size: ${size}, color: ${style.color}, shape: ${style.shape}`)
          
          return {
            time: closestCandle.time,
            position: style.position,
            color: style.color,
            shape: style.shape,
            size,
          } as SeriesMarker<Time>
        })
        .filter((marker): marker is SeriesMarker<Time> => marker !== null)

      console.log(`📍 Setting ${markers.length} alert markers on chart`)
      
      if (markers.length > 0) {
        mainSeries.setMarkers(markers)
      } else {
        console.warn('⚠️  No valid alert markers to display')
      }
    }

    // Add bubble markers if enabled (combined with alert markers)
    if (showBubbles && bubbles.length > 0 && mainSeries) {
      console.log(`🫧 Processing ${bubbles.length} bubbles for markers`)
      
      const bubbleMarkers: SeriesMarker<Time>[] = bubbles
        .map(bubble => {
          // Convert bubble timestamp (ms) to candle time (seconds)
          const bubbleTime = Math.floor(bubble.time / 1000)
          
          // Find closest candle within reasonable range (5 minutes = 300 seconds)
          const closestCandle = data.reduce((closest, candle) => {
            const candleTime = typeof candle.time === 'number' ? candle.time : Number(candle.time)
            const currentDiff = Math.abs(candleTime - bubbleTime)
            const closestDiff = Math.abs(
              (typeof closest.time === 'number' ? closest.time : Number(closest.time)) - bubbleTime
            )
            return currentDiff < closestDiff ? candle : closest
          }, data[0])
          
          if (!closestCandle) {
            console.warn(`⚠️  No candle found for bubble at ${new Date(bubble.time).toLocaleTimeString()}`)
            return null
          }
          
          const candleTime = typeof closestCandle.time === 'number' ? closestCandle.time : Number(closestCandle.time)
          const timeDiff = Math.abs(candleTime - bubbleTime)
          
          // Skip if bubble is too far from any candle (>5 minutes)
          if (timeDiff > 300) {
            console.warn(`⚠️  Bubble too far from candles (${Math.floor(timeDiff / 60)}m away)`)
            return null
          }
          
          const style = getBubbleMarkerStyle(bubble)
          const size = getBubbleMarkerSize(bubble.size)
          const displayText = getBubbleDisplayText(bubble)
          
          console.log(`🫧 Creating bubble marker: ${displayText} - size: ${size}, color: ${style.color}`)
          
          return {
            time: closestCandle.time,
            position: style.position,
            color: style.color,
            shape: style.shape,
            size,
            text: displayText,
          } as SeriesMarker<Time>
        })
        .filter((marker): marker is SeriesMarker<Time> => marker !== null)

      console.log(`🫧 Setting ${bubbleMarkers.length} bubble markers on chart`)
      
      // Combine alert and bubble markers
      if (showAlerts && alerts.length > 0) {
        // Get existing alert markers
        const alertMarkers: SeriesMarker<Time>[] = alerts
          .map(alert => {
            const alertTime = Math.floor(alert.timestamp / 1000)
            const closestCandle = data.reduce((closest, candle) => {
              const candleTime = typeof candle.time === 'number' ? candle.time : Number(candle.time)
              const currentDiff = Math.abs(candleTime - alertTime)
              const closestDiff = Math.abs(
                (typeof closest.time === 'number' ? closest.time : Number(closest.time)) - alertTime
              )
              return currentDiff < closestDiff ? candle : closest
            }, data[0])
            
            if (!closestCandle) return null
            
            const candleTime = typeof closestCandle.time === 'number' ? closestCandle.time : Number(closestCandle.time)
            const timeDiff = Math.abs(candleTime - alertTime)
            
            if (timeDiff > 300) return null
            
            const style = getAlertMarkerStyle(alert.alertType)
            const size = getAlertMarkerSize(alert.alertType)
            
            return {
              time: closestCandle.time,
              position: style.position,
              color: style.color,
              shape: style.shape,
              size,
            } as SeriesMarker<Time>
          })
          .filter((marker): marker is SeriesMarker<Time> => marker !== null)
        
        // Combine both types of markers
        const combinedMarkers = [...alertMarkers, ...bubbleMarkers]
        mainSeries.setMarkers(combinedMarkers)
        console.log(`📍 Set ${combinedMarkers.length} total markers (${alertMarkers.length} alerts + ${bubbleMarkers.length} bubbles)`)
      } else if (bubbleMarkers.length > 0) {
        mainSeries.setMarkers(bubbleMarkers)
      }
    }

    // Only fit content on first load, otherwise zoom is preserved automatically
    if (!mainSeriesRef.current) {
      chart.timeScale().fitContent()
    }

    setIsLoading(false)
  }, [data, type, showVolume, showWeeklyVWAP, showAlerts, alerts, showBubbles, bubbles, symbol])

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-dark/80 z-10 rounded-lg">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-2"></div>
            <div className="text-sm text-text-secondary">Loading chart...</div>
          </div>
        </div>
      )}
      
      <div
        ref={chartContainerRef}
        className="rounded-lg overflow-hidden"
        style={{ height: `${height}px` }}
      />
      
      {data.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-text-tertiary">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-sm">No chart data available</div>
          </div>
        </div>
      )}
      
      {/* Chart Info */}
      <div className="mt-2 text-xs text-text-tertiary">
        {symbol} • {data.length} candles
      </div>
    </div>
  )
}
