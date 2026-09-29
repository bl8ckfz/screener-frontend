import { useEffect } from 'react'
import type { Coin } from '@/types/coin'
import { ChartSection } from './ChartSection'
import { DOJO_OUTCOME_META, distanceToEntry, type DojoSetup } from '@/types/dojo'

interface MobileCoinDrawerProps {
  open: boolean
  selectedCoin: Coin | null
  /** Dojo zone to overlay, when opened from the Dojo tab. */
  dojoSetup?: DojoSetup | null
  onClose: () => void
}

// Sheet for widths below lg (phones and tablets) that presents the plan (when one is open), the chart and
// the alert timeline — the plan first, since it is what the user tapped for.
export function MobileCoinDrawer({ open, selectedCoin, dojoSetup = null, onClose }: MobileCoinDrawerProps) {
  useEffect(() => {
    if (!open) return
    
    // Prevent body scroll and scroll drawer to top
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    
    // Scroll to top when drawer opens
    setTimeout(() => {
      const scrollContainer = document.querySelector('.mobile-drawer-scroll')
      if (scrollContainer) {
        scrollContainer.scrollTop = 0
      }
    }, 0)
    
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open || !selectedCoin) return null

  // The plan's standing, pinned in the header so it stays visible while the
  // plan and chart scroll beneath it.
  const dist = dojoSetup
    ? distanceToEntry(dojoSetup, selectedCoin.isPlaceholder ? undefined : selectedCoin.lastPrice)
    : null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" style={{ maxWidth: '100vw' }}>
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-label="Close chart drawer" />
      <div className="absolute inset-0 bg-gray-900 animate-in slide-in-from-bottom-6 overflow-hidden" style={{ maxWidth: '100vw' }}>
        {/* Header with drag handle */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-1.5 py-1.5 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 min-h-[52px] w-full" style={{ maxWidth: '100vw', boxSizing: 'border-box' }}>
          <div className="flex items-center gap-2 min-w-0 flex-1 pl-1.5">
            <span className="text-sm font-semibold text-white truncate">
              {selectedCoin.symbol}
            </span>
            {dojoSetup ? (
              <>
                <span className={`text-xs font-medium ${dojoSetup.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                  {dojoSetup.direction === 'long' ? 'Long' : 'Short'} {dojoSetup.timeframe.toUpperCase()}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${DOJO_OUTCOME_META[dojoSetup.outcome].className}`}>
                  {DOJO_OUTCOME_META[dojoSetup.outcome].label}
                </span>
                {dojoSetup.outcome === 'unfilled' && dist !== null && (
                  <span className="text-xs font-mono text-gray-300 whitespace-nowrap">
                    {Math.abs(dist).toFixed(1)}% away
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-400 text-xs flex-shrink-0">{selectedCoin.pair}</span>
            )}
          </div>
          <button
            onClick={onClose}
            // 40px square: the old p-1 around a 14px icon was a ~22px target,
            // well under what a thumb can hit reliably.
            className="h-10 w-10 flex items-center justify-center rounded bg-red-600 hover:bg-red-700 transition-colors flex-shrink-0 ml-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Scrollable content */}
        <div className="mobile-drawer-scroll h-[calc(100vh-52px)] overflow-y-auto overscroll-contain w-full" style={{ maxWidth: '100vw', boxSizing: 'border-box' }}>
          <ChartSection selectedCoin={selectedCoin} dojoSetup={dojoSetup} hideHeader className="pb-safe" />
        </div>
      </div>
    </div>
  )
}
