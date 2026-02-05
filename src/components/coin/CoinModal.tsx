import { useEffect } from 'react'
import type { Coin } from '@/types/coin'
import { formatPrice, formatPercent, formatLargeNumber, formatDateTime } from '@/utils/format'
import { TechnicalIndicators } from './TechnicalIndicators'
import { ExternalLinks } from './ExternalLinks'
import { ChartContainer } from './ChartContainer'
// import { AlertTimelineChart } from './AlertTimelineChart' // DISABLED
import { Button, Badge } from '@/components/ui'

export interface CoinModalProps {
  coin: Coin | null
  isOpen: boolean
  onClose: () => void
}

/**
 * CoinModal component displays detailed information about a selected coin
 */
export function CoinModal({ coin, isOpen, onClose }: CoinModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen || !coin) return null

  const priceChangeColor =
    coin.priceChangePercent > 0
      ? 'text-bullish'
      : coin.priceChangePercent < 0
        ? 'text-bearish'
        : 'text-neutral'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl border border-gray-700 animate-in slide-in-from-bottom-8 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {coin.symbol}
                  <span className="text-gray-400 text-lg ml-2">
                    / {coin.pair}
                  </span>
                </h2>
                <p className="text-sm text-gray-400">{coin.fullSymbol}</p>
              </div>
              <Badge
                variant={
                  coin.priceChangePercent > 0
                    ? 'success'
                    : coin.priceChangePercent < 0
                      ? 'danger'
                      : 'default'
                }
                size="lg"
              >
                {coin.priceChangePercent > 0 ? '+' : ''}
                {formatPercent(coin.priceChangePercent)}
              </Badge>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto space-y-6">
            {/* Chart Section */}
            <ChartContainer coin={coin} />

            {/* Alert Timeline Chart - DISABLED
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">
                Alert Timeline (24h)
              </h3>
              <AlertTimelineChart symbol={coin.symbol} height={300} />
            </div>
            */}

            {/* Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Price Info */}
              <div className="lg:col-span-1 space-y-4">
                {/* Current Price */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">
                    Current Price
                  </div>
                  <div className={`text-3xl font-bold ${priceChangeColor}`}>
                    {formatPrice(coin.lastPrice)}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {formatDateTime(coin.closeTime)}
                  </div>
                </div>

                {/* Price Statistics */}
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    24h Statistics
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">High</span>
                      <span className="font-mono text-red-400">
                        {formatPrice(coin.highPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Low</span>
                      <span className="font-mono text-green-400">
                        {formatPrice(coin.lowPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Open</span>
                      <span className="font-mono">
                        {formatPrice(coin.openPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Prev Close</span>
                      <span className="font-mono">
                        {formatPrice(coin.prevClosePrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Weighted Avg</span>
                      <span className="font-mono">
                        {formatPrice(coin.weightedAvgPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Volume Information */}
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    Volume
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">24h Volume</span>
                      <span className="font-mono">
                        {formatLargeNumber(coin.volume)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Quote Volume</span>
                      <span className="font-mono">
                        {formatLargeNumber(coin.quoteVolume)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Trades</span>
                      <span className="font-mono">
                        {formatLargeNumber(coin.count)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Book */}
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    Order Book
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Best Bid</span>
                      <span className="font-mono text-green-400">
                        {formatPrice(coin.bidPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Bid Qty</span>
                      <span>{formatLargeNumber(coin.bidQty)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Best Ask</span>
                      <span className="font-mono text-red-400">
                        {formatPrice(coin.askPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Ask Qty</span>
                      <span>{formatLargeNumber(coin.askQty)}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Spread</span>
                        <span className="font-mono">
                          {formatPercent(
                            ((coin.askPrice - coin.bidPrice) / coin.bidPrice) * 100
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Column: Technical Indicators */}
              <div className="lg:col-span-1">
                <TechnicalIndicators coin={coin} />
              </div>

              {/* Right Column: External Links */}
              <div className="lg:col-span-1">
                <ExternalLinks coin={coin} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-700">
            <div className="text-sm text-gray-400">
              Last updated: {formatDateTime(coin.closeTime)}
            </div>
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
