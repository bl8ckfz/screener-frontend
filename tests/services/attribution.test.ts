import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { captureAttribution, getAttribution, utmParams } from '@/services/attribution'

// The global setup mocks localStorage as a no-op; these tests need it to hold
// what is written.
function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
}

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.parse('2026-11-08T12:00:00Z')

function visit(search: string, pathname = '/start', referrer = '', now = T0) {
  captureAttribution({ search, pathname, host: 'coin-sniffer.com' }, referrer, now)
}

describe('campaign attribution', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('records an ad click with its landing path and the linking site', () => {
    visit('?utm_source=x&utm_campaign=x_test1_t1&utm_content=a1&twclid=abc', '/start', 'https://t.co/xyz')
    expect(getAttribution(T0)).toEqual({
      utm_source: 'x',
      utm_campaign: 'x_test1_t1',
      utm_content: 'a1',
      twclid: 'abc',
      landing: '/start',
      referrer: 't.co',
      captured_at: '2026-11-08T12:00:00.000Z',
    })
  })

  // An organic visit carries no tags. Recording it would be harmless on its
  // own, but as first-touch it would block the ad click that follows.
  it('ignores visits without campaign tags', () => {
    visit('?a=record&foo=bar')
    expect(getAttribution(T0)).toBeNull()
  })

  it('keeps the first click while it is fresh, so a second ad does not take the credit', () => {
    visit('?utm_source=x&utm_content=a1')
    visit('?utm_source=telegram&utm_content=channel', '/start', '', T0 + 2 * DAY)
    expect(getAttribution(T0 + 2 * DAY)?.utm_content).toBe('a1')
  })

  it('lets a new click replace one older than 30 days', () => {
    visit('?utm_source=x&utm_content=a1')
    expect(getAttribution(T0 + 31 * DAY)).toBeNull()
    visit('?utm_source=telegram', '/start', '', T0 + 31 * DAY)
    expect(getAttribution(T0 + 31 * DAY)?.utm_source).toBe('telegram')
  })

  it('caps values and strips control characters before they reach the backend', () => {
    visit(`?utm_content=${'a'.repeat(300)}&utm_term=bad%0Avalue`)
    const a = getAttribution(T0)!
    expect(a.utm_content).toHaveLength(100)
    expect(a.utm_term).toBe('badvalue')
  })

  it('does not record our own site as the referrer', () => {
    visit('?utm_source=x', '/start', 'https://coin-sniffer.com/')
    expect(getAttribution(T0)?.referrer).toBeUndefined()
  })

  it('treats unreadable storage as no attribution', () => {
    localStorage.setItem('cs_attribution', '{not json')
    expect(getAttribution(T0)).toBeNull()
  })

  // Click ids are ours; only UTM tags go out on links that leave the site.
  it('hands only UTM tags to outgoing links', () => {
    visit('?utm_source=x&utm_medium=paid&twclid=abc&fbclid=def')
    expect(utmParams(T0)).toEqual([
      ['utm_source', 'x'],
      ['utm_medium', 'paid'],
    ])
  })
})

describe('checkout link', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubEnv('VITE_WHOP_CHECKOUT_SCREENER_MONTHLY', 'https://whop.com/checkout/plan_test')
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('carries the section and the campaign tags to Whop', async () => {
    const { captureAttribution: capture } = await import('@/services/attribution')
    capture({ search: '?utm_source=x&utm_content=a1', pathname: '/start', host: 'coin-sniffer.com' }, '')
    const { checkoutUrl } = await import('@/config/checkout')
    expect(checkoutUrl('screener_monthly', 'start')).toBe(
      'https://whop.com/checkout/plan_test?source=start&utm_source=x&utm_content=a1',
    )
  })

  it('is unchanged for a visitor with no campaign tags', async () => {
    const { checkoutUrl } = await import('@/config/checkout')
    expect(checkoutUrl('screener_monthly', 'hero')).toBe(
      'https://whop.com/checkout/plan_test?source=hero',
    )
  })
})
