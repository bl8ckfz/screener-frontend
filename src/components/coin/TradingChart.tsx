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
  type IPriceLine,
} from 'lightweight-charts'
import { type Candlestick } from '@/services/chartData'
import type { AlertHistoryEntry } from '@/types/alertHistory'
import { debug } from '@/utils/debug'
import { useStore } from '@/hooks/useStore'
import type { AlertColorConfig } from '@/types/alertColors'
import { resolveAlertColor, isBullishAlertType } from '@/types/alertColors'
import { formatDojoPrice, type DojoSetup } from '@/types/dojo'

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
  height?: number
  livePrice?: number
  showVolume?: boolean
  showAlerts?: boolean
  alerts?: AlertHistoryEntry[]
  /**
   * A Dojo confluence zone to draw as horizontal levels.
   *
   * These are plan levels, not events: the zone edges, the resting-limit
   * entry at fib 0.705, the stop, and the three targets. They are plain
   * prices, so they render correctly on any interval — a weekly zone is
   * still meaningful drawn over a daily chart.
   */
  dojoSetup?: DojoSetup | null
  className?: string
}

/**
 * Determine alert marker size based on alert type priority
 */
const getAlertMarkerSize = (_alertType: string): 0 | 1 | 2 => {
  return 1
}

/**
 * Get alert marker color and position based on alert type
 */
const getAlertMarkerStyle = (alertType: string, alertColors: AlertColorConfig): { color: string; position: 'aboveBar' | 'belowBar'; shape: 'circle' | 'arrowUp' | 'arrowDown' } => {
  const cleanType = alertType.replace(/^futures_/, '')
  const normalizedKey = alertType.startsWith('futures_') ? alertType : `futures_${alertType}`
  const isBullish = isBullishAlertType(cleanType)
  const isHunter = cleanType.includes('bottom_hunter') || cleanType.includes('top_hunter')
  const isWhale = cleanType === 'whale_detector' || cleanType === 'whale_accumulation' || cleanType === 'whale_distribution'

  if (isWhale) {
    const color = resolveAlertColor(alertColors, normalizedKey, '#22d3ee')
    return { color, position: isBullish ? 'belowBar' : 'aboveBar', shape: 'circle' }
  }

  const color = isHunter
    ? resolveAlertColor(alertColors, normalizedKey, '#a855f7')
    : resolveAlertColor(alertColors, normalizedKey, isBullish ? '#22c55e' : '#ef4444')

  return {
    color,
    position: isBullish ? 'belowBar' : 'aboveBar',
    shape: isHunter
      ? 'circle'
      : (isBullish ? 'arrowUp' : 'arrowDown'),
  }
}

/**
 * TradingChart component using lightweight-charts library
 * 
 * Displays candlestick, line, or area charts with volume overlay and alert markers
 */
