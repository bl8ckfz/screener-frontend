/**
 * Hook to detect price changes and trigger flash animations
 * 
 * Usage:
 * const flash = usePriceFlash(coin.lastPrice)
 * <div className={flash}>...</div>
 */

import { useEffect, useRef, useState } from 'react'

type FlashDirection = 'up' | 'down' | ''

export function usePriceFlash(price: number): string {
  const prevPriceRef = useRef(price)
  const [flash, setFlash] = useState<FlashDirection>('')

  useEffect(() => {
    const prevPrice = prevPriceRef.current
    
    if (price > prevPrice) {
      setFlash('up')
      prevPriceRef.current = price
      const timeout = setTimeout(() => setFlash(''), 500)
      return () => clearTimeout(timeout)
    } else if (price < prevPrice) {
      setFlash('down')
      prevPriceRef.current = price
      const timeout = setTimeout(() => setFlash(''), 500)
      return () => clearTimeout(timeout)
    }
  }, [price])

  const flashClass = flash === 'up' 
    ? 'animate-flash-green'
    : flash === 'down'
    ? 'animate-flash-red'
    : ''

  return flashClass
}
