/**
 * Alert history must be idempotent in the alert's own id.
 *
 * The backend published every alert through both core NATS and JetStream on
 * one subject, and a JetStream publish is an ordinary publish that a stream
 * also captures — so the gateway's core subscriber received each alert twice
 * and forwarded both. addAlert pushed without checking, so users saw every
 * alert duplicated in their history.
 *
 * Fixed at the source. This keeps the list correct anyway: the id is derived
 * from the alert rather than generated, so a collision can only be the same
 * alert arriving again.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { alertHistoryService } from '@/services/alertHistoryService'
import type { Alert } from '@/types/alert'
import type { Coin } from '@/types/coin'

// Inside the retention window, or getHistory filters it out as old.
const now = Date.now()

const alert = {
  symbol: 'BTCUSDT',
  type: 'price_spike',
  timestamp: now,
  value: 5,
  threshold: 3,
} as unknown as Alert

const coin = { lastPrice: 42_000, priceChangePercent: 5 } as unknown as Coin

describe('alertHistoryService.addAlert', () => {
  beforeEach(() => {
    // tests/setup.ts stubs localStorage as a no-op — getItem always returns
    // null — so this service cannot be exercised through it. A real in-memory
    // one, local to this file, leaves the shared stub alone for everything else.
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    })
    alertHistoryService.clearHistory()
  })

  it('stores the same alert once, however many times it arrives', () => {
    alertHistoryService.addAlert(alert, coin)
    alertHistoryService.addAlert(alert, coin)
    alertHistoryService.addAlert(alert, coin)

    expect(alertHistoryService.getHistory()).toHaveLength(1)
  })

  it('still stores a genuinely different alert', () => {
    alertHistoryService.addAlert(alert, coin)
    alertHistoryService.addAlert({ ...alert, timestamp: now + 1000 } as Alert, coin)

    expect(alertHistoryService.getHistory()).toHaveLength(2)
  })
})
