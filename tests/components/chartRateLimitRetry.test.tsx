import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Coin } from '@/types/coin'

/**
 * A rate-limited chart must come back on its own.
 *
 * The wait was enforced but nothing ended it: after "will retry in 60s" the
 * next request was whatever the schedule sent next — the five-minute resync
 * on 1h and 4h — so one refused request kept the error up for minutes.
 */

const fetchKlines = vi.fn()

vi.mock('@/services/chartData', async () => {
  const actual = await vi.importActual<typeof import('@/services/chartData')>('@/services/chartData')
  return { ...actual, fetchKlines: (...args: unknown[]) => fetchKlines(...args) }
})
vi.mock('@/services/backendApi', () => ({ USE_BACKEND_API: false }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ hasPlanDetails: false }) }))
vi.mock('@/hooks/useAlertRules', () => ({ useAlertRules: () => ({ isRuleEnabled: () => true }) }))
vi.mock('@/hooks/useStore', () => ({
  useStore: (select: (s: unknown) => unknown) => select({ activeAlerts: [], alertHistoryRefresh: 0 }),
}))
vi.mock('@/components/coin/TradingChart', () => ({ TradingChart: () => <div data-testid="chart" /> }))
vi.mock('@/components/coin/AlertTimelineChart', () => ({ AlertTimelineChart: () => null }))

const coin = {
  id: 'BTC',
  symbol: 'BTC',
  fullSymbol: 'BTCUSDT',
  pair: 'USDT',
  lastPrice: 100,
  priceChangePercent: 1,
} as unknown as Coin

async function renderChart() {
  const { ChartSection } = await import('@/components/coin/ChartSection')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ChartSection selectedCoin={coin} />
    </QueryClientProvider>,
  )
}

describe('ChartSection rate-limit retry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    fetchKlines.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down, then reloads by itself when the wait ends', async () => {
    const { RateLimitError } = await import('@/services/chartData')
    fetchKlines
      .mockRejectedValueOnce(new RateLimitError(5_000))
      .mockResolvedValue({ candles: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }], source: 'live' })

    await renderChart()
    await act(async () => {})

    expect(fetchKlines).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/retrying in 5s/i)).toBeTruthy()
    // Nothing to press: the button that did nothing during the wait is gone.
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })
    expect(screen.getByText(/retrying in 3s/i)).toBeTruthy()
    expect(fetchKlines).toHaveBeenCalledTimes(1)

    // Past the deadline plus the largest jitter.
    await act(async () => {
      vi.advanceTimersByTime(5_000)
    })
    expect(fetchKlines).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/retrying/i)).toBeNull()
    expect(screen.getByTestId('chart')).toBeTruthy()
  })

  it('keeps a working Try again for other failures', async () => {
    fetchKlines
      .mockRejectedValueOnce(new Error('Backend API error: 502'))
      .mockResolvedValue({ candles: [], source: 'live' })

    await renderChart()
    await act(async () => {})

    const button = screen.getByRole('button', { name: /try again/i })
    await act(async () => {
      button.click()
    })
    expect(fetchKlines).toHaveBeenCalledTimes(2)
  })
})
