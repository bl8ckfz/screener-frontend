import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchKlines, ExchangeUnavailableError, RateLimitError } from '@/services/chartData'

/**
 * On 2026-10-14 Binance geo-blocked the gateway and every chart read
 * "Backend API error: 451". A refusal must surface as a waiting state the UI
 * can word, never as a raw status, and must not be confused with rate limits.
 */
function respond(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers(headers),
    json: async () => body,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchKlines errors', () => {
  it('reads the gateway\'s upstream_unavailable 503 as the exchange being unavailable', async () => {
    respond(503, { error: 'upstream_unavailable', message: 'Exchange data temporarily unavailable' })
    const err = await fetchKlines('BTCUSDT', '1m').catch((e) => e)
    expect(err).toBeInstanceOf(ExchangeUnavailableError)
    // Still a RateLimitError, so every caller keeps its wait-and-retry.
    expect(err).toBeInstanceOf(RateLimitError)
    expect(err.message).toMatch(/temporarily unavailable/)
  })

  it('reads a 451 straight from the exchange the same way', async () => {
    respond(451)
    await expect(fetchKlines('BTCUSDT', '1m')).rejects.toBeInstanceOf(ExchangeUnavailableError)
  })

  it('keeps any other 503 a rate limit, honouring Retry-After', async () => {
    respond(503, { error: 'upstream_rate_limited' }, { 'Retry-After': '42' })
    const err = await fetchKlines('BTCUSDT', '1m').catch((e) => e)
    expect(err).toBeInstanceOf(RateLimitError)
    expect(err).not.toBeInstanceOf(ExchangeUnavailableError)
    expect(err.retryAfterMs).toBe(42_000)
  })

  it('keeps a 503 without a JSON body a rate limit', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: '503',
      headers: new Headers(),
      json: async () => {
        throw new SyntaxError('not json')
      },
    })
    const err = await fetchKlines('BTCUSDT', '1m').catch((e) => e)
    expect(err).toBeInstanceOf(RateLimitError)
    expect(err).not.toBeInstanceOf(ExchangeUnavailableError)
  })

  // Our gateway answers 403 for "subscription required". That is not the
  // exchange being down, and must not be worded as if it were.
  it('does not treat a 403 as the exchange being unavailable', async () => {
    respond(403, { error: 'subscription_required' })
    const err = await fetchKlines('BTCUSDT', '1m').catch((e) => e)
    expect(err).not.toBeInstanceOf(RateLimitError)
  })
})
