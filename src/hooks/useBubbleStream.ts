/**
 * useBubbleStream Hook
 * 
 * Listens to bubble detection events from Stream1mManager
 * Maintains recent bubble history for chart overlay and analysis
 */

import { useEffect, useState, useCallback } from 'react'
import type { Bubble } from '@/types/bubble'

interface UseBubbleStreamOptions {
  maxHistory?: number  // Max bubbles to keep in memory (default: 1000)
  symbolFilter?: string // Only track bubbles for specific symbol
  enabled?: boolean     // Enable/disable bubble tracking (default: true)
}

export function useBubbleStream(options: UseBubbleStreamOptions = {}) {
  const { maxHistory = 1000, symbolFilter, enabled = true } = options
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    // Get stream manager instance from window (set by main app)
    const streamManager = (window as any).__streamManager
    if (!streamManager) {
      console.warn('Stream manager not available for bubble tracking')
      return
    }

    const handleBubble = (bubble: Bubble) => {
      // Filter by symbol if specified
      if (symbolFilter && bubble.symbol !== symbolFilter) {
        return
      }

      setBubbles(prev => {
        const updated = [...prev, bubble]
        // Keep only recent bubbles
        if (updated.length > maxHistory) {
          return updated.slice(-maxHistory)
        }
        return updated
      })
    }

    const handleStarted = () => setIsActive(true)
    const handleStopped = () => setIsActive(false)

    // Subscribe to events
    streamManager.on('bubble', handleBubble)
    streamManager.on('started', handleStarted)
    streamManager.on('stopped', handleStopped)

    // Set initial active state
    setIsActive(streamManager.isActive())

    return () => {
      streamManager.off('bubble', handleBubble)
      streamManager.off('started', handleStarted)
      streamManager.off('stopped', handleStopped)
    }
  }, [maxHistory, symbolFilter, enabled])

  const clearBubbles = useCallback(() => {
    setBubbles([])
  }, [])

  const getBubblesForSymbol = useCallback((symbol: string) => {
    return bubbles.filter(b => b.symbol === symbol)
  }, [bubbles])

  const getBubblesInTimeRange = useCallback((startTime: number, endTime: number) => {
    return bubbles.filter(b => b.time >= startTime && b.time <= endTime)
  }, [bubbles])

  const getBubblesByTimeframe = useCallback((timeframe: '5m' | '15m') => {
    return bubbles.filter(b => b.timeframe === timeframe)
  }, [bubbles])

  const getBubblesBySize = useCallback((size: 'small' | 'medium' | 'large') => {
    return bubbles.filter(b => b.size === size)
  }, [bubbles])

  const getBubblesBySide = useCallback((side: 'buy' | 'sell') => {
    return bubbles.filter(b => b.side === side)
  }, [bubbles])

  return {
    bubbles,
    isActive,
    clearBubbles,
    getBubblesForSymbol,
    getBubblesInTimeRange,
    getBubblesByTimeframe,
    getBubblesBySize,
    getBubblesBySide,
  }
}
