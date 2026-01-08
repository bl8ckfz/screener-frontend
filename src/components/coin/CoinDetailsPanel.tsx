import type { Coin } from '@/types/coin'
import { formatPrice, formatPercent, formatLargeNumber, formatDateTime } from '@/utils/format'
import { TechnicalIndicators } from './TechnicalIndicators'
import { ExternalLinks } from './ExternalLinks'
import { EmptyState, Badge } from '@/components/ui'

export interface CoinDetailsPanelProps {
  coin: Coin | null
  onClose?: () => void
  className?: string
}

/**
 * CoinDetailsPanel Component
 * 
 * Displays detailed coin information in a side panel.
 * Replaces CoinModal content for the new alert-centric layout.
 * Shows 24h statistics, technical indicators, Fibonacci pivots, and external tools.
 * 
 * Phase 8.1.3: Create Coin Details Side Panel
 */
export function CoinDetailsPanel({ coin, onClose, className = '' }: CoinDetailsPanelProps) {
  // Show empty state when no coin selected
  if (!coin) {
    return (
      <div className={`h-full flex items-center justify-center ${className}`}>
        <EmptyState
          icon="💰"
          title="No Coin Selected"
          description="Select a coin from the alert history to view details"
        />
      </div>
    )
  }

  const priceChangeColor =
    coin.priceChangePercent > 0
      ? 'text-bullish'
      : coin.priceChangePercent < 0
        ? 'text-bearish'
        : 'text-neutral'

  return (
    <div className={`${className}`}>
      {/* Header - Matches Chart Section Style */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-white">
            {coin.symbol}
            <span className="text-gray-400 text-sm ml-2">/ {coin.pair}</span>
          </h3>
          <Badge
            variant={
              coin.priceChangePercent > 0
                ? 'success'
                : coin.priceChangePercent < 0
                  ? 'danger'
                  : 'default'
            }
            size="md"
          >
            {coin.priceChangePercent > 0 ? '+' : ''}
            {formatPercent(coin.priceChangePercent)}
          </Badge>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Deselect coin"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="space-y-3 p-3 overflow-y-auto max-h-[600px]">
        {/* Current Price - Inline */}
        <div className="bg-gray-800 rounded-lg p-2.5">
          <div className="flex items-baseline justify-between">
            <div className={`text-lg font-bold ${priceChangeColor}`}>
              {formatPrice(coin.lastPrice)}
            </div>
            <div className="text-xs text-gray-500">
              {formatDateTime(coin.closeTime)}
            </div>
          </div>
        </div>

        {/* 24h Statistics & Volume - Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 24h Statistics */}
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              24h Statistics
            </h4>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">High</span>
                <span className="font-mono text-red-400">
                  {formatPrice(coin.highPrice)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Low</span>
                <span className="font-mono text-green-400">
                  {formatPrice(coin.lowPrice)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Open</span>
                <span className="font-mono text-gray-300">
                  {formatPrice(coin.openPrice)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Prev Close</span>
                <span className="font-mono text-gray-300">
                  {formatPrice(coin.prevClosePrice)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Weighted Avg</span>
                <span className="font-mono text-gray-300">
                  {formatPrice(coin.weightedAvgPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Volume Information */}
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Volume
            </h4>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">24h Volume</span>
                <span className="font-mono text-gray-300">
                  {formatLargeNumber(coin.volume)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Quote Volume</span>
                <span className="font-mono text-gray-300">
                  {formatLargeNumber(coin.quoteVolume)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Trades</span>
                <span className="font-mono text-gray-300">
                  {formatLargeNumber(coin.count)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Book */}
        <div className="bg-gray-800 rounded-lg p-2.5">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Order Book
          </h4>
          <div className="space-y-1">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-gray-400">Bid</span>
              <div className="text-right">
                <span className="font-mono text-green-400">{formatPrice(coin.bidPrice)}</span>
                <span className="text-gray-500 ml-2">({formatLargeNumber(coin.bidQty)})</span>
              </div>
            </div>
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-gray-400">Ask</span>
              <div className="text-right">
                <span className="font-mono text-red-400">{formatPrice(coin.askPrice)}</span>
                <span className="text-gray-500 ml-2">({formatLargeNumber(coin.askQty)})</span>
              </div>
            </div>
            <div className="pt-1 border-t border-gray-700">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Spread</span>
                <span className="font-mono text-gray-300">
                  {formatPercent(
                    ((coin.askPrice - coin.bidPrice) / coin.bidPrice) * 100
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Indicators */}
        <TechnicalIndicators coin={coin} />

        {/* External Links */}
        <ExternalLinks coin={coin} />
      </div>
    </div>
  )
}
