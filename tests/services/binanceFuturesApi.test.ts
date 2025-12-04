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
})
