import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/hooks/useStore'
import { WatchlistManager } from './WatchlistManager'

export function WatchlistSelector() {
  const { watchlists, currentWatchlistId, setCurrentWatchlist } = useStore()
  const [showManager, setShowManager] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  const selectedWatchlist = watchlists.find((wl) => wl.id === currentWatchlistId)

  const handleSelect = (watchlistId: string | null) => {
    setCurrentWatchlist(watchlistId)
    setIsOpen(false)
  }

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (showManager) {
    return (
      <div className="p-3 bg-surface-dark rounded-lg border border-border">
        <WatchlistManager onClose={() => setShowManager(false)} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <label className="text-sm font-medium text-text-secondary">
          Watchlist
        </label>
        <button
          onClick={() => setShowManager(true)}
          className="text-xs text-accent hover:text-accent-light transition-colors"
          title="Manage Watchlists"
        >
          Manage
        </button>
      </div>

      {/* Dropdown */}
      <div>
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-hover transition-colors"
        >
          {selectedWatchlist ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: selectedWatchlist.color }}
              >
                {selectedWatchlist.icon}
              </div>
              <span className="text-sm text-text-primary truncate">
                {selectedWatchlist.name}
              </span>
              <span className="text-xs text-text-secondary ml-auto">
                ({selectedWatchlist.symbols.length})
              </span>
            </div>
          ) : (
            <span className="text-sm text-text-secondary">All Coins</span>
          )}
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && createPortal(
          <div 
            ref={dropdownRef}
            className="bg-surface-dark border border-border rounded-lg shadow-lg z-[10000] max-h-64 overflow-y-auto"
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
              {/* All Coins Option */}
              <button
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface transition-colors ${
                  !currentWatchlistId ? 'bg-surface' : ''
                }`}
              >
                <div className="w-6 h-6 rounded flex items-center justify-center bg-neutral text-sm">
                  📋
                </div>
                <span className="text-sm text-text-primary flex-1">All Coins</span>
              </button>

              {/* Divider */}
              {watchlists.length > 0 && (
                <div className="border-t border-border my-1" />
              )}

              {/* Watchlist Options */}
              {watchlists.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-text-secondary">
                  <p>No watchlists yet</p>
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      setShowManager(true)
                    }}
                    className="mt-2 text-accent hover:text-accent-light transition-colors"
                  >
                    Create one
                  </button>
                </div>
              ) : (
                watchlists.map((watchlist) => (
                  <button
                    key={watchlist.id}
                    onClick={() => handleSelect(watchlist.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface transition-colors ${
                      currentWatchlistId === watchlist.id ? 'bg-surface' : ''
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-sm flex-shrink-0"
                      style={{ backgroundColor: watchlist.color }}
                    >
                      {watchlist.icon}
                    </div>
                    <span className="text-sm text-text-primary flex-1 truncate">
                      {watchlist.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {watchlist.symbols.length}
                    </span>
                  </button>
                ))
              )}
          </div>,
          document.body
        )}
      </div>

      {/* Active Watchlist Info */}
      {selectedWatchlist && selectedWatchlist.symbols.length > 0 && (
        <div className="px-3 py-2 bg-surface-dark rounded border border-border">
          <div className="text-xs text-text-secondary">
            Watching: {selectedWatchlist.symbols.slice(0, 3).join(', ')}
            {selectedWatchlist.symbols.length > 3 && (
              <span> +{selectedWatchlist.symbols.length - 3} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
