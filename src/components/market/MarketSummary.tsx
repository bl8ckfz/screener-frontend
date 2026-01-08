import { useMarketStats } from '@/hooks/useMarketData'
import { useStore } from '@/hooks/useStore'
import type { Coin } from '@/types/coin'

interface MarketSummaryProps {
  coins?: Coin[]
  isLoading?: boolean
}

export function MarketSummary({ coins, isLoading: isLoadingProp }: MarketSummaryProps) {
  const { isLoading, stats } = useMarketStats(coins, isLoadingProp)
  const setSentimentFilter = useStore((state) => state.setSentimentFilter)
  const currentFilter = useStore((state) => state.sentimentFilter)

  if (isLoading || !stats) {
    return (
      <div className="flex items-center gap-4 animate-pulse">
        <div className="h-6 w-32 bg-surface-light rounded" />
        <div className="h-6 w-48 bg-surface-light rounded" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-20 bg-surface-light rounded" />
          ))}
        </div>
      </div>
    )
  }

  const { bullishPercent, bearishPercent, neutralPercent, sentiment } = stats

  const getSentimentColor = () => {
    switch (sentiment) {
      case 'bullish':
        return 'text-bullish'
      case 'bearish':
        return 'text-bearish'
      default:
        return 'text-neutral'
    }
  }

  const getSentimentIcon = () => {
    switch (sentiment) {
      case 'bullish':
        return '↑'
      case 'bearish':
        return '↓'
      default:
        return '→'
    }
  }

  return (
    <div className="flex items-center gap-6">
      {/* Market Sentiment */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Market:</span>
        <span className={`font-semibold ${getSentimentColor()}`}>
          {getSentimentIcon()} {sentiment.toUpperCase()}
        </span>
      </div>

      {/* Distribution Bar */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="flex h-3 rounded overflow-hidden flex-1">
          <div
            className="bg-bullish"
            style={{ width: `${bullishPercent}%` }}
            title={`Bullish: ${bullishPercent.toFixed(1)}%`}
          />
          <div
            className="bg-neutral"
            style={{ width: `${neutralPercent}%` }}
            title={`Neutral: ${neutralPercent.toFixed(1)}%`}
          />
          <div
            className="bg-bearish"
            style={{ width: `${bearishPercent}%` }}
            title={`Bearish: ${bearishPercent.toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Statistics - Compact Horizontal */}
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setSentimentFilter(currentFilter === 'bullish' ? 'all' : 'bullish')}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-gray-800 ${
            currentFilter === 'bullish' ? 'bg-gray-800 ring-1 ring-bullish' : ''
          }`}
        >
          <span className="text-bullish font-bold">{stats.bullishCount}</span>
          <span className="text-gray-400 text-xs">({bullishPercent.toFixed(0)}%)</span>
        </button>
        <button
          onClick={() => setSentimentFilter(currentFilter === 'neutral' ? 'all' : 'neutral')}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-gray-800 ${
            currentFilter === 'neutral' ? 'bg-gray-800 ring-1 ring-neutral' : ''
          }`}
        >
          <span className="text-neutral font-bold">{stats.neutralCount}</span>
          <span className="text-gray-400 text-xs">({neutralPercent.toFixed(0)}%)</span>
        </button>
        <button
          onClick={() => setSentimentFilter(currentFilter === 'bearish' ? 'all' : 'bearish')}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-gray-800 ${
            currentFilter === 'bearish' ? 'bg-gray-800 ring-1 ring-bearish' : ''
          }`}
        >
          <span className="text-bearish font-bold">{stats.bearishCount}</span>
          <span className="text-gray-400 text-xs">({bearishPercent.toFixed(0)}%)</span>
        </button>
        <div className="text-gray-500 border-l border-gray-700 pl-3">
          <span className="text-xs">Total:</span> <span className="font-semibold">{stats.totalCoins}</span>
        </div>
      </div>
    </div>
  )
}
