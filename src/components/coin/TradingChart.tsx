import { useEffect, useRef, useState, useMemo } from 'react'
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
import { calculateWeeklyVWAP, type IchimokuData } from '@/utils/indicators'
import { debug } from '@/utils/debug'

// Format epoch seconds to local time string for axis/crosshair consistency with timeline
const formatLocalTimeLabel = (time: Time): string => {
  if (typeof time !== 'number') return ''
  return new Date(time * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export interface TradingChartProps {
  data: Candlestick[]
  symbol: string
  height?: number
  showVolume?: boolean
  showWeeklyVWAP?: boolean
  vwapData?: Candlestick[] // Separate VWAP data (15m interval for efficiency)
  showIchimoku?: boolean
  ichimokuData?: IchimokuData[]
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
  const cleanType = alertType.replace(/^futures_/, '')

  // High priority alerts - large markers
  if (cleanType.includes('60') || cleanType.includes('pioneer')) {
    return 2
  }

  // 15m big bull/bear → small diamond for visibility
  if (cleanType === '15_big_bull' || cleanType === '15_big_bear') {
    return 1
  }

  // Medium/low priority alerts - normal size
  return 1
}

// Match alert marker colors with alert timeline legend
const ALERT_MARKER_COLORS: Record<string, string> = {
  // Bullish
  futures_big_bull_60: '#22c55e',
  futures_pioneer_bull: '#10b981',
  futures_5_big_bull: '#84cc16',
  futures_15_big_bull: '#4ade80',
  futures_bottom_hunter: '#34d399',
  // Bearish
  futures_big_bear_60: '#ef4444',
  futures_pioneer_bear: '#dc2626',
  futures_5_big_bear: '#f87171',
  futures_15_big_bear: '#fb923c',
  futures_top_hunter: '#f97316',
}

/**
 * Get alert marker color and position based on alert type
 */
const getAlertMarkerStyle = (alertType: string): { color: string; position: 'aboveBar' | 'belowBar'; shape: 'circle' | 'arrowUp' | 'arrowDown' | 'diamond' } => {
  const cleanType = alertType.replace(/^futures_/, '')
  const normalizedKey = alertType.startsWith('futures_') ? alertType : `futures_${alertType}`
  const isBullish = cleanType.includes('bull') || cleanType === 'bottom_hunter'
  const isHunter = cleanType === 'bottom_hunter' || cleanType === 'top_hunter'
  const isFifteen = cleanType === '15_big_bull' || cleanType === '15_big_bear'

  // Hunters use a distinct purple circle; others keep mapped/bull-bear colors
  const color = isHunter
    ? '#a855f7'
    : ALERT_MARKER_COLORS[normalizedKey]
      || (isBullish ? '#22c55e' : '#ef4444')

  return {
    color,
    position: isBullish ? 'belowBar' : 'aboveBar',
    // Bottom/Top hunters should be circles to match timeline dots
    // 15m big bull/bear use the smallest diamond shape for visual distinction
    shape: isHunter
      ? 'circle'
      : isFifteen
        ? 'diamond'
        : (isBullish ? 'arrowUp' : 'arrowDown'),
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
 * TradingChart component using lightweight-charts library
 * 
 * Displays candlestick, line, or area charts with volume overlay and alert markers
 */
export function TradingChart({
  data,
  symbol,
  height = 400,
  showVolume = true,
  showWeeklyVWAP = false,
  vwapData = [],
  showIchimoku = false,
  ichimokuData = [],
  showAlerts = false,
  alerts = [],
  showBubbles = false,
  bubbles = [],
  className = '',
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const weeklyVWAPRef = useRef<ISeriesApi<'Line'> | null>(null)
  // Ichimoku series refs
  const tenkanRef = useRef<ISeriesApi<'Line'> | null>(null)
  const kijunRef = useRef<ISeriesApi<'Line'> | null>(null)
  const senkouARef = useRef<ISeriesApi<'Line'> | null>(null)
  const senkouBRef = useRef<ISeriesApi<'Line'> | null>(null)
  const chikouRef = useRef<ISeriesApi<'Line'> | null>(null)
  const markersRef = useRef<SeriesMarker<Time>[]>([]) // Store markers to re-apply on zoom
  const [isLoading, setIsLoading] = useState(true)
  const chartInitializedRef = useRef(false)

  // Memoize VWAP calculation to avoid recalculating 672 candles on every render
  const weeklyVWAPData = useMemo(() => {
    if (!showWeeklyVWAP || vwapData.length === 0) return []
    return calculateWeeklyVWAP(vwapData)
  }, [vwapData, showWeeklyVWAP])

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
        tickMarkFormatter: (time: Time) => formatLocalTimeLabel(time),
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
      localization: {
        timeFormatter: formatLocalTimeLabel,
      },
    })

    chartRef.current = chart
    chartInitializedRef.current = true

    // Subscribe to time scale changes to re-apply markers
    const timeScale = chart.timeScale()
    const handleVisibleRangeChange = () => {
      // Re-apply markers when visible range changes (zoom/pan)
      if (mainSeriesRef.current && markersRef.current.length > 0) {
        mainSeriesRef.current.setMarkers(markersRef.current)
      }
    }
    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange)

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
      timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        chartInitializedRef.current = false
      }
    }
  }, [height, showVolume])

  // Update main chart series when data or chart type changes
  // Separated from markers to avoid unnecessary series recreation
  useEffect(() => {
    console.log(`📊 TradingChart effect triggered: ${data.length} candles, last=${data[data.length-1]?.close}`)
    
    if (!chartRef.current || data.length === 0) return

    setIsLoading(true)

    const chart = chartRef.current

    // Remove existing main series
    try {
      if (mainSeriesRef.current) {
        chart.removeSeries(mainSeriesRef.current)
        mainSeriesRef.current = null
      }
    } catch (e) {
      mainSeriesRef.current = null
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

    // Create candlestick series
    const mainSeries = chart.addCandlestickSeries({
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
    mainSeriesRef.current = mainSeries

    setIsLoading(false)
  }, [data]) // Only data triggers main series recreation

  // Update volume series when data or showVolume changes
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current || data.length === 0) return

    const chart = chartRef.current

    // Remove existing volume series
    try {
      if (volumeSeriesRef.current) {
        chart.removeSeries(volumeSeriesRef.current)
        volumeSeriesRef.current = null
      }
    } catch (e) {
      volumeSeriesRef.current = null
    }

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
  }, [data, showVolume]) // Only data and showVolume trigger volume series update

  // Update VWAP series when enabled or data changes
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current) return

    const chart = chartRef.current

    // Remove existing VWAP series
    try {
      if (weeklyVWAPRef.current) {
        chart.removeSeries(weeklyVWAPRef.current)
        weeklyVWAPRef.current = null
      }
    } catch (e) {
      weeklyVWAPRef.current = null
    }

    // Add weekly VWAP series if enabled and vwapData is available
    // Uses separate 15m interval data for consistent VWAP regardless of chart interval
    if (showWeeklyVWAP && weeklyVWAPData.length > 0) {
      const weeklyVWAPSeries = chart.addLineSeries({
        color: '#f59e0b', // Amber-500 for weekly VWAP
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      })

      weeklyVWAPSeries.setData(
        weeklyVWAPData.map((d) => ({
          time: d.time as any,
          value: d.vwap,
        }))
      )

      weeklyVWAPRef.current = weeklyVWAPSeries
    }
  }, [showWeeklyVWAP, weeklyVWAPData]) // Only VWAP toggle and data trigger VWAP update

  // Update Ichimoku series when enabled or data changes
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current) return

    const chart = chartRef.current

    // Remove existing Ichimoku series
    const refs = [tenkanRef, kijunRef, senkouARef, senkouBRef, chikouRef]
    refs.forEach(ref => {
      try {
        if (ref.current) {
          chart.removeSeries(ref.current)
          ref.current = null
        }
      } catch (e) {
        ref.current = null
      }
    })

    // Add Ichimoku series if enabled and data is available
    if (showIchimoku && ichimokuData.length > 0) {
      const displacement = 26 // Standard Ichimoku displacement

      // Calculate time interval between candles (in seconds)
      const timeInterval = ichimokuData.length >= 2 
        ? (ichimokuData[1].time as number) - (ichimokuData[0].time as number)
        : 300 // Default to 5m if can't calculate

      // For Senkou spans: plot them 26 periods ahead
      // We take current values and project them into the future
      const senkouData: Array<{ time: any; spanA: number; spanB: number }> = []
      
      for (let i = 0; i < ichimokuData.length; i++) {
        // Calculate future time by adding displacement * interval
        // If we have future data points, use their times; otherwise extrapolate
        let futureTime: number
        const futureIndex = i + displacement
        
        if (futureIndex < ichimokuData.length) {
          // Use actual future time from data
          futureTime = ichimokuData[futureIndex].time as number
        } else {
          // Extrapolate beyond data range
          const periodsAhead = futureIndex - ichimokuData.length + 1
          const lastTime = ichimokuData[ichimokuData.length - 1].time as number
          futureTime = lastTime + (periodsAhead * timeInterval)
        }
        
        senkouData.push({
          time: futureTime,
          spanA: ichimokuData[i].senkouSpanA,
          spanB: ichimokuData[i].senkouSpanB,
        })
      }

      debug.log(`📊 Ichimoku: ${senkouData.length} cloud points (displaced +${displacement})`)

      // Senkou Span B (cloud bottom line)
      const senkouBSeries = chart.addLineSeries({
        color: '#6b7280', // gray-500
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })

      if (senkouData.length > 0) {
        senkouBSeries.setData(
          senkouData.map((d) => ({
            time: d.time as any,
            value: d.spanB,
          }))
        )
      }
      senkouBRef.current = senkouBSeries

      // Senkou Span A (cloud top line)
      const senkouASeries = chart.addLineSeries({
        color: '#9ca3af', // gray-400
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })

      if (senkouData.length > 0) {
        senkouASeries.setData(
          senkouData.map((d) => ({
            time: d.time as any,
            value: d.spanA,
          }))
        )
      }
      senkouARef.current = senkouASeries

      // Kijun-sen (Base Line) - red
      const kijunSeries = chart.addLineSeries({
        color: '#ef4444', // red-500
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
      })

      kijunSeries.setData(
        ichimokuData.map((d) => ({
          time: d.time as any,
          value: d.kijunSen,
        }))
      )
      kijunRef.current = kijunSeries

      // Tenkan-sen (Conversion Line) - blue
      const tenkanSeries = chart.addLineSeries({
        color: '#3b82f6', // blue-500
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
      })

      tenkanSeries.setData(
        ichimokuData.map((d) => ({
          time: d.time as any,
          value: d.tenkanSen,
        }))
      )
      tenkanRef.current = tenkanSeries

      // Chikou Span (Lagging Span) - purple
      const chikouSeries = chart.addLineSeries({
        color: '#8b5cf6', // purple-500
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
      })

      // Chikou Span is plotted 26 periods back (backward displacement)
      // We take current closing prices and plot them 26 periods in the past
      const chikouData: Array<{ time: any; value: number }> = []
      
      for (let i = displacement; i < ichimokuData.length; i++) {
        const pastIndex = i - displacement
        chikouData.push({
          time: ichimokuData[pastIndex].time,
          value: ichimokuData[i].chikouSpan,
        })
      }

      if (chikouData.length > 0) {
        chikouSeries.setData(chikouData)
      }
      chikouRef.current = chikouSeries

      debug.log(`📊 Ichimoku Cloud rendered: ${senkouData.length} cloud points, ${chikouData.length} chikou points`)
    }
  }, [showIchimoku, ichimokuData]) // Only Ichimoku toggle and data trigger update

  // Helper function to find closest candle to a timestamp
  const findClosestCandle = (targetTime: number, candles: Candlestick[]): Candlestick | null => {
    if (candles.length === 0) return null
    
    return candles.reduce((closest, candle) => {
      const candleTime = typeof candle.time === 'number' ? candle.time : Number(candle.time)
      const currentDiff = Math.abs(candleTime - targetTime)
      const closestDiff = closest 
        ? Math.abs((typeof closest.time === 'number' ? closest.time : Number(closest.time)) - targetTime)
        : Infinity
      return currentDiff < closestDiff ? candle : closest
    }, null as Candlestick | null)
  }

  // Update markers when alerts or bubbles change
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current || data.length === 0) return

    const mainSeries = mainSeriesRef.current

    // Add alert markers if enabled
    if (showAlerts && alerts.length > 0 && mainSeries) {
      debug.log(`🎯 Processing ${alerts.length} alerts for markers`)
      debug.log('Alert types:', alerts.map(a => a.alertType))
      
      const markers: SeriesMarker<Time>[] = alerts
        .map(alert => {
          // Convert alert timestamp (ms) to candle time (seconds)
          const alertTime = Math.floor(alert.timestamp / 1000)
          const closestCandle = findClosestCandle(alertTime, data)
          
          if (!closestCandle) {
            debug.warn(`⚠️  No candle found for alert at ${new Date(alert.timestamp).toISOString()}`)
            return null
          }
          
          const candleTime = typeof closestCandle.time === 'number' ? closestCandle.time : Number(closestCandle.time)
          const timeDiff = Math.abs(candleTime - alertTime)
          
          // Skip if alert is more than 5 minutes away from any candle
          if (timeDiff > 300) {
            debug.warn(`⚠️  Alert too far from candles (${Math.floor(timeDiff / 60)}m away)`)
            return null
          }
          
          const style = getAlertMarkerStyle(alert.alertType)
          const size = getAlertMarkerSize(alert.alertType)
          const displayName = getAlertDisplayName(alert.alertType)
          
          debug.log(`✅ Creating marker for ${alert.alertType} (${displayName}) - size: ${size}, color: ${style.color}, shape: ${style.shape}`)
          
          return {
            time: closestCandle.time,
            position: style.position,
            color: style.color,
            shape: style.shape,
            size,
          } as SeriesMarker<Time>
        })
        .filter((marker): marker is SeriesMarker<Time> => marker !== null)

      debug.log(`📍 Setting ${markers.length} alert markers on chart`)
      
      // Store markers in ref for re-application on zoom
      markersRef.current = markers
      
      if (markers.length > 0) {
        mainSeries.setMarkers(markers)
      } else {
        debug.warn('⚠️  No valid alert markers to display')
      }
    }

    // Add bubble markers if enabled (combined with alert markers)
    if (showBubbles && bubbles.length > 0 && mainSeries) {
      debug.log(`🫧 Processing ${bubbles.length} bubbles for markers`)
      
      const bubbleMarkers: SeriesMarker<Time>[] = bubbles
        .map(bubble => {
          // Convert bubble timestamp (ms) to candle time (seconds)
          const bubbleTime = Math.floor(bubble.time / 1000)
          const closestCandle = findClosestCandle(bubbleTime, data)
          
          if (!closestCandle) {
            debug.warn(`⚠️  No candle found for bubble at ${new Date(bubble.time).toLocaleTimeString()}`)
            return null
          }
          
          const candleTime = typeof closestCandle.time === 'number' ? closestCandle.time : Number(closestCandle.time)
          const timeDiff = Math.abs(candleTime - bubbleTime)
          
          // Skip if bubble is too far from any candle (>5 minutes)
          if (timeDiff > 300) {
            debug.warn(`⚠️  Bubble too far from candles (${Math.floor(timeDiff / 60)}m away)`)
            return null
          }
          
          const style = getBubbleMarkerStyle(bubble)
          const size = getBubbleMarkerSize(bubble.size)
          
          debug.log(`🫧 Creating bubble marker: ${bubble.size} ${bubble.side} - size: ${size}, color: ${style.color}`)
          
          return {
            time: closestCandle.time,
            position: style.position,
            color: style.color,
            shape: style.shape,
            size,
            text: '', // Remove text label
          } as SeriesMarker<Time>
        })
        .filter((marker): marker is SeriesMarker<Time> => marker !== null)

      debug.log(`🫧 Setting ${bubbleMarkers.length} bubble markers on chart`)
      
      // Combine alert and bubble markers
      if (showAlerts && alerts.length > 0) {
        // Get existing alert markers
        const alertMarkers: SeriesMarker<Time>[] = alerts
          .map(alert => {
            const alertTime = Math.floor(alert.timestamp / 1000)
            const closestCandle = findClosestCandle(alertTime, data)
            
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
        markersRef.current = combinedMarkers // Store for re-application
        mainSeries.setMarkers(combinedMarkers)
        debug.log(`📍 Set ${combinedMarkers.length} total markers (${alertMarkers.length} alerts + ${bubbleMarkers.length} bubbles)`)
      } else if (bubbleMarkers.length > 0) {
        markersRef.current = bubbleMarkers // Store for re-application
        mainSeries.setMarkers(bubbleMarkers)
      }
    }
  }, [showAlerts, alerts, showBubbles, bubbles, data]) // Only marker-related changes trigger update

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
      <div className="mt-2 flex items-center justify-between text-xs text-text-tertiary">
        <div>{symbol} • {data.length} candles</div>
        
        {/* Indicator Legend */}
        {(showWeeklyVWAP || showIchimoku) && (
          <div className="flex items-center gap-3">
            {showWeeklyVWAP && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-amber-500"></div>
                <span>Weekly VWAP</span>
              </div>
            )}
            {showIchimoku && ichimokuData.length > 0 && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-blue-500"></div>
                  <span>Tenkan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-red-500"></div>
                  <span>Kijun</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-gray-400"></div>
                  <span>Cloud</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-purple-500 border-t border-dashed border-purple-500"></div>
                  <span>Chikou</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
