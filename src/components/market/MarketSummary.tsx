import { useMarketStats } from '@/hooks/useMarketData'
import { useStore } from '@/hooks/useStore'
import { StatsCardSkeleton } from '@/components/ui'

export function MarketSummary() {
  const { isLoading, stats } = useMarketStats()
  const setSentimentFilter = useStore((state) => state.setSentimentFilter)
  const currentFilter = useStore((state) => state.sentimentFilter)

  if (isLoading || !stats) {
    return (
      <div className="bg-gray-900 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Market Summary</h2>
        <div className="space-y-4">
          <StatsCardSkeleton />
          <div className="h-4 bg-surface-light rounded animate-pulse" />
          <div className="grid grid-cols-3 gap-2">
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </div>
          <div className="pt-4 border-t border-gray-800">
            <StatsCardSkeleton />
          </div>
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
    <div className="bg-gray-900 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Market Summary</h2>

      {/* Sentiment Indicator */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Market Sentiment</span>
          <span className={`font-bold text-lg ${getSentimentColor()}`}>
            {getSentimentIcon()} {sentiment.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Distribution Bar */}
      <div className="mb-4">
        <div className="flex h-4 rounded overflow-hidden">
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

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <button
          onClick={() => setSentimentFilter(currentFilter === 'bullish' ? 'all' : 'bullish')}
          className={`text-center p-2 rounded transition-colors hover:bg-gray-800 ${
            currentFilter === 'bullish' ? 'bg-gray-800 ring-2 ring-bullish' : ''
          }`}
        >
          <div className="text-bullish font-bold text-lg">
            {stats.bullishCount}
          </div>
          <div className="text-gray-400">Bullish</div>
          <div className="text-xs text-gray-500">
            {bullishPercent.toFixed(1)}%
          </div>
        </button>
        <button
          onClick={() => setSentimentFilter(currentFilter === 'neutral' ? 'all' : 'neutral')}
          className={`text-center p-2 rounded transition-colors hover:bg-gray-800 ${
            currentFilter === 'neutral' ? 'bg-gray-800 ring-2 ring-neutral' : ''
          }`}
        >
          <div className="text-neutral font-bold text-lg">
            {stats.neutralCount}
          </div>
          <div className="text-gray-400">Neutral</div>
          <div className="text-xs text-gray-500">
            {neutralPercent.toFixed(1)}%
          </div>
        </button>
        <button
          onClick={() => setSentimentFilter(currentFilter === 'bearish' ? 'all' : 'bearish')}
          className={`text-center p-2 rounded transition-colors hover:bg-gray-800 ${
            currentFilter === 'bearish' ? 'bg-gray-800 ring-2 ring-bearish' : ''
          }`}
        >
          <div className="text-bearish font-bold text-lg">
            {stats.bearishCount}
          </div>
          <div className="text-gray-400">Bearish</div>
          <div className="text-xs text-gray-500">
            {bearishPercent.toFixed(1)}%
          </div>
        </button>
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-800 text-center">
        <div className="text-gray-400 text-sm">Total Coins</div>
        <div className="text-2xl font-bold">{stats.totalCoins}</div>
      </div>
    </div>
  )
}
