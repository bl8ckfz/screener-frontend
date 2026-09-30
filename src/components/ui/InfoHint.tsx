/**
 * Makes an element's explanation reachable by tap, not only by hover.
 *
 * The tables explain their badges through `title`, which a touch screen never
 * shows — so on a phone "Retired" or "MEDIUM" was a label with no way to ask
 * what it meant. Wrapping the badge keeps the hover for desktop and adds a
 * tap-to-show popover for everyone else.
 *
 * The tap is stopped from reaching the row: rows expand on click, and asking
 * what a badge means should not also open the plan.
 *
 * WHY A PORTAL
 *
 * The popover used to be absolutely positioned inside the badge. The tables
 * sit in overflow containers (the horizontal table scroller, the tab's
 * vertical scroller), and overflow clips descendants regardless of z-index —
 * so a hint on a row near an edge was cut off. It is now rendered on
 * document.body with fixed coordinates taken from the badge, flipped above it
 * when there is no room below, and kept inside the viewport horizontally.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface InfoHintProps {
  hint: string
  children: ReactNode
  /** Which side of the badge the popover anchors to. */
  align?: 'left' | 'right'
}

/** Matches w-56. */
const POPOVER_WIDTH = 224
const GAP = 4
const MARGIN = 8

export function InfoHint({ hint, children, align = 'left' }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLSpanElement>(null)

  // Place the popover against the badge. Runs as a layout effect, after the
  // popover is in the DOM (laid out, but hidden) and before paint — so the
  // flip uses its real height, which depends on the hint's length.
  const place = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const r = anchor.getBoundingClientRect()
    const height = popoverRef.current?.offsetHeight ?? 0
    const vw = window.innerWidth
    const vh = window.innerHeight

    const preferredLeft = align === 'right' ? r.right - POPOVER_WIDTH : r.left
    const left = Math.min(Math.max(preferredLeft, MARGIN), vw - POPOVER_WIDTH - MARGIN)

    const below = r.bottom + GAP
    const above = r.top - GAP - height
    const top = below + height > vh - MARGIN && above >= MARGIN ? above : below

    setPos({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || popoverRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Fixed coordinates go stale when anything scrolls, so close rather than
    // leave the hint floating away from its badge.
    const onMove = () => setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  return (
    <span ref={anchorRef} className="inline-flex">
      <button
        type="button"
        title={hint}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="inline-flex cursor-help rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {children}
      </button>
      {open &&
        createPortal(
          <span
            ref={popoverRef}
            role="tooltip"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width: POPOVER_WIDTH,
              // Hidden until placed, so it never flashes at the corner.
              visibility: pos ? 'visible' : 'hidden',
            }}
            className="z-[70] whitespace-normal rounded border border-gray-600 bg-gray-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-gray-200 shadow-lg"
          >
            {hint}
          </span>,
          document.body,
        )}
    </span>
  )
}
