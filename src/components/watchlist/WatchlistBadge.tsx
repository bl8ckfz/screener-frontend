import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'

interface WatchlistBadgeProps {
  symbol: string
}

export function WatchlistBadge({ symbol }: WatchlistBadgeProps) {
  const { watchlists, addToWatchlist, removeFromWatchlist } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  // Get watchlists containing this symbol
  const watchlistsWithSymbol = watchlists.filter((wl) => wl.symbols.includes(symbol))

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4, // 4px gap
        left: rect.left,
      })
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = (watchlistId: string, isInWatchlist: boolean) => {
    if (isInWatchlist) {
      removeFromWatchlist(watchlistId, symbol)
    } else {
      addToWatchlist(watchlistId, symbol)
    }
  }

  // Always show the badge, even if no watchlists exist yet
  // User can create watchlists later
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Badge Button */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          watchlistsWithSymbol.length > 0
            ? 'bg-primary/20 text-primary hover:bg-primary/30'
            : 'bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/20'
        }`}
        title={
          watchlistsWithSymbol.length > 0
            ? `In ${watchlistsWithSymbol.length} watchlist${watchlistsWithSymbol.length > 1 ? 's' : ''}`
            : 'Add to watchlist'
        }
      >
        <span>⭐</span>
        {watchlistsWithSymbol.length > 0 && (
          <span>{watchlistsWithSymbol.length}</span>
        )}
      </button>

      {/* Dropdown Menu - Fixed positioning to escape table stacking context */}
      {isOpen && (
        <div 
          className="fixed w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-[10000] max-h-64 overflow-y-auto"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
        >
          <div className="px-3 py-2 border-b border-gray-700 bg-gray-900">
            <div className="text-xs font-medium text-gray-400">
              Add {symbol} to watchlist
            </div>
          </div>

          <div className="py-1 bg-gray-900">
            {watchlists.map((watchlist) => {
              const isInWatchlist = watchlist.symbols.includes(symbol)
              
              return (
                <button
                  key={watchlist.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggle(watchlist.id, isInWatchlist)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  {/* Checkbox */}
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isInWatchlist
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground/50'
                    }`}
                  >
                    {isInWatchlist && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Icon */}
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: watchlist.color }}
                  >
                    {watchlist.icon}
                  </div>

                  {/* Name */}
                  <span className="text-sm text-white flex-1 truncate">
                    {watchlist.name}
                  </span>

                  {/* Count */}
                  <span className="text-xs text-gray-400">
                    {watchlist.symbols.length}
                  </span>
                </button>
              )
            })}
          </div>

          {watchlists.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-gray-400">
              <div className="mb-1">No watchlists yet</div>
              <div className="text-gray-500">Create one in the sidebar</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
