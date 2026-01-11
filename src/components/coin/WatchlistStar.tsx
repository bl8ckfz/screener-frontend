import { useStore } from '@/hooks/useStore'

interface WatchlistStarProps {
  symbol: string
  className?: string
}

export function WatchlistStar({ symbol, className = '' }: WatchlistStarProps) {
  const watchlistSymbols = useStore((state) => state.watchlistSymbols)
  const toggleWatchlist = useStore((state) => state.toggleWatchlist)
  
  const isInWatchlist = watchlistSymbols.includes(symbol)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    toggleWatchlist(symbol)
  }

  return (
    <button
      onClick={handleClick}
      className={`text-2xl transition-transform hover:scale-110 motion-reduce:transform-none h-10 w-10 flex items-center justify-center ${className}`}
      title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {isInWatchlist ? (
        <span className="text-yellow-500">⭐</span>
      ) : (
        <span className="text-gray-600">☆</span>
      )}
    </button>
  )
}
