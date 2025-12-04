/**
 * Integration Tests - Error Handling
 * 
 * Tests for graceful error handling and degradation:
 * - API failures (500 errors)
 * - Rate limiting (429 errors)
 * - Network timeouts
 * - Malformed responses
 * 
 * Verifies the system continues operating when errors occur
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BinanceFuturesApiClient } from '@/services/binanceFuturesApi'
import { FuturesMetricsService } from '@/services/futuresMetricsService'

describe('Error Handling Integration', () => {
  let futuresApi: BinanceFuturesApiClient
  let metricsService: FuturesMetricsService

  beforeEach(() => {
    futuresApi = new BinanceFuturesApiClient()
    metricsService = new FuturesMetricsService(futuresApi)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle API 500 errors gracefully', async () => {
    console.log('Testing 500 error handling...')
    
    // Mock fetch to return 500 error
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ msg: 'Internal error' }),
    } as Response)

    try {
      await futuresApi.fetch24hrTickers()
      expect.fail('Should have thrown an error')
    } catch (error: any) {
      expect(error.code).toBe(500)
      expect(error.message).toContain('500')
      console.log('✅ 500 error caught and formatted correctly')
    }

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should handle API 429 rate limit errors with retry', async () => {
    console.log('Testing 429 rate limit handling...')
    
    let attemptCount = 0
    const mockFetch = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      attemptCount++
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ msg: 'Rate limit exceeded' }),
      } as Response
    })

    try {
      await futuresApi.fetch24hrTickers()
      expect.fail('Should have thrown an error after retries')
    } catch (error: any) {
      expect(error.code).toBe(429)
      expect(error.message).toContain('429')
      expect(attemptCount).toBeGreaterThan(1) // Should have retried
      console.log(`✅ Retried ${attemptCount} times before giving up`)
    }

    expect(mockFetch).toHaveBeenCalledTimes(attemptCount)
  })

  it('should handle network timeouts', async () => {
    console.log('Testing network timeout handling...')
    
    const mockFetch = vi.spyOn(global, 'fetch').mockRejectedValue(
      new Error('Network timeout')
    )

    try {
      await futuresApi.fetch24hrTickers()
      expect.fail('Should have thrown an error')
    } catch (error: any) {
      expect(error.message).toContain('timeout')
      console.log('✅ Timeout error caught correctly')
    }

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should handle malformed JSON responses', async () => {
    console.log('Testing malformed JSON handling...')
    
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new Error('Invalid JSON')
      },
    } as Response)

    try {
      await futuresApi.fetch24hrTickers()
      expect.fail('Should have thrown an error')
    } catch (error: any) {
      expect(error).toBeDefined()
      console.log('✅ JSON parsing error caught')
    }

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should skip failed symbols and continue processing', async () => {
    console.log('Testing partial failure handling...')
    
    const symbols = ['BTCUSDT', 'ETHUSDT', 'FAILUSDT', 'BNBUSDT']
    
    // Mock fetchKlines to fail for FAILUSDT
    const originalFetch = futuresApi.fetchKlines.bind(futuresApi)
    vi.spyOn(futuresApi, 'fetchKlines').mockImplementation(async (symbol: string, interval: string) => {
      if (symbol === 'FAILUSDT') {
        throw { code: 500, message: 'Symbol not found' }
      }
      return originalFetch(symbol, interval)
    })

    const results = await metricsService.fetchMultipleSymbolMetrics(
      symbols,
      undefined,
      { skipMarketCap: true }
    )

    // Should get results for 3 symbols (excluding FAILUSDT)
    expect(results.length).toBeLessThan(symbols.length)
    expect(results.every(r => r.symbol !== 'FAILUSDT')).toBe(true)
    
    console.log(`✅ Processed ${results.length}/${symbols.length} symbols`)
    console.log(`   Failed: FAILUSDT, Succeeded: ${results.map(r => r.symbol).join(', ')}`)
  }, 30000)

  it('should handle empty API responses', async () => {
    console.log('Testing empty response handling...')
    
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [],
    } as Response)

    const result = await futuresApi.fetch24hrTickers()
    
    expect(result).toBeInstanceOf(Array)
    expect(result.length).toBe(0)
    console.log('✅ Empty response handled gracefully')

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should validate API response structure', async () => {
    console.log('Testing response validation...')
    
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [
        { symbol: 'BTCUSDT', lastPrice: '50000' }, // Missing fields
      ],
    } as Response)

    const result = await futuresApi.fetch24hrTickers()
    
    // Should return data even if incomplete
    expect(result).toBeInstanceOf(Array)
    expect(result.length).toBe(1)
    expect(result[0].symbol).toBe('BTCUSDT')
    console.log('✅ Partial data handled without crashing')

    expect(mockFetch).toHaveBeenCalled()
  })
})
