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
} from 'lightweight-charts'
import type { Candlestick } from '@/services/chartData'
import { calculateWeeklyVWAP } from '@/utils/indicators'

export type ChartType = 'candlestick' | 'line' | 'area'

export interface TradingChartProps {
  data: Candlestick[]
  symbol: string
  type?: ChartType
  height?: number
  showVolume?: boolean
  showWeeklyVWAP?: boolean
  className?: string
}

/**
 * TradingChart component using lightweight-charts library
 * 
 * Displays candlestick, line, or area charts with volume overlay
 */
export function TradingChart({
  data,
  symbol,
  type = 'candlestick',
  height = 400,
  showVolume = true,
  showWeeklyVWAP = false,
  className = '',
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const weeklyVWAPRef = useRef<ISeriesApi<'Line'> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return

    setIsLoading(true)

    // Create chart instance
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

    // Create main series based on chart type
    let mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area'>

    if (type === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: '#10b981', // bullish
        downColor: '#ef4444', // bearish
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
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
        title: 'Weekly VWAP',
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

    // Fit content to chart
    chart.timeScale().fitContent()

    setIsLoading(false)

    // Handle window resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [data, type, height, showVolume, showWeeklyVWAP])

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
