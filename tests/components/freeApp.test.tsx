import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { FreeZonesResponse, SampleZone } from '@/types/free'
import type { LockedZone, UnlockedZone } from '@/types/publicDemo'

// The free view's contract, from the outside: a live zone shows no price, the
// sample shows its plan, and the page asks only the free endpoints. The chart
// is stubbed — lightweight-charts needs a canvas, and what it draws is
// DemoChart's concern, tested with the landing page.

const getFreeZones = vi.fn()
const getFreeRecord = vi.fn()
const getDigestPreference = vi.fn()
const setDigestPreference = vi.fn()
const trackFunnel = vi.fn()

vi.mock('@/services/backendApi', () => ({
  backendApi: {
    getFreeZones: () => getFreeZones(),
    getFreeRecord: (p: unknown) => getFreeRecord(p),
    getDigestPreference: () => getDigestPreference(),
    setDigestPreference: (on: boolean) => setDigestPreference(on),
    // Anything else would be a paid endpoint, and calling one is the bug.
    getDojoSetups: () => {
      throw new Error('the free view called a paid endpoint')
    },
  },
}))
vi.mock('@/services/funnel', () => ({ trackFunnel: (...a: unknown[]) => trackFunnel(...a) }))
vi.mock('@/components/landing/DemoChart', () => ({
  default: ({ zone }: { zone: { symbol: string } | null }) => <div data-testid="chart">{zone?.symbol}</div>,
}))

let authUser: { email: string; plan_activated_at?: string } = { email: 'free@example.test' }
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: authUser, isAuthenticated: true, logout: vi.fn() }),
}))

const base = {
  fired_at: '2026-11-10T00:02:00Z',
  timeframe: '1d',
  direction: 'long' as const,
  rule_type: 'futures_dojo_otz_long_1d',
  rr: 3.2,
  confluence_band: 'HIGH' as const,
  backings: [],
}

const locked: LockedZone = { ...base, id: 'live-1', symbol: 'SOLUSDT', outcome: 'unfilled', locked: true }

const sample: SampleZone = {
  ...base,
  id: 'sample-1',
  symbol: 'LINKUSDT',
  outcome: 'unfilled',
  locked: false,
  sample: true,
  trigger_price: 19.5,
  otz_low: 17.1,
  otz_high: 18.2,
  entry: 17.7777,
  stop_loss: 16.1111,
  tp1: 21.3333,
  tp2: 23.1,
  tp3: 25.4,
}

const stopped: UnlockedZone = {
  ...base,
  id: 'old-1',
  symbol: 'COMPUSDT',
  outcome: 'stopped',
  locked: false,
  trigger_price: 45,
  otz_low: 40,
  otz_high: 42,
  entry: 41.2525,
  stop_loss: 37.9,
  tp1: 52.1,
  tp2: 55,
  tp3: 60,
  entry_hit_at: '2026-10-20T10:00:00Z',
  sl_hit_at: '2026-10-22T10:00:00Z',
}

function zonesPayload(over: Partial<FreeZonesResponse> = {}): FreeZonesResponse {
  return {
    generated_at: '2026-11-12T00:30:00Z',
    live: [locked],
    sample,
    sample_chart: { symbol: 'LINKUSDT', price: 18.9, price_source: 'ticker', candles: [[1, 1, 2, 0.5, 1.5, 10]] },
    stats: { total: 318, waiting: 13, open: 26, target: 8, stopped: 22, invalidated: 249 },
    locked_fields: ['entry', 'stop_loss', 'tp1', 'tp2', 'tp3'],
    ...over,
  }
}

