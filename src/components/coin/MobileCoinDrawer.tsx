import { useEffect } from 'react'
import type { Coin } from '@/types/coin'
import { ChartSection } from './ChartSection'

interface MobileCoinDrawerProps {
  open: boolean
  selectedCoin: Coin | null
  onClose: () => void
}

// Mobile-only bottom sheet that presents the chart and alert timeline
export function MobileCoinDrawer({ open, selectedCoin, onClose }: MobileCoinDrawerProps) {
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

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-label="Close chart drawer" />
      <div className="absolute inset-0 bg-gray-900 animate-in slide-in-from-bottom-6 overflow-hidden">
        {/* Header with drag handle */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-1.5 py-1.5 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 min-h-[40px] max-w-full overflow-hidden">
          <h2 className="text-[11px] font-semibold text-white truncate flex-1 mr-1">
            {selectedCoin.symbol}<span className="text-gray-400 text-[9px]">{selectedCoin.pair}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded bg-red-600 hover:bg-red-700 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Scrollable content */}
        <div className="mobile-drawer-scroll h-[calc(100vh-40px)] overflow-y-auto overscroll-contain w-full max-w-full">
          <ChartSection selectedCoin={selectedCoin} className="pb-safe" />
        </div>
      </div>
    </div>
  )
}
