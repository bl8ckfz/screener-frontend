import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CoinGeckoApiClient } from '@/services/coinGeckoApi'
import type { CoinGeckoMarketData } from '@/types/api'

describe('CoinGeckoApiClient', () => {
  let client: CoinGeckoApiClient

  beforeEach(() => {
    client = new CoinGeckoApiClient()
    vi.clearAllMocks()
    // Clear cache before each test
    client.clearCache()
  })

  describe('fetchCoinData', () => {
    it('should fetch coin data successfully', async () => {
      const mockData: CoinGeckoMarketData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          market_cap: { usd: 800000000000 },
          current_price: { usd: 42000 },
          total_volume: { usd: 25000000000 },
          circulating_supply: 19000000,
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      const result = await client.fetchCoinData('bitcoin')

      expect(result.id).toBe('bitcoin')
      expect(result.market_data.market_cap.usd).toBe(800000000000)
    })

    it('should respect rate limiting', async () => {
      const mockData: CoinGeckoMarketData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          market_cap: { usd: 800000000000 },
          current_price: { usd: 42000 },
          total_volume: { usd: 25000000000 },
          circulating_supply: 19000000,
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      // Make multiple calls
      await client.fetchCoinData('bitcoin')
      await client.fetchCoinData('ethereum')

      const status = client.getRateLimitStatus()
      expect(status.calls).toBe(2)
      expect(status.maxCalls).toBe(30)
    })

    it('should handle rate limit errors (429)', async () => {
      let callCount = 0
      
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: new Map([['Retry-After', '1']]),
            statusText: 'Too Many Requests',
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'bitcoin',
            symbol: 'btc',
            name: 'Bitcoin',
            market_data: {
              market_cap: { usd: 800000000000 },
              current_price: { usd: 42000 },
              total_volume: { usd: 25000000000 },
              circulating_supply: 19000000,
            },
          }),
        })
      })

      const result = await client.fetchCoinData('bitcoin')

      expect(callCount).toBeGreaterThan(1)
      expect(result.id).toBe('bitcoin')
    }, 10000) // Extended timeout for wait
  })

  describe('fetchMarketCap', () => {
    it('should fetch market cap for valid symbol', async () => {
      const mockData: CoinGeckoMarketData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          market_cap: { usd: 800000000000 },
          current_price: { usd: 42000 },
          total_volume: { usd: 25000000000 },
          circulating_supply: 19000000,
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      const result = await client.fetchMarketCap('BTCUSDT')

      expect(result).toBe(800000000000)
    })

    it('should return null for unmapped symbol', async () => {
      const result = await client.fetchMarketCap('UNKNOWNUSDT')

      expect(result).toBeNull()
    })

    it('should cache market cap for 1 hour', async () => {
      const mockData: CoinGeckoMarketData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          market_cap: { usd: 800000000000 },
          current_price: { usd: 42000 },
          total_volume: { usd: 25000000000 },
          circulating_supply: 19000000,
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      // First call
      const result1 = await client.fetchMarketCap('BTCUSDT')
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const result2 = await client.fetchMarketCap('BTCUSDT')
      expect(global.fetch).toHaveBeenCalledTimes(1) // Still 1, not 2

      expect(result1).toBe(result2)
    })

    it('should use stale cache on API error', async () => {
      const mockData: CoinGeckoMarketData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          market_cap: { usd: 800000000000 },
          current_price: { usd: 42000 },
          total_volume: { usd: 25000000000 },
          circulating_supply: 19000000,
        },
      }

      // First call succeeds
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result1 = await client.fetchMarketCap('BTCUSDT')
      expect(result1).toBe(800000000000)

      // Second call fails, should return cached value
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result2 = await client.fetchMarketCap('BTCUSDT')
      expect(result2).toBe(800000000000) // Returns stale cache
    })
  })

  describe('fetchMultipleMarketCaps', () => {
    it('should fetch market caps for multiple symbols', async () => {
      const mockBitcoin: CoinGeckoMarketData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          market_cap: { usd: 800000000000 },
          current_price: { usd: 42000 },
          total_volume: { usd: 25000000000 },
          circulating_supply: 19000000,
        },
      }

      const mockEthereum: CoinGeckoMarketData = {
        id: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        market_data: {
          market_cap: { usd: 300000000000 },
          current_price: { usd: 2500 },
          total_volume: { usd: 15000000000 },
          circulating_supply: 120000000,
        },
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBitcoin,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEthereum,
        })

      const result = await client.fetchMultipleMarketCaps(['BTCUSDT', 'ETHUSDT'])

      expect(result.size).toBe(2)
      expect(result.get('BTCUSDT')).toBe(800000000000)
      expect(result.get('ETHUSDT')).toBe(300000000000)
    })

    it('should return null for unmapped symbols', async () => {
      const result = await client.fetchMultipleMarketCaps(['BTCUSDT', 'UNKNOWNUSDT'])

      expect(result.size).toBe(2)
      expect(result.get('UNKNOWNUSDT')).toBeNull()
    })
  })

  describe('cache management', () => {
    it('should clear cache', async () => {
      // Use a fresh client to avoid cache pollution
      const freshClient = new CoinGeckoApiClient()
      
      const mockData: CoinGeckoMarketData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          market_cap: { usd: 800000000000 },
          current_price: { usd: 42000 },
          total_volume: { usd: 25000000000 },
          circulating_supply: 19000000,
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      // Fetch to populate cache
      await freshClient.fetchMarketCap('BTCUSDT')
      let stats = freshClient.getCacheStats()
      expect(stats.size).toBe(1)

      // Clear cache
      freshClient.clearCache()
      stats = freshClient.getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should provide cache statistics', async () => {
      // Use a fresh client to avoid cache pollution
      const freshClient = new CoinGeckoApiClient()
      
      const mockData: CoinGeckoMarketData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          market_cap: { usd: 800000000000 },
          current_price: { usd: 42000 },
          total_volume: { usd: 25000000000 },
          circulating_supply: 19000000,
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      await freshClient.fetchMarketCap('BTCUSDT')

      const stats = freshClient.getCacheStats()
      expect(stats.size).toBe(1)
      expect(stats.oldestEntry).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getRateLimitStatus', () => {
    it('should track rate limit status', async () => {
      const mockData: CoinGeckoMarketData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        market_data: {
          market_cap: { usd: 800000000000 },
          current_price: { usd: 42000 },
          total_volume: { usd: 25000000000 },
          circulating_supply: 19000000,
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      })

      const initialStatus = client.getRateLimitStatus()
      expect(initialStatus.calls).toBe(0)

      await client.fetchCoinData('bitcoin')

      const afterStatus = client.getRateLimitStatus()
      expect(afterStatus.calls).toBe(1)
      expect(afterStatus.maxCalls).toBe(30)
    })
  })
})
