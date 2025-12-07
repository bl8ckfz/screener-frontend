import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BinanceFuturesApiClient } from '@/services/binanceFuturesApi'
import type { BinanceFuturesKline } from '@/types/api'

describe('BinanceFuturesApiClient', () => {
  let client: BinanceFuturesApiClient

  beforeEach(() => {
    client = new BinanceFuturesApiClient()
    vi.clearAllMocks()
  })

  describe('parseKlineResponse', () => {
    it('should parse raw kline array into typed objects', () => {
      const rawKline = [
        1640000000000, // openTime
        '50000.00', // open
        '51000.00', // high
        '49000.00', // low
        '50500.00', // close
        '1000', // volume
        1640003599999, // closeTime
        '50250000', // quoteVolume
        5000, // trades
        '500', // takerBuyBaseVolume
        '25125000', // takerBuyQuoteVolume
        '0', // ignore
      ]

      // Access private method through any type assertion for testing
      const result = (client as any).parseKlineResponse([rawKline])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        openTime: 1640000000000,
        open: '50000.00',
        high: '51000.00',
        low: '49000.00',
        close: '50500.00',
        volume: '1000',
        closeTime: 1640003599999,
        quoteVolume: '50250000',
        trades: 5000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '25125000',
        ignore: '0',
      })
    })
  })

  describe('processKlineData', () => {
    it('should process klines into structured format with previous and current', () => {
      const klines: BinanceFuturesKline[] = [
        {
          openTime: 1640000000000,
          open: '50000.00',
          high: '51000.00',
          low: '49000.00',
          close: '50500.00',
          volume: '1000',
          closeTime: 1640003599999,
          quoteVolume: '50250000',
          trades: 5000,
          takerBuyBaseVolume: '500',
          takerBuyQuoteVolume: '25125000',
          ignore: '0',
        },
        {
          openTime: 1640003600000,
          open: '50500.00',
          high: '52000.00',
          low: '50000.00',
          close: '51500.00',
          volume: '1500',
          closeTime: 1640007199999,
          quoteVolume: '77250000',
          trades: 7500,
          takerBuyBaseVolume: '750',
          takerBuyQuoteVolume: '38625000',
          ignore: '0',
        },
      ]

      const result = client.processKlineData(klines, '1h')

      expect(result.interval).toBe('1h')
      expect(result.previous.close).toBe(50500)
      expect(result.previous.quoteVolume).toBe(50250000)
      expect(result.current.close).toBe(51500)
      expect(result.current.quoteVolume).toBe(77250000)
    })

    it('should throw error if less than 2 klines provided', () => {
      const klines: BinanceFuturesKline[] = [
        {
          openTime: 1640000000000,
          open: '50000.00',
          high: '51000.00',
          low: '49000.00',
          close: '50500.00',
          volume: '1000',
          closeTime: 1640003599999,
          quoteVolume: '50250000',
          trades: 5000,
          takerBuyBaseVolume: '500',
          takerBuyQuoteVolume: '25125000',
          ignore: '0',
        },
      ]

      expect(() => client.processKlineData(klines, '1h')).toThrow('Expected at least 2 klines')
    })

    it('should correctly parse all numeric string values', () => {
      const klines: BinanceFuturesKline[] = [
        {
          openTime: 1640000000000,
          open: '100.123',
          high: '105.456',
          low: '99.789',
          close: '102.345',
          volume: '1234.567',
          closeTime: 1640003599999,
          quoteVolume: '125678.901',
          trades: 5000,
          takerBuyBaseVolume: '600',
          takerBuyQuoteVolume: '61200',
          ignore: '0',
        },
        {
          openTime: 1640003600000,
          open: '102.345',
          high: '108.901',
          low: '101.234',
          close: '107.890',
          volume: '2345.678',
          closeTime: 1640007199999,
          quoteVolume: '253456.789',
          trades: 7500,
          takerBuyBaseVolume: '1200',
          takerBuyQuoteVolume: '129600',
          ignore: '0',
        },
      ]

      const result = client.processKlineData(klines, '5m')

      expect(result.previous.open).toBeCloseTo(100.123, 3)
      expect(result.previous.high).toBeCloseTo(105.456, 3)
      expect(result.previous.low).toBeCloseTo(99.789, 3)
      expect(result.previous.close).toBeCloseTo(102.345, 3)
      expect(result.previous.volume).toBeCloseTo(1234.567, 3)
      expect(result.previous.quoteVolume).toBeCloseTo(125678.901, 3)

      expect(result.current.open).toBeCloseTo(102.345, 3)
      expect(result.current.high).toBeCloseTo(108.901, 3)
      expect(result.current.low).toBeCloseTo(101.234, 3)
      expect(result.current.close).toBeCloseTo(107.890, 3)
      expect(result.current.volume).toBeCloseTo(2345.678, 3)
      expect(result.current.quoteVolume).toBeCloseTo(253456.789, 3)
    })
  })

  describe('fetchKlines', () => {
    it('should fetch klines with correct parameters', async () => {
      const mockKlines = [
        [1640000000000, '50000', '51000', '49000', '50500', '1000', 1640003599999, '50250000', 5000, '500', '25125000', '0'],
        [1640003600000, '50500', '52000', '50000', '51500', '1500', 1640007199999, '77250000', 7500, '750', '38625000', '0'],
      ]

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockKlines,
      })

      const result = await client.fetchKlines('BTCUSDT', '1h', 2)

      expect(result).toHaveLength(2)
      expect(result[0].symbol).toBeUndefined() // Raw klines don't include symbol
      expect(result[0].close).toBe('50500')
      expect(result[1].close).toBe('51500')
    })

    it('should handle API errors with retry', async () => {
      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount < 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => [
            [1640000000000, '50000', '51000', '49000', '50500', '1000', 1640003599999, '50250000', 5000, '500', '25125000', '0'],
            [1640003600000, '50500', '52000', '50000', '51500', '1500', 1640007199999, '77250000', 7500, '750', '38625000', '0'],
          ],
        })
      })

      const result = await client.fetchKlines('BTCUSDT', '1h', 2)

      expect(callCount).toBe(2) // First call failed, second succeeded
      expect(result).toHaveLength(2)
    })
  })

  describe('fetchMultipleKlines', () => {
    it('should fetch multiple intervals in parallel', async () => {
      const mockKlines = [
        [1640000000000, '50000', '51000', '49000', '50500', '1000', 1640003599999, '50250000', 5000, '500', '25125000', '0'],
        [1640003600000, '50500', '52000', '50000', '51500', '1500', 1640007199999, '77250000', 7500, '750', '38625000', '0'],
      ]

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockKlines,
      })

      const result = await client.fetchMultipleKlines('BTCUSDT', ['5m', '15m', '1h'])

      expect(result.size).toBe(3)
      expect(result.get('5m')).toHaveLength(2)
      expect(result.get('15m')).toHaveLength(2)
      expect(result.get('1h')).toHaveLength(2)
    })
  })

  describe('fetchAllFuturesSymbols', () => {
    it('should fetch and filter USDT-M perpetual futures', async () => {
      const mockExchangeInfo = {
        symbols: [
          { symbol: 'BTCUSDT', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' },
          { symbol: 'ETHUSDT', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' },
          { symbol: 'BTCUSD_PERP', quoteAsset: 'USD', status: 'TRADING', contractType: 'PERPETUAL' }, // Not USDT
          { symbol: 'BTCUSDT_230630', quoteAsset: 'USDT', status: 'TRADING', contractType: 'CURRENT_QUARTER' }, // Not perpetual
          { symbol: 'BNBUSDT', quoteAsset: 'USDT', status: 'BREAK', contractType: 'PERPETUAL' }, // Not trading
        ],
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockExchangeInfo,
      })

      const result = await client.fetchAllFuturesSymbols()

      expect(result).toHaveLength(2)
      expect(result).toContain('BTCUSDT')
      expect(result).toContain('ETHUSDT')
      expect(result).not.toContain('BTCUSD_PERP')
      expect(result).not.toContain('BTCUSDT_230630')
      expect(result).not.toContain('BNBUSDT')
    })

    it('should cache results for 1 hour', async () => {
      // Create a fresh client to avoid cache pollution from previous test
      const freshClient = new BinanceFuturesApiClient()
      
      const mockExchangeInfo = {
        symbols: [
          { symbol: 'SOLUSDT', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' },
        ],
      }

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockExchangeInfo,
      })
      global.fetch = fetchMock

      // First call
      await freshClient.fetchAllFuturesSymbols()
      const firstCallCount = fetchMock.mock.calls.length

      // Second call should use cache
      await freshClient.fetchAllFuturesSymbols()
      const secondCallCount = fetchMock.mock.calls.length

      // Should have same number of calls (cache was used)
      expect(secondCallCount).toBe(firstCallCount)
    })
  })

  describe('fetch1mKlines', () => {
    it('should fetch 1m candles in minimal Candle1m format', async () => {
      const mockKlineData = [
        [
          1640000000000, // openTime
          '50000.00', // open
          '51000.00', // high
          '49000.00', // low
          '50500.00', // close
          '1000', // volume
          1640000059999, // closeTime
          '50250000', // quoteVolume
          5000, // trades
          '500', // takerBuyBaseVolume
          '25125000', // takerBuyQuoteVolume
          '0', // ignore
        ],
        [
          1640000060000, // openTime
          '50500.00', // open
          '51500.00', // high
          '50000.00', // low
          '51000.00', // close
          '1200', // volume
          1640000119999, // closeTime
          '61200000', // quoteVolume
          6000, // trades
          '600', // takerBuyBaseVolume
          '30600000', // takerBuyQuoteVolume
          '0', // ignore
        ],
      ]

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockKlineData,
      })
      global.fetch = fetchMock

      const candles = await client.fetch1mKlines('BTCUSDT', 2)

      expect(candles).toHaveLength(2)
      expect(candles[0]).toEqual({
        openTime: 1640000000000,
        close: 50500,
        volume: 1000,
        quoteVolume: 50250000,
      })
      expect(candles[1]).toEqual({
        openTime: 1640000060000,
        close: 51000,
        volume: 1200,
        quoteVolume: 61200000,
      })
    })

    it('should limit to 1500 candles max', async () => {
      const mockKlineData = Array(1500).fill([
        1640000000000, '50000', '51000', '49000', '50500',
        '1000', 1640000059999, '50250000', 5000, '500', '25125000', '0',
      ])

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockKlineData,
      })
      global.fetch = fetchMock

      const candles = await client.fetch1mKlines('BTCUSDT', 2000) // Request 2000

      // Should still fetch (URL contains limit=1500)
      expect(fetchMock).toHaveBeenCalled()
      const callUrl = fetchMock.mock.calls[0][0]
      const decodedUrl = decodeURIComponent(callUrl)
      expect(decodedUrl).toContain('limit=1500')
    })

    it('should default to 1440 candles (24h)', async () => {
      const mockKlineData = Array(1440).fill([
        1640000000000, '50000', '51000', '49000', '50500',
        '1000', 1640000059999, '50250000', 5000, '500', '25125000', '0',
      ])

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockKlineData,
      })
      global.fetch = fetchMock

      await client.fetch1mKlines('BTCUSDT') // No limit specified

      const callUrl = fetchMock.mock.calls[0][0]
      const decodedUrl = decodeURIComponent(callUrl)
      expect(decodedUrl).toContain('limit=1440')
    })

    it('should throw on API error', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = fetchMock

      await expect(client.fetch1mKlines('BTCUSDT')).rejects.toThrow('Network error')
    })
  })

  describe('backfill1mCandles', () => {
    it('should backfill multiple symbols in batches', async () => {
      const mockKlineData = Array(1440).fill([
        1640000000000, '50000', '51000', '49000', '50500',
        '1000', 1640000059999, '50250000', 5000, '500', '25125000', '0',
      ])

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockKlineData,
      })
      global.fetch = fetchMock

      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
      const result = await client.backfill1mCandles(symbols, {
        batchSize: 2,
        batchDelay: 10, // Small delay for tests
      })

      expect(result.successful).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(result.data.size).toBe(3)
      expect(result.data.get('BTCUSDT')).toHaveLength(1440)
    })

    it('should handle partial failures', async () => {
      const mockKlineData = Array(1440).fill([
        1640000000000, '50000', '51000', '49000', '50500',
        '1000', 1640000059999, '50250000', 5000, '500', '25125000', '0',
      ])

      // Mock to fail specifically for ETHUSDT
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        const decodedUrl = decodeURIComponent(url)
        if (decodedUrl.includes('ETHUSDT')) {
          return Promise.reject(new Error('Failed for ETHUSDT'))
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockKlineData,
        })
      })
      global.fetch = fetchMock

      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
      const result = await client.backfill1mCandles(symbols, {
        batchSize: 3,
        batchDelay: 10,
      })

      expect(result.successful).toHaveLength(2)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].symbol).toBe('ETHUSDT')
      expect(result.data.has('BTCUSDT')).toBe(true)
      expect(result.data.has('ETHUSDT')).toBe(false)
      expect(result.data.has('BNBUSDT')).toBe(true)
    })

    it('should call progress callback', async () => {
      const mockKlineData = Array(1440).fill([
        1640000000000, '50000', '51000', '49000', '50500',
        '1000', 1640000059999, '50250000', 5000, '500', '25125000', '0',
      ])

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockKlineData,
      })
      global.fetch = fetchMock

      const progressCallback = vi.fn()
      const symbols = ['BTCUSDT', 'ETHUSDT']
      
      await client.backfill1mCandles(symbols, {
        batchSize: 2,
        batchDelay: 10,
        onProgress: progressCallback,
      })

      expect(progressCallback).toHaveBeenCalledTimes(2)
      expect(progressCallback).toHaveBeenCalledWith(1, 2, 'BTCUSDT')
      expect(progressCallback).toHaveBeenCalledWith(2, 2, 'ETHUSDT')
    })

    it('should handle empty symbol list', async () => {
      const result = await client.backfill1mCandles([], {
        batchSize: 10,
        batchDelay: 10,
      })

      expect(result.successful).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
      expect(result.data.size).toBe(0)
    })
  })
})
