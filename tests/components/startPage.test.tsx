import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// The layout below the hero is the shared landing argument, tested with `/`;
// here only the ad-specific opening matters, without auth or demo fetches.
vi.mock('@/components/landing/LandingLayout', () => ({
  LandingLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

async function renderAt(url: string) {
  const { StartPage } = await import('@/pages/StartPage')
  return render(
    <MemoryRouter initialEntries={[url]}>
      <StartPage />
    </MemoryRouter>,
  )
}

describe('/start ad landing page', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_WHOP_CHECKOUT_SCREENER_MONTHLY', 'https://whop.com/checkout/plan_test')
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('opens with the hero of the ad that was clicked', async () => {
    const { START_HEROES } = await import('@/config/startHeroes')
    await renderAt('/start?a=record')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(START_HEROES.record.title)
  })

  it('falls back to the scan hero for a missing or unknown angle', async () => {
    const { START_HEROES, startAngle } = await import('@/config/startHeroes')
    expect(startAngle(null)).toBe('scan')
    expect(startAngle('<script>')).toBe('scan')
    await renderAt('/start?a=nope')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(START_HEROES.scan.title)
  })

  // Checkout source 'start' is how Whop's data tells ad traffic from the
  // homepage's hero button.
  it('sends the trial button to Whop tagged as the ad page', async () => {
    await renderAt('/start?a=learn')
    const cta = screen.getByRole('link', { name: /free trial/i })
    expect(cta.getAttribute('href')).toBe('https://whop.com/checkout/plan_test?source=start')
  })

  it('keeps the same-email rule and the risk line next to the button', async () => {
    await renderAt('/start')
    expect(screen.getByText(/use the same email/i)).toBeInTheDocument()
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument()
  })

  // Ad review reads the landing page too. The words the ads may not use must
  // not appear in this page's own copy either.
  it('uses none of the words the ad rules ban', async () => {
    const { START_HEROES } = await import('@/config/startHeroes')
    const { container } = await renderAt('/start')
    const copy = [
      ...Object.values(START_HEROES).flatMap((h) => [h.title, h.body]),
      container.textContent ?? '',
    ].join(' ')
    for (const banned of [/profit/i, /win rate/i, /%/, /signal/i, /vip access/i, /guarantee/i, /binance/i, /returns?\b/i]) {
      expect(copy, `banned wording ${banned}`).not.toMatch(banned)
    }
  })
})
