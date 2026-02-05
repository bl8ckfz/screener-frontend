import { useState, useEffect, useCallback } from 'react'

interface UseAutoHideHeaderOptions {
  /** Enable auto-hide behavior (default: true) */
  enabled?: boolean
  /** Scroll threshold in pixels before hiding (default: 5) */
  threshold?: number
  /** Delay in ms before hiding after scroll stops (default: 150) */
  hideDelay?: number
  /** Show header when at top of page (default: true) */
  showAtTop?: boolean
  /** Offset from top to consider "at top" (default: 50) */
  topOffset?: number
}

export function useAutoHideHeader({
  enabled = true,
  threshold = 5,
  hideDelay = 150,
  showAtTop = true,
  topOffset = 50,
}: UseAutoHideHeaderOptions = {}) {
  const [isVisible, setIsVisible] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)

  const handleScroll = useCallback(() => {
    if (!enabled) {
      setIsVisible(true)
      return
    }

    const currentScrollY = window.scrollY

    // Always show at top of page
    if (showAtTop && currentScrollY < topOffset) {
      setIsVisible(true)
      setLastScrollY(currentScrollY)
      return
    }

    // Ignore small scrolls (reduces flickering)
    const scrollDiff = Math.abs(currentScrollY - lastScrollY)
    if (scrollDiff < threshold) {
      return
    }

    // Show when scrolling up, hide when scrolling down
    const shouldShow = currentScrollY < lastScrollY

    setIsVisible(shouldShow)
    setLastScrollY(currentScrollY)
  }, [enabled, lastScrollY, threshold, showAtTop, topOffset])

  useEffect(() => {
    if (!enabled) {
      setIsVisible(true)
      return
    }

    // Debounced scroll handler
    let timeoutId: number | undefined

    const debouncedHandleScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(handleScroll, hideDelay)
    }

    window.addEventListener('scroll', debouncedHandleScroll, { passive: true })
    
    // Set initial scroll position
    setLastScrollY(window.scrollY)

    return () => {
      window.removeEventListener('scroll', debouncedHandleScroll)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [enabled, handleScroll, hideDelay])

  // Always show when hovered
  const shouldShow = !enabled || isVisible || isHovered

  return {
    /** Whether header should be visible */
    isVisible: shouldShow,
    /** Handler for mouse enter - pass to header */
    onMouseEnter: () => setIsHovered(true),
    /** Handler for mouse leave - pass to header */
    onMouseLeave: () => setIsHovered(false),
    /** Current scroll position */
    scrollY: lastScrollY,
  }
}
