/**
 * Bubble Stream Hook
 * 
 * Backend will detect bubbles and send via WebSocket when implemented
 * For now, returns empty array since bubble detection is not yet available
 */

import { useState, useEffect } from 'react'
import type { Bubble } from '@/types/bubble'

export function useBubbleStream(_enabled: boolean = true) {
  const [bubbles] = useState<Bubble[]>([])
  const [isConnected] = useState(false)

  useEffect(() => {
    // Backend bubble detection not yet implemented
    console.debug('Bubble detection not yet implemented in backend')
  }, [])

  return {
    bubbles,
    isConnected,
  }
}
