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
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close chart drawer" />
      <div className="absolute bottom-0 left-0 right-0 h-[72vh] rounded-t-2xl bg-gray-900 border-t border-gray-700 shadow-2xl animate-in slide-in-from-bottom-6">
        <div className="flex items-center justify-center py-2">
          <span className="h-1.5 w-12 rounded-full bg-gray-600" />
        </div>
        <div className="h-[calc(72vh-24px)] overflow-hidden">
          <ChartSection selectedCoin={selectedCoin} onClose={onClose} className="h-full" />
        </div>
      </div>
    </div>
  )
}
