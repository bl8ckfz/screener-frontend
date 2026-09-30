import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { InfoHint } from '@/components/ui/InfoHint'

/**
 * The hint must not be clipped by the table's overflow containers, which cut
 * off anything inside them regardless of z-index. So it renders on
 * document.body, placed against its badge and kept on screen.
 */

function rect(r: Partial<DOMRect>): DOMRect {
  const base = { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0 }
  return { ...base, ...r, toJSON: () => ({}) } as DOMRect
}

function renderInScroller(onRowClick = vi.fn()) {
  render(
    <div data-testid="scroller" style={{ overflow: 'auto' }}>
      <div onClick={onRowClick}>
        <InfoHint hint="As much agreement as this timeframe can carry">
          <span>HIGH</span>
        </InfoHint>
      </div>
    </div>,
  )
  return onRowClick
}

describe('InfoHint', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders outside the clipping container', () => {
    renderInScroller()
    fireEvent.click(screen.getByRole('button'))
    const tip = screen.getByRole('tooltip')
    expect(screen.getByTestId('scroller').contains(tip)).toBe(false)
    expect(tip.parentElement).toBe(document.body)
  })

  it('does not pass the tap on to the row', () => {
    const onRowClick = renderInScroller()
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('tooltip'))
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('flips above a badge near the bottom of the screen', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(60)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 770, bottom: 790, left: 100, right: 150 }),
    )
    renderInScroller()
    fireEvent.click(screen.getByRole('button'))
    // 770 - 4 gap - 60 height
    expect(screen.getByRole('tooltip').style.top).toBe('706px')
  })

  it('stays inside the viewport near the right edge', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 100, bottom: 120, left: 380, right: 398 }),
    )
    renderInScroller()
    fireEvent.click(screen.getByRole('button'))
    // 400 wide - 224 popover - 8 margin
    expect(screen.getByRole('tooltip').style.left).toBe('168px')
  })

  it('closes on an outside tap and when anything scrolls', () => {
    renderInScroller()
    fireEvent.click(screen.getByRole('button'))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.click(screen.getByRole('button'))
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
