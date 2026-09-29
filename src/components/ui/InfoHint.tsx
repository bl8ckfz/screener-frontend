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
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface InfoHintProps {
  hint: string
  children: ReactNode
  /** Which side of the badge the popover anchors to. */
  align?: 'left' | 'right'
}

export function InfoHint({ hint, children, align = 'left' }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex">
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
      {open && (
        <span
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full z-30 mt-1 w-56 whitespace-normal rounded border border-gray-600 bg-gray-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-gray-200 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {hint}
        </span>
      )}
    </span>
  )
}
