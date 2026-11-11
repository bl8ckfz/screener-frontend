import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { trackFunnel } from '@/services/funnel'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial))
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string)
}

describe('funnel events', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', memoryStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the event to the public endpoint without credentials', () => {
    trackFunnel('cta_click', { plan: 'screener_monthly', source: 'pricing' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/public\/event$/)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('omit')
    // A CTA click navigates away; without keepalive the count is cancelled.
    expect(init.keepalive).toBe(true)
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(sentBody(fetchMock)).toMatchObject({
      event: 'cta_click',
      plan: 'screener_monthly',
      source: 'pricing',
    })
  })

  // The verify page's URL carries the email token.
  it('sends the path without its query string', () => {
    window.history.replaceState({}, '', '/verify-email?token=secret')
    trackFunnel('signup_verified')
    expect(sentBody(fetchMock).path).toBe('/verify-email')
    expect(fetchMock.mock.calls[0][1].body).not.toContain('secret')
    window.history.replaceState({}, '', '/')
  })

  it('adds the campaign tags of the ad click, and not the click id', () => {
    vi.stubGlobal(
      'localStorage',
      memoryStorage({
        cs_attribution: JSON.stringify({
          utm_source: 'x',
          utm_campaign: 'x_test1_t1',
          utm_content: 'a1',
          twclid: 'abc',
          landing: '/start',
          captured_at: new Date().toISOString(),
        }),
      }),
    )
    trackFunnel('landing_view')
    expect(sentBody(fetchMock).attribution).toEqual({
      utm_source: 'x',
      utm_campaign: 'x_test1_t1',
      utm_content: 'a1',
    })
  })

  it('never throws or rejects when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    expect(() => trackFunnel('landing_view')).not.toThrow()

    vi.stubGlobal('fetch', () => {
      throw new Error('no fetch')
    })
    expect(() => trackFunnel('landing_view')).not.toThrow()
    // Let the rejected promise settle; an unhandled rejection fails the run.
    await Promise.resolve()
  })
})
