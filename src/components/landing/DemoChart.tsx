/**
 * The demo's chart.
 *
 * Lives in its own module so the page can React.lazy it. That is not a
 * micro-optimisation: importing TradingChart eagerly pulls in lightweight-charts
 * (~45KB gzipped) AND the zustand store, whose module graph instantiates an
 * IndexedDB connection and the auth service at import time. On a marketing page
 * that would all run before the headline paints.
 *
 * TradingChart itself is reused unmodified — it makes no network calls, and its
 * drawDojoZone draws the whole plan from the setup it is handed.
 */
import { useMemo } from 'react'
import { TradingChart } from '@/components/coin/TradingChart'
import type { Candlestick } from '@/services/chartData'
import { toDojoSetup, type UnlockedZone, type PublicDemoSymbol } from '@/types/publicDemo'

interface DemoChartProps {
  symbol: PublicDemoSymbol
  /**
   * Only an unlocked zone can be drawn. The chart renders entry, stop and
   * targets as price lines with visible axis labels, so handing it a locked
   * zone would print exactly what the server withheld — which is why the type
   * makes it impossible rather than merely discouraged.
   */
  zone: UnlockedZone | null
  height?: number
}

export default function DemoChart({ symbol, zone, height = 420 }: DemoChartProps) {
  const candles = useMemo<Candlestick[]>(
    () =>
      symbol.candles.map(([time, open, high, low, close, volume]) => ({
        time,
        open,
        high,
        low,
        close,
        volume,
        // Neither is read by the chart; zero is honest here, where a guess
        // would not be.
        quoteVolume: 0,
        trades: 0,
      })),
    [symbol.candles],
  )

  // TradingChart returns before clearing its loading flag when handed an empty
  // series, so an empty array renders a spinner that never stops. The server
  // already drops candle-less symbols; this is the second lock on that door.
  if (candles.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-gray-500"
      >
        No price history loaded for {symbol.symbol}.
      </div>
    )
  }

  return (
    <TradingChart
      data={candles}
      height={height}
      livePrice={symbol.price}
      showVolume={false}
      showAlerts={false}
      dojoSetup={zone ? toDojoSetup(zone) : null}
    />
  )
}
