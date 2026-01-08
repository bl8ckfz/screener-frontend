import { memo } from 'react'
import type { Coin } from '@/types/coin'
import { formatPrice, formatPercent, formatNumber } from '@/utils/format'
import { Badge } from '@/components/ui'

export interface TechnicalIndicatorsProps {
  coin: Coin
}

/**
 * TechnicalIndicators component displays VCP, Fibonacci levels, and other technical data
 * Memoized to prevent unnecessary re-renders
 */
function TechnicalIndicatorsComponent({ coin }: TechnicalIndicatorsProps) {
  const { indicators } = coin

  return (
    <div className="space-y-3">
      {/* VCP Section */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
          VCP Analysis
        </h3>
        <div className="bg-gray-800 rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-xs">VCP Value</span>
            <span
              className={`text-base font-bold ${
                indicators.vcp > 0
                  ? 'text-bullish'
                  : indicators.vcp < 0
                    ? 'text-bearish'
                    : 'text-gray-400'
              }`}
            >
              {formatNumber(indicators.vcp, 3)}
            </span>
          </div>
        </div>
      </div>

      {/* Fibonacci Pivot Levels */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
          Fibonacci Pivots
        </h3>
        <div className="bg-gray-800 rounded-lg p-2.5 space-y-1">
          {/* Resistance Levels */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-red-400">R1</span>
              <span className="font-mono text-xs">{formatPrice(indicators.fibonacci.resistance1)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-red-300">R.618</span>
              <span className="font-mono text-xs">{formatPrice(indicators.fibonacci.resistance0618)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-red-200">R.382</span>
              <span className="font-mono text-xs">{formatPrice(indicators.fibonacci.resistance0382)}</span>
            </div>
          </div>

          {/* Pivot */}
          <div className="border-y border-blue-700/50 py-1">
            <div className="flex justify-between text-xs">
              <span className="text-blue-400 font-semibold">Pivot</span>
              <span className="font-mono font-semibold text-xs">{formatPrice(indicators.fibonacci.pivot)}</span>
            </div>
          </div>

          {/* Support Levels */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-green-200">S.382</span>
              <span className="font-mono text-xs">{formatPrice(indicators.fibonacci.support0382)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-green-300">S.618</span>
              <span className="font-mono text-xs">{formatPrice(indicators.fibonacci.support0618)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-green-400">S1</span>
              <span className="font-mono text-xs">{formatPrice(indicators.fibonacci.support1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Price Ratios */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
          Price Ratios
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-0.5">Price/WA</div>
            <div className="text-xs font-mono">
              {formatNumber(indicators.priceToWeightedAvg, 4)}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-0.5">Price/High</div>
            <div className="text-xs font-mono">
              {formatPercent(indicators.priceToHigh)}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-0.5">Low/Price</div>
            <div className="text-xs font-mono">
              {formatPercent(indicators.lowToPrice)}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-0.5">High/Low</div>
            <div className="text-xs font-mono">
              {formatPercent(indicators.highToLow)}
            </div>
          </div>
        </div>
      </div>

      {/* Volume Ratios */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
          Volume Metrics
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-0.5">Ask/Volume</div>
            <div className="text-xs font-mono">
              {formatNumber(indicators.askToVolume, 4)}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-0.5">Price/Volume</div>
            <div className="text-xs font-mono">
              {formatNumber(indicators.priceToVolume, 2)}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-0.5">Quote/Count</div>
            <div className="text-xs font-mono">
              {formatNumber(indicators.quoteToCount, 2)}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-xs text-gray-400 mb-0.5">Trades/Volume</div>
            <div className="text-xs font-mono">
              {formatNumber(indicators.tradesPerVolume, 4)}
            </div>
          </div>
        </div>
      </div>

      {/* Market Dominance - Inline */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
          Market Dominance
        </h3>
        <div className="bg-gray-800 rounded-lg p-2 flex items-center gap-2 flex-wrap">
          {indicators.ethDominance !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">ETH</span>
              <Badge
                variant={indicators.ethDominance > 0 ? 'success' : 'danger'}
                size="sm"
              >
                {indicators.ethDominance > 0 ? '+' : ''}
                {formatPercent(indicators.ethDominance)}
              </Badge>
            </div>
          )}
          {indicators.btcDominance !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">BTC</span>
              <Badge
                variant={indicators.btcDominance > 0 ? 'success' : 'danger'}
                size="sm"
              >
                {indicators.btcDominance > 0 ? '+' : ''}
                {formatPercent(indicators.btcDominance)}
              </Badge>
            </div>
          )}
          {indicators.paxgDominance !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">PAXG</span>
              <Badge
                variant={indicators.paxgDominance > 0 ? 'success' : 'danger'}
                size="sm"
              >
                {indicators.paxgDominance > 0 ? '+' : ''}
                {formatPercent(indicators.paxgDominance)}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Change Percentages */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
          Change Metrics
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">From WA</div>
            <div
              className={`text-sm font-mono ${
                indicators.priceChangeFromWeightedAvg > 0
                  ? 'text-bullish'
                  : indicators.priceChangeFromWeightedAvg < 0
                    ? 'text-bearish'
                    : 'text-gray-400'
              }`}
            >
              {formatPercent(indicators.priceChangeFromWeightedAvg)}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">From Prev Close</div>
            <div
              className={`text-sm font-mono ${
                indicators.priceChangeFromPrevClose > 0
                  ? 'text-bullish'
                  : indicators.priceChangeFromPrevClose < 0
                    ? 'text-bearish'
                    : 'text-gray-400'
              }`}
            >
              {formatPercent(indicators.priceChangeFromPrevClose)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Memoized TechnicalIndicators component
 * Only re-renders when coin.indicators change
 */
export const TechnicalIndicators = memo(
  TechnicalIndicatorsComponent,
  (prevProps, nextProps) => {
    // Deep comparison of indicators object
    return (
      prevProps.coin.id === nextProps.coin.id &&
      prevProps.coin.lastUpdated === nextProps.coin.lastUpdated &&
      JSON.stringify(prevProps.coin.indicators) === JSON.stringify(nextProps.coin.indicators)
    )
  }
)

TechnicalIndicators.displayName = 'TechnicalIndicators'
