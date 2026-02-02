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
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open || !selectedCoin) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-label="Close chart drawer" />
      <div className="absolute inset-0 bg-gray-900 animate-in slide-in-from-bottom-6">
        {/* Header with drag handle */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
              aria-label="Close chart"
            >
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-white">
              {selectedCoin.symbol}
              <span className="text-gray-400 text-sm ml-2">/ {selectedCoin.pair}</span>
            </h2>
          </div>
        </div>
        
        {/* Scrollable content */}
        <div className="h-[calc(100vh-60px)] overflow-y-auto overscroll-contain">
          <ChartSection selectedCoin={selectedCoin} className="pb-safe" />
        </div>
      </div>
    </div>
  )
}
