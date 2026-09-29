/**
 * Says when a watchlist save failed.
 *
 * The star toggles optimistically and the store reverts it when the backend
 * refuses. Without this, that revert was the only signal — a star that
 * flipped back on its own, which reads as a bug rather than as "try again".
 */
import { useEffect } from 'react'
import { useStore } from '@/hooks/useStore'

const DISMISS_AFTER_MS = 6000

export function WatchlistErrorNotice() {
  const error = useStore((state) => state.watchlistError)
  const clear = useStore((state) => state.clearWatchlistError)

  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(clear, DISMISS_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [error, clear])

  if (!error) return null

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-lg border border-error-border bg-error-bg px-4 py-2.5 text-sm text-error-text shadow-lg"
    >
      <span>{error}</span>
      <button
        type="button"
        onClick={clear}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded hover:bg-white/10"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