export function TradingChart({
  data,
  height = 400,
  livePrice,
  showVolume = true,
  showAlerts = false,
  alerts = [],
  dojoSetup = null,
  className = '',
}: TradingChartProps) {
  const alertColors = useStore((state) => state.alertColors)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  // Price lines for the Dojo zone, tracked so they can be removed on change.
  const dojoLinesRef = useRef<IPriceLine[]>([])
  // The zone the chart SHOULD be showing. Mirrors markersRef: the main series
  // is destroyed and rebuilt whenever `data` changes, taking every price line
  // with it, so the recreation path needs to know what to restore.
  const dojoSetupRef = useRef<DojoSetup | null>(dojoSetup)
  dojoSetupRef.current = dojoSetup
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markersRef = useRef<SeriesMarker<Time>[]>([]) // Store markers to re-apply on zoom
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
  }, [showVolume]) // height intentionally excluded — handled below via applyOptions

  // Resize chart height without destroying/recreating the instance
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ height })
    }
  }, [height])

  // Update main chart series when data or chart type changes
  // Separated from markers to avoid unnecessary series recreation
  // Draw the Dojo zone as horizontal price levels.
  //
  // A Dojo setup is a PLAN, not an event: a zone price has not reached yet,
  // with a resting limit entry, a stop and three targets. Markers are wrong
  // for that — there is no bar to attach them to — so these are price lines
  // spanning the chart. They are plain prices, so a weekly zone renders
  // correctly over a daily chart.
  //
  // `fresh` says the series was just rebuilt, in which case the old line
  // handles belong to a series that no longer exists and must be dropped
  // rather than removed.
  const drawDojoZone = (
    series: ISeriesApi<'Candlestick'>,
    setup: DojoSetup | null,
    fresh = false
  ) => {
    if (fresh) {
      dojoLinesRef.current = []
    } else {
      dojoLinesRef.current.forEach((line) => {
        try {
          series.removePriceLine(line)
        } catch {
          // The series may already be gone during teardown.
        }
      })
      dojoLinesRef.current = []
    }

    if (!setup) return

    const isLong = setup.direction === 'long'
    const zoneColor = isLong ? '#089981' : '#f23645' // the Dojo Pine palette

    const levels: Array<{
      price: number
      color: string
      style: LineStyle
      title: string
      width: 1 | 2
    }> = [
      // The zone edges bracket the area price has to enter.
      { price: setup.otz_high, color: zoneColor, style: LineStyle.Dotted, title: 'OTZ 0.62', width: 1 },
      { price: setup.otz_low, color: zoneColor, style: LineStyle.Dotted, title: 'OTZ 0.79', width: 1 },
      // Entry is the one level that matters most — solid and thicker.
      { price: setup.entry, color: '#f5a623', style: LineStyle.Solid, title: `Entry ${formatDojoPrice(setup.entry)}`, width: 2 },
      { price: setup.stop_loss, color: '#f23645', style: LineStyle.Dashed, title: 'Stop', width: 1 },
      { price: setup.tp1, color: '#089981', style: LineStyle.Dashed, title: 'TP1', width: 1 },
      { price: setup.tp2, color: '#089981', style: LineStyle.Dotted, title: 'TP2', width: 1 },
      { price: setup.tp3, color: '#089981', style: LineStyle.Dotted, title: 'TP3', width: 1 },
    ]

    dojoLinesRef.current = levels
      .filter((l) => Number.isFinite(l.price) && l.price > 0)
      .map((l) =>
        series.createPriceLine({
          price: l.price,
          color: l.color,
          lineWidth: l.width,
          lineStyle: l.style,
          axisLabelVisible: true,
          title: l.title,
        })
      )
  }

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return

    setIsLoading(true)

    const chart = chartRef.current
    const timeScale = chart.timeScale()

    // CRITICAL: Save visible range BEFORE updating to preserve user's zoom/pan
    // Note: lightweight-charts doesn't expose price scale range API, only time axis preserved
    const savedTimeRange = timeScale.getVisibleLogicalRange()

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

    if (markersRef.current.length > 0) {
      mainSeries.setMarkers(markersRef.current)
    }

    // The old series took every price line with it, so redraw the zone on the
    // new one. Without this the levels appear once and vanish on the next
    // data refresh, which does not change data.length and so cannot be caught
    // by the effect above.
    drawDojoZone(mainSeries, dojoSetupRef.current, true)

    // CRITICAL: Restore visible range AFTER updating to prevent zoom/pan reset
    // Use requestAnimationFrame to ensure chart has processed the data
    requestAnimationFrame(() => {
      if (savedTimeRange) {
        timeScale.setVisibleLogicalRange(savedTimeRange)
      }
    })

    setIsLoading(false)
  }, [data]) // Only data triggers main series recreation

  // Live price update (update last candle close/high/low between interval closes)
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current || data.length === 0) return
    if (typeof livePrice !== 'number' || Number.isNaN(livePrice)) return

    const last = data[data.length - 1]
    const lastTime = last.time as any
    const updatedHigh = Math.max(last.high, livePrice)
    const updatedLow = Math.min(last.low, livePrice)

    mainSeriesRef.current.update({
      time: lastTime,
      open: last.open,
      high: updatedHigh,
      low: updatedLow,
      close: livePrice,
    })
  }, [livePrice, data])

  // Update volume series when data or showVolume changes
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current || data.length === 0) return

    const chart = chartRef.current
    const timeScale = chart.timeScale()

    // CRITICAL: Save visible range BEFORE updating to preserve user's zoom/pan
    const savedTimeRange = timeScale.getVisibleLogicalRange()

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

    // CRITICAL: Restore visible range AFTER updating to prevent zoom/pan reset
    requestAnimationFrame(() => {
      if (savedTimeRange) {
        timeScale.setVisibleLogicalRange(savedTimeRange)
      }
    })
  }, [data, showVolume]) // Only data and showVolume trigger volume series update

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



  // Redraw when the selected zone changes. Data-driven redraws are handled by
  // the series-recreation effect, which restores the zone alongside markers.
  useEffect(() => {
    if (mainSeriesRef.current) {
      drawDojoZone(mainSeriesRef.current, dojoSetup)
    }
  }, [dojoSetup?.id])

  // Update alert markers when alerts change or toggle
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current || data.length === 0) return

    const mainSeries = mainSeriesRef.current

    // Clear markers when alerts are disabled or empty
    if (!showAlerts || alerts.length === 0) {
      markersRef.current = []
      mainSeries.setMarkers([])
      return
    }

    debug.log(`🎯 Processing ${alerts.length} alerts for markers`)
    
    // Deduplicate alerts: one arrow per alert type per candle
    const uniqueAlertMap = new Map<string, AlertHistoryEntry>()
    
    alerts.forEach(alert => {
      const alertTime = Math.floor(alert.timestamp / 1000)
      const closestCandle = findClosestCandle(alertTime, data)
      
      if (!closestCandle) return
      
      const candleTime = typeof closestCandle.time === 'number' ? closestCandle.time : Number(closestCandle.time)
      const timeDiff = Math.abs(candleTime - alertTime)
      
      // Skip if alert is more than 5 minutes away from any candle
      if (timeDiff > 300) return
      
      const key = `${candleTime}_${alert.alertType}`
      
      if (!uniqueAlertMap.has(key)) {
        uniqueAlertMap.set(key, alert)
      }
    })
    
    debug.log(`🎯 Deduplicated ${alerts.length} alerts to ${uniqueAlertMap.size} unique markers`)
    
    const markers: SeriesMarker<Time>[] = Array.from(uniqueAlertMap.values())
      .map(alert => {
        const alertTime = Math.floor(alert.timestamp / 1000)
        const closestCandle = findClosestCandle(alertTime, data)!
        
        const style = getAlertMarkerStyle(alert.alertType, alertColors)
        const size = getAlertMarkerSize(alert.alertType)
        
        return {
          time: closestCandle.time,
          position: style.position,
          color: style.color,
          shape: style.shape,
          size,
        } as SeriesMarker<Time>
      })
      .sort((a, b) => (a.time as number) - (b.time as number))

    debug.log(`📍 Setting ${markers.length} alert markers on chart`)
    
    markersRef.current = markers
    mainSeries.setMarkers(markers)
  }, [showAlerts, alerts, data, alertColors]) // Alert color changes also trigger update

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
        className="rounded-lg overflow-hidden w-full max-w-full"
        style={{ height: `${height}px`, width: '100%' }}
      />
      
      {data.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-text-tertiary">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-sm">No chart data available</div>
          </div>
        </div>
      )}
    </div>
  )
}
