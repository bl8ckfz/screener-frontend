import { memo } from 'react'
import type { Coin } from '@/types/coin'
import { formatPercent, formatNumber } from '@/utils/format'
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
