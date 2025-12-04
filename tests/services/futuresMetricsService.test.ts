import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FuturesMetricsService } from '@/services/futuresMetricsService'
import { BinanceFuturesApiClient } from '@/services/binanceFuturesApi'
import { CoinGeckoApiClient } from '@/services/coinGeckoApi'
import type { BinanceFuturesKline } from '@/types/api'

describe('FuturesMetricsService', () => {
  let service: FuturesMetricsService
  let mockFuturesClient: BinanceFuturesApiClient
  let mockCoinGeckoClient: CoinGeckoApiClient

  beforeEach(() => {
    mockFuturesClient = new BinanceFuturesApiClient()
    mockCoinGeckoClient = new CoinGeckoApiClient()
    service = new FuturesMetricsService(mockFuturesClient, mockCoinGeckoClient)
    vi.clearAllMocks()
  })

  const createMockKline = (close: string, quoteVolume: string): BinanceFuturesKline => ({
    openTime: Date.now() - 3600000,
    open: close,
    high: close,
    low: close,
    close,
    volume: '1000',
    closeTime: Date.now(),
    quoteVolume,
    trades: 5000,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: quoteVolume,
    ignore: '0',
  })

  describe('fetchSymbolMetrics', () => {
    it('should fetch and calculate complete metrics for a symbol', async () => {
      // Mock klines data for different intervals
      const mockKlines = {
        '5m': [createMockKline('50000', '1000000'), createMockKline('50500', '1100000')],
        '15m': [createMockKline('49500', '3000000'), createMockKline('50500', '3300000')],
        '1h': [createMockKline('48000', '10000000'), createMockKline('50500', '11000000')],
        '8h': [createMockKline('45000', '80000000'), createMockKline('50500', '88000000')],
        '1d': [createMockKline('40000', '200000000'), createMockKline('50500', '220000000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(800000000000)

      const metrics = await service.fetchSymbolMetrics('BTCUSDT')

      // Verify basic properties
      expect(metrics.symbol).toBe('BTCUSDT')
      expect(metrics.timestamp).toBeGreaterThan(0)
      expect(metrics.marketCap).toBe(800000000000)
      expect(metrics.coinGeckoId).toBe('bitcoin')

      // Verify price changes
      expect(metrics.change_5m).toBeCloseTo(1.0, 1) // (50500 / 50000 - 1) * 100
      expect(metrics.change_15m).toBeCloseTo(2.02, 1) // (50500 / 49500 - 1) * 100
      expect(metrics.change_1h).toBeCloseTo(5.21, 1) // (50500 / 48000 - 1) * 100
      expect(metrics.change_8h).toBeCloseTo(12.22, 1) // (50500 / 45000 - 1) * 100
      expect(metrics.change_1d).toBeCloseTo(26.25, 1) // (50500 / 40000 - 1) * 100

      // Verify volumes
      expect(metrics.volume_5m).toBe(1100000)
      expect(metrics.volume_15m).toBe(3300000)
      expect(metrics.volume_1h).toBe(11000000)
      expect(metrics.volume_8h).toBe(88000000)
      expect(metrics.volume_1d).toBe(220000000)

      // Verify filter details exist
      expect(metrics.filter_details).toBeDefined()
      expect(metrics.filter_details.price_checks).toBeDefined()
      expect(metrics.filter_details.volume_checks).toBeDefined()
      expect(metrics.filter_details.marketcap_checks).toBeDefined()
    })

    it('should handle symbols without CoinGecko mapping', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '1000000'), createMockKline('101', '1100000')],
        '15m': [createMockKline('100', '3000000'), createMockKline('101', '3300000')],
        '1h': [createMockKline('100', '10000000'), createMockKline('101', '11000000')],
        '8h': [createMockKline('100', '80000000'), createMockKline('101', '88000000')],
        '1d': [createMockKline('100', '200000000'), createMockKline('101', '220000000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(null)

      const metrics = await service.fetchSymbolMetrics('UNKNOWNUSDT')

      expect(metrics.symbol).toBe('UNKNOWNUSDT')
      expect(metrics.marketCap).toBeNull()
      expect(metrics.coinGeckoId).toBeNull()
      expect(metrics.passes_filters).toBe(false) // Should fail market cap checks
    })

    it('should calculate correct percentage changes', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '1000000'), createMockKline('105', '1100000')],
        '15m': [createMockKline('100', '3000000'), createMockKline('110', '3300000')],
        '1h': [createMockKline('100', '10000000'), createMockKline('120', '11000000')],
        '8h': [createMockKline('100', '80000000'), createMockKline('130', '88000000')],
        '1d': [createMockKline('100', '200000000'), createMockKline('110', '220000000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(50000000)

      const metrics = await service.fetchSymbolMetrics('TESTUSDT')

      expect(metrics.change_5m).toBeCloseTo(5.0, 1) // (105 / 100 - 1) * 100 = 5%
      expect(metrics.change_15m).toBeCloseTo(10.0, 1) // (110 / 100 - 1) * 100 = 10%
      expect(metrics.change_1h).toBeCloseTo(20.0, 1) // (120 / 100 - 1) * 100 = 20%
      expect(metrics.change_8h).toBeCloseTo(30.0, 1) // (130 / 100 - 1) * 100 = 30%
      expect(metrics.change_1d).toBeCloseTo(10.0, 1) // (110 / 100 - 1) * 100 = 10%
    })
  })

  describe('filter evaluation', () => {
    it('should pass all filters when criteria met', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '100000'), createMockKline('101', '110000')],
        '15m': [createMockKline('100', '500000'), createMockKline('102', '550000')], // +2% > 1%
        '1h': [createMockKline('100', '2000000'), createMockKline('105', '2200000')], // +5% > +2%
        '8h': [createMockKline('100', '15000000'), createMockKline('110', '16500000')], // +10% > +5%
        '1d': [createMockKline('95', '50000000'), createMockKline('110', '55000000')], // +15.8% < 15% (EDGE)
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      // Market cap: 50M (between 23M and 2500M)
      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(50000000)

      const metrics = await service.fetchSymbolMetrics('TESTUSDT')

      // Price checks
      expect(metrics.filter_details.price_checks.change_15m_gt_1).toBe(true) // 2% > 1%
      expect(metrics.filter_details.price_checks.change_1h_gt_change_15m).toBe(true) // 5% > 2%
      expect(metrics.filter_details.price_checks.change_8h_gt_change_1h).toBe(true) // 10% > 5%

      // Volume checks
      expect(metrics.filter_details.volume_checks.volume_15m_gt_400k).toBe(true) // 550k > 400k
      expect(metrics.filter_details.volume_checks.volume_1h_gt_1m).toBe(true) // 2.2M > 1M
      expect(metrics.filter_details.volume_checks.three_vol15m_gt_vol1h).toBe(false) // 3 * 550k = 1.65M < 2.2M

      // Market cap checks
      expect(metrics.filter_details.marketcap_checks.marketcap_gt_23m).toBe(true) // 50M > 23M
      expect(metrics.filter_details.marketcap_checks.marketcap_lt_2500m).toBe(true) // 50M < 2500M

      // Should fail because volume check fails
      expect(metrics.passes_filters).toBe(false)
    })

    it('should fail when price change thresholds not met', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '100000'), createMockKline('100.5', '110000')],
        '15m': [createMockKline('100', '500000'), createMockKline('100.5', '550000')], // +0.5% < 1%
        '1h': [createMockKline('100', '2000000'), createMockKline('101', '2200000')],
        '8h': [createMockKline('100', '15000000'), createMockKline('102', '16500000')],
        '1d': [createMockKline('95', '50000000'), createMockKline('102', '55000000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(50000000)

      const metrics = await service.fetchSymbolMetrics('TESTUSDT')

      expect(metrics.filter_details.price_checks.change_15m_gt_1).toBe(false)
      expect(metrics.passes_filters).toBe(false)
    })

    it('should fail when volume thresholds not met', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '10000'), createMockKline('101', '11000')],
        '15m': [createMockKline('100', '50000'), createMockKline('102', '55000')], // 55k < 400k
        '1h': [createMockKline('100', '200000'), createMockKline('105', '220000')], // 220k < 1M
        '8h': [createMockKline('100', '1500000'), createMockKline('110', '1650000')],
        '1d': [createMockKline('95', '5000000'), createMockKline('110', '5500000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(50000000)

      const metrics = await service.fetchSymbolMetrics('TESTUSDT')

      expect(metrics.filter_details.volume_checks.volume_15m_gt_400k).toBe(false)
      expect(metrics.filter_details.volume_checks.volume_1h_gt_1m).toBe(false)
      expect(metrics.passes_filters).toBe(false)
    })

    it('should fail when market cap outside range', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '100000'), createMockKline('101', '110000')],
        '15m': [createMockKline('100', '500000'), createMockKline('102', '550000')],
        '1h': [createMockKline('100', '2000000'), createMockKline('105', '2200000')],
        '8h': [createMockKline('100', '15000000'), createMockKline('110', '16500000')],
        '1d': [createMockKline('95', '50000000'), createMockKline('110', '55000000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      // Market cap too low
      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(10000000) // 10M < 23M

      const metrics = await service.fetchSymbolMetrics('TESTUSDT')

      expect(metrics.filter_details.marketcap_checks.marketcap_gt_23m).toBe(false)
      expect(metrics.passes_filters).toBe(false)
    })

    it('should fail when market cap too high', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '100000'), createMockKline('101', '110000')],
        '15m': [createMockKline('100', '500000'), createMockKline('102', '550000')],
        '1h': [createMockKline('100', '2000000'), createMockKline('105', '2200000')],
        '8h': [createMockKline('100', '15000000'), createMockKline('110', '16500000')],
        '1d': [createMockKline('95', '50000000'), createMockKline('110', '55000000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      // Market cap too high
      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(3000000000) // 3B > 2.5B

      const metrics = await service.fetchSymbolMetrics('TESTUSDT')

      expect(metrics.filter_details.marketcap_checks.marketcap_lt_2500m).toBe(false)
      expect(metrics.passes_filters).toBe(false)
    })

    it('should fail when market cap is null', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '100000'), createMockKline('101', '110000')],
        '15m': [createMockKline('100', '500000'), createMockKline('102', '550000')],
        '1h': [createMockKline('100', '2000000'), createMockKline('105', '2200000')],
        '8h': [createMockKline('100', '15000000'), createMockKline('110', '16500000')],
        '1d': [createMockKline('95', '50000000'), createMockKline('110', '55000000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(null)

      const metrics = await service.fetchSymbolMetrics('UNKNOWNUSDT')

      expect(metrics.filter_details.marketcap_checks.marketcap_gt_23m).toBe(false)
      expect(metrics.filter_details.marketcap_checks.marketcap_lt_2500m).toBe(false)
      expect(metrics.passes_filters).toBe(false)
    })
  })

  describe('fetchMultipleSymbolMetrics', () => {
    it('should fetch metrics for multiple symbols', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '100000'), createMockKline('101', '110000')],
        '15m': [createMockKline('100', '500000'), createMockKline('102', '550000')],
        '1h': [createMockKline('100', '2000000'), createMockKline('105', '2200000')],
        '8h': [createMockKline('100', '15000000'), createMockKline('110', '16500000')],
        '1d': [createMockKline('95', '50000000'), createMockKline('110', '55000000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(50000000)

      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
      const results = await service.fetchMultipleSymbolMetrics(symbols)

      expect(results).toHaveLength(3)
      expect(results[0].symbol).toBe('BTCUSDT')
      expect(results[1].symbol).toBe('ETHUSDT')
      expect(results[2].symbol).toBe('BNBUSDT')
    })

    it('should handle progress callback', async () => {
      const mockKlines = {
        '5m': [createMockKline('100', '100000'), createMockKline('101', '110000')],
        '15m': [createMockKline('100', '500000'), createMockKline('102', '550000')],
        '1h': [createMockKline('100', '2000000'), createMockKline('105', '2200000')],
        '8h': [createMockKline('100', '15000000'), createMockKline('110', '16500000')],
        '1d': [createMockKline('95', '50000000'), createMockKline('110', '55000000')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockResolvedValue(
        new Map(Object.entries(mockKlines))
      )

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(50000000)

      const progressUpdates: any[] = []
      const symbols = ['BTCUSDT', 'ETHUSDT']

      await service.fetchMultipleSymbolMetrics(symbols, (progress) => {
        progressUpdates.push(progress)
      })

      expect(progressUpdates).toHaveLength(2)
      expect(progressUpdates[0].completed).toBe(1)
      expect(progressUpdates[0].total).toBe(2)
      expect(progressUpdates[1].completed).toBe(2)
      expect(progressUpdates[1].total).toBe(2)
    })

    it('should skip failed symbols and continue', async () => {
      let callCount = 0
      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines').mockImplementation(async () => {
        callCount++
        if (callCount === 2) {
          throw new Error('API Error')
        }
        return new Map([
          ['5m', [createMockKline('100', '100000'), createMockKline('101', '110000')]],
          ['15m', [createMockKline('100', '500000'), createMockKline('102', '550000')]],
          ['1h', [createMockKline('100', '2000000'), createMockKline('105', '2200000')]],
          ['8h', [createMockKline('100', '15000000'), createMockKline('110', '16500000')]],
          ['1d', [createMockKline('95', '50000000'), createMockKline('110', '55000000')]],
        ])
      })

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(50000000)

      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
      const results = await service.fetchMultipleSymbolMetrics(symbols)

      // Should have 2 results (1 failed)
      expect(results).toHaveLength(2)
    })
  })

  describe('scanAllFutures', () => {
    it('should scan all futures and return passing symbols', async () => {
      vi.spyOn(mockFuturesClient, 'fetchAllFuturesSymbols').mockResolvedValue([
        'BTCUSDT',
        'ETHUSDT',
      ])

      // Mock data that passes ALL 10 filters:
      // - change_15m (2%) > 1% ✅
      // - change_1d (10.53%) < 15% ✅
      // - change_1h (5%) > change_15m (2%) ✅
      // - change_8h (10%) > change_1h (5%) ✅
      // - volume_15m (550k) > 400k ✅
      // - volume_1h (2.2M) > 1M ✅
      // - 3 * volume_15m (1.65M) > volume_1h (2.2M) ❌ BUT: we need to adjust
      // - 26 * volume_15m (14.3M) > volume_8h (16.5M) ❌ BUT: we need to adjust
      // - marketcap (50M) > 23M ✅
      // - marketcap (50M) < 2.5B ✅
      const mockKlinesPass = {
        '5m': [createMockKline('100', '100000'), createMockKline('101', '110000')],
        '15m': [createMockKline('100', '500000'), createMockKline('102', '550000')], // 550k
        '1h': [createMockKline('100', '1200000'), createMockKline('105', '1300000')], // 1.3M (< 3*550k=1.65M)
        '8h': [createMockKline('100', '10000000'), createMockKline('110', '11000000')], // 11M (< 26*550k=14.3M)
        '1d': [createMockKline('95', '50000000'), createMockKline('105', '55000000')],
      }

      // Mock data that fails volume checks
      const mockKlinesFail = {
        '5m': [createMockKline('100', '10'), createMockKline('100.1', '11')],
        '15m': [createMockKline('100', '50'), createMockKline('100.1', '55')], // 55 < 400k ❌
        '1h': [createMockKline('100', '200'), createMockKline('100.1', '220')], // 220 < 1M ❌
        '8h': [createMockKline('100', '1500'), createMockKline('100.1', '1650')],
        '1d': [createMockKline('100', '5000'), createMockKline('100.1', '5500')],
      }

      vi.spyOn(mockFuturesClient, 'fetchMultipleKlines')
        .mockResolvedValueOnce(new Map(Object.entries(mockKlinesPass)))
        .mockResolvedValueOnce(new Map(Object.entries(mockKlinesFail)))

      vi.spyOn(mockCoinGeckoClient, 'fetchMarketCap').mockResolvedValue(50000000)

      const results = await service.scanAllFutures()

      // BTCUSDT should pass all 10 filters, ETHUSDT should fail volume checks
      expect(results.length).toBe(1)
      expect(results[0].symbol).toBe('BTCUSDT')
      expect(results[0].passes_filters).toBe(true)
    })
  })
})