async function renderFreeApp() {
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
  const { FreeApp } = await import('@/pages/FreeApp')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FreeApp />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('the free view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser = { email: 'free@example.test' }
    getFreeZones.mockResolvedValue(zonesPayload())
    getFreeRecord.mockResolvedValue({ zones: [stopped], next_cursor: 'next-page' })
    getDigestPreference.mockResolvedValue({ digest: false })
    setDigestPreference.mockResolvedValue({ digest: true })
  })

  it('shows the sample with its plan and the live zones without a price', async () => {
    await renderFreeApp()

    // The sample: drawn, with its levels.
    expect((await screen.findByTestId('chart')).textContent).toBe('LINKUSDT')
    expect(screen.getAllByText(/17\.7777/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/16\.1111/).length).toBeGreaterThan(0)

    // The live zone: named, and locked. Its row has no number that could be a
    // level — only the R:R, which names no price.
    const row = screen.getByText('SOL').closest('tr')!
    expect(within(row).getByText('•••••')).toBeTruthy()
    expect(row.textContent).not.toMatch(/\d+\.\d{3,}/)
    expect(screen.getByText('Zones in play (1)')).toBeTruthy()
  })

  it('offers the plans from a locked row, and counts the click', async () => {
    const user = userEvent.setup()
    await renderFreeApp()

    await user.click((await screen.findByText('SOL')).closest('tr')!)
    const unlock = screen.getByRole('link', { name: 'Unlock the levels' })
    // The in-app plans page, not the anonymous checkout link: this account is
    // signed in, and checkout from /upgrade is tied to it.
    expect(unlock.getAttribute('href')).toBe('/upgrade')

    await user.click(unlock)
    expect(trackFunnel).toHaveBeenCalledWith('upgrade_click', { source: 'free_locked_row' })
  })

  it('says so when the week has no sample yet', async () => {
    getFreeZones.mockResolvedValue(zonesPayload({ sample: null, sample_chart: null }))
    await renderFreeApp()
    expect(await screen.findByText(/No sample yet this week/)).toBeTruthy()
    expect(screen.queryByTestId('chart')).toBeNull()
  })

  it('lists the record with its plans, filters it, and pages it', async () => {
    const user = userEvent.setup()
    await renderFreeApp()

    // A finished zone shows its entry in the row.
    expect(await screen.findByText('COMP')).toBeTruthy()
    expect(screen.getByText(/41\.25/)).toBeTruthy()
    expect(getFreeRecord).toHaveBeenLastCalledWith({ outcome: undefined, cursor: undefined })

    await user.click(screen.getByRole('button', { name: 'Show older zones' }))
    expect(getFreeRecord).toHaveBeenLastCalledWith({ outcome: undefined, cursor: 'next-page' })

    await user.click(screen.getByRole('button', { name: 'Stopped out' }))
    expect(getFreeRecord).toHaveBeenLastCalledWith({ outcome: 'stopped', cursor: undefined })
  })

  it('shows counts and never a rate', async () => {
    const { container } = await renderFreeApp()
    const retired = await screen.findByText('249')
    // The counts themselves carry no percentage (the plan above them does:
    // a stop distance is a fact about one plan, not a rate of success).
    expect(retired.closest('dl')!.textContent).not.toContain('%')
    expect(container.textContent).not.toMatch(/\b(win|hit|success) rate\b/i)
  })

  it('switches the daily email on', async () => {
    const user = userEvent.setup()
    await renderFreeApp()

    const sw = await screen.findByRole('switch', { name: 'Daily scan by email' })
    await vi.waitFor(() => expect(sw.hasAttribute('disabled')).toBe(false))
    expect(sw.getAttribute('aria-checked')).toBe('false')

    await user.click(sw)
    expect(setDigestPreference).toHaveBeenCalledWith(true)
    await vi.waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'))
  })

  it('tells a lapsed subscriber why they are here', async () => {
    authUser = { email: 'was-paying@example.test', plan_activated_at: '2026-09-01T00:00:00Z' }
    await renderFreeApp()
    expect(await screen.findByText(/Your subscription has ended/)).toBeTruthy()
  })

  it('does not show that line to an account that never paid', async () => {
    await renderFreeApp()
    await screen.findByText('Zones in play (1)')
    expect(screen.queryByText(/Your subscription has ended/)).toBeNull()
  })
})
