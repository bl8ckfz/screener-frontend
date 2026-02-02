import { useMarketStats } from '@/hooks/useMarketStats'
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
    <div className="flex flex-wrap items-center gap-2 md:gap-6 w-full">
      {/* Market Sentiment */}
      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
        <span className="text-[10px] md:text-sm text-gray-400">Market:</span>
        <span className={`text-[10px] md:text-base font-semibold ${getSentimentColor()}`}>
          {getSentimentIcon()} {sentiment.toUpperCase()}
        </span>
      </div>

      {/* Distribution Bar */}
      <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-[100px] max-w-[200px] md:max-w-md">
        <div className="flex h-2 md:h-3 rounded overflow-hidden flex-1">
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
      <div className="flex items-center gap-1 md:gap-3 text-xs md:text-sm">
        <button
          onClick={() => setSentimentFilter(currentFilter === 'bullish' ? 'all' : 'bullish')}
          className={`flex items-center gap-0.5 md:gap-1 px-1 md:px-2 py-0.5 md:py-1 rounded transition-colors hover:bg-gray-800 ${
            currentFilter === 'bullish' ? 'bg-gray-800 ring-1 ring-bullish' : ''
          }`}
        >
          <span className="text-bullish font-bold text-[10px] md:text-sm">{stats.bullishCount}</span>
          <span className="text-gray-400 text-[9px] md:text-xs">({bullishPercent.toFixed(0)}%)</span>
        </button>
        <button
          onClick={() => setSentimentFilter(currentFilter === 'neutral' ? 'all' : 'neutral')}
          className={`flex items-center gap-0.5 md:gap-1 px-1 md:px-2 py-0.5 md:py-1 rounded transition-colors hover:bg-gray-800 ${
            currentFilter === 'neutral' ? 'bg-gray-800 ring-1 ring-neutral' : ''
          }`}
        >
          <span className="text-neutral font-bold text-[10px] md:text-sm">{stats.neutralCount}</span>
          <span className="text-gray-400 text-[9px] md:text-xs">({neutralPercent.toFixed(0)}%)</span>
        </button>
        <button
          onClick={() => setSentimentFilter(currentFilter === 'bearish' ? 'all' : 'bearish')}
          className={`flex items-center gap-0.5 md:gap-1 px-1 md:px-2 py-0.5 md:py-1 rounded transition-colors hover:bg-gray-800 ${
            currentFilter === 'bearish' ? 'bg-gray-800 ring-1 ring-bearish' : ''
          }`}
        >
          <span className="text-bearish font-bold text-[10px] md:text-sm">{stats.bearishCount}</span>
          <span className="text-gray-400 text-[9px] md:text-xs">({bearishPercent.toFixed(0)}%)</span>
        </button>
        <button
          onClick={() => setSentimentFilter('all')}
          className={`text-gray-500 border-l border-gray-700 pl-1.5 md:pl-3 hover:text-gray-300 transition-colors ${
            currentFilter === 'all' ? 'text-gray-300' : ''
          }`}
          title="Show all coins"
        >
          <span className="text-[9px] md:text-xs">Total:</span> <span className="font-semibold text-[10px] md:text-sm">{stats.totalCoins}</span>
        </button>
      </div>
    </div>
  )
}
