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
  maxAgeMinutes?: number // Max age in minutes before cleanup (default: 30)
  symbolFilter?: string // Only track bubbles for specific symbol
  enabled?: boolean     // Enable/disable bubble tracking (default: true)
}

export function useBubbleStream(options: UseBubbleStreamOptions = {}) {
  const { maxHistory = 1000, maxAgeMinutes = 30, symbolFilter, enabled = true } = options
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

    // Initialize with existing bubbles (if stream manager tracks them)
    if (streamManager.getBubbles && typeof streamManager.getBubbles === 'function') {
      const existingBubbles = streamManager.getBubbles()
      if (existingBubbles && existingBubbles.length > 0) {
        const filtered = symbolFilter 
          ? existingBubbles.filter((b: Bubble) => b.symbol === symbolFilter)
          : existingBubbles
        console.log(`🫧 useBubbleStream: Initialized with ${filtered.length} existing bubbles for ${symbolFilter || 'all'}`)
        setBubbles(filtered.slice(-maxHistory))
      }
    }

    const handleBubble = (bubble: Bubble) => {
      // Filter by symbol if specified
      if (symbolFilter && bubble.symbol !== symbolFilter) {
        return
      }

      console.log(`🫧 useBubbleStream: Received bubble for ${bubble.symbol} (filter=${symbolFilter})`, bubble)

      setBubbles(prev => {
        // Filter out bubbles older than maxAgeMinutes
        const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000)
        const recentBubbles = prev.filter(b => b.time >= cutoffTime)
        
        const updated = [...recentBubbles, bubble]
        // Keep only recent bubbles by count
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
  }, [maxHistory, maxAgeMinutes, symbolFilter, enabled])

  // Periodic cleanup of old bubbles (runs every minute)
  useEffect(() => {
    if (!enabled || bubbles.length === 0) return

    const cleanupInterval = setInterval(() => {
      const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000)
      setBubbles(prev => {
        const filtered = prev.filter(b => b.time >= cutoffTime)
        if (filtered.length < prev.length) {
          console.log(`🧹 useBubbleStream: Cleaned up ${prev.length - filtered.length} old bubbles (older than ${maxAgeMinutes}m)`)
        }
        return filtered
      })
    }, 60000) // Run every minute

    return () => clearInterval(cleanupInterval)
  }, [enabled, maxAgeMinutes, bubbles.length])

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
