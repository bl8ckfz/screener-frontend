import { describe, it, expect } from 'vitest'
import {
  evaluateFuturesBigBull60,
  evaluateFuturesBigBear60,
  evaluateFuturesPioneerBull,
  evaluateFuturesPioneerBear,
  evaluateFutures5BigBull,
  evaluateFutures5BigBear,
  evaluateFutures15BigBull,
  evaluateFutures15BigBear,
  evaluateFuturesBottomHunter,
  evaluateFuturesTopHunter,
  evaluateAllFuturesAlerts,
} from '@/services/alertEngine'
import type { FuturesMetrics } from '@/types/api'

describe('Futures Alert Evaluators', () => {
  const createBaseMetrics = (): FuturesMetrics => ({
    symbol: 'TESTUSDT',
    timestamp: Date.now(),
    change_5m: 0,
    change_15m: 0,
    change_1h: 0,
    change_8h: 0,
    change_1d: 0,
    volume_5m: 0,
    volume_15m: 0,
    volume_1h: 0,
    volume_8h: 0,
    volume_1d: 0,
    marketCap: 100_000_000, // 100M default (between 23M and 2.5B)
    coinGeckoId: 'test',
    passes_filters: false,
    filter_details: {
      price_checks: {
        change_15m_gt_1: false,
        change_1d_lt_15: false,
        change_1h_gt_change_15m: false,
        change_8h_gt_change_1h: false,
      },
      volume_checks: {
        volume_15m_gt_400k: false,
        volume_1h_gt_1m: false,
        three_vol15m_gt_vol1h: false,
        twentysix_vol15m_gt_vol8h: false,
      },
      marketcap_checks: {
        marketcap_gt_23m: true,
        marketcap_lt_2500m: true,
      },
    },
  })

  describe('60 Big Bull', () => {
    it('should trigger when all criteria met', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_1h: 2.0, // > 1.6%
        change_8h: 3.0, // > change_1h
        change_1d: 4.0, // > change_8h, < 15%
        volume_1h: 1_000_000, // > 500k, 6*1M = 6M > 5M volume_8h
        volume_8h: 5_500_000, // > 5M, < 6M (6*vol_1h)
        volume_1d: 15_000_000, // < 16M (16*vol_1h)
      }

      expect(evaluateFuturesBigBull60(metrics)).toBe(true)
    })

    it('should not trigger without sufficient 1h momentum', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_1h: 1.5, // < 1.6%
        change_8h: 3.0,
        change_1d: 4.0,
        volume_1h: 600_000,
        volume_8h: 3_000_000,
        volume_1d: 9_000_000,
      }

      expect(evaluateFuturesBigBull60(metrics)).toBe(false)
    })

    it('should not trigger when daily overextended', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_1h: 2.0,
        change_8h: 10.0,
        change_1d: 16.0, // > 15%
        volume_1h: 600_000,
        volume_8h: 3_000_000,
        volume_1d: 9_000_000,
      }

      expect(evaluateFuturesBigBull60(metrics)).toBe(false)
    })

    it('should not trigger without market cap', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        marketCap: null,
        change_1h: 2.0,
        change_8h: 3.0,
        change_1d: 4.0,
        volume_1h: 600_000,
        volume_8h: 3_000_000,
        volume_1d: 9_000_000,
      }

      expect(evaluateFuturesBigBull60(metrics)).toBe(false)
    })
  })

  describe('60 Big Bear', () => {
    it('should trigger when all criteria met', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_1h: -2.0, // < -1.6%
        change_8h: -3.0, // < change_1h
        change_1d: -4.0, // < change_8h, > -15%
        volume_1h: 1_000_000, // > 500k
        volume_8h: 5_500_000, // > 5M, < 6M (6*vol_1h)
        volume_1d: 15_000_000, // < 16M (16*vol_1h)
      }

      expect(evaluateFuturesBigBear60(metrics)).toBe(true)
    })

    it('should not trigger in freefall (daily < -15%)', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_1h: -2.0,
        change_8h: -10.0,
        change_1d: -16.0, // < -15%
        volume_1h: 600_000,
        volume_8h: 3_000_000,
        volume_1d: 9_000_000,
      }

      expect(evaluateFuturesBigBear60(metrics)).toBe(false)
    })
  })

  describe('Pioneer Bull', () => {
    it('should trigger when all criteria met', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_5m: 1.5, // > 1%
        change_15m: 1.2, // > 1%
        volume_5m: 300_000,
        volume_15m: 500_000,
      }

      // 3 * 1.5 = 4.5 > 1.2 ✓
      // 2 * 300k = 600k > 500k ✓
      expect(evaluateFuturesPioneerBull(metrics)).toBe(true)
    })

    it('should not trigger without acceleration', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_5m: 1.1,
        change_15m: 4.0, // 3 * 1.1 = 3.3 < 4.0 (no acceleration)
        volume_5m: 300_000,
        volume_15m: 500_000,
      }

      expect(evaluateFuturesPioneerBull(metrics)).toBe(false)
    })
  })

  describe('Pioneer Bear', () => {
    it('should trigger when all criteria met', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_5m: -1.5, // < -1%
        change_15m: -1.2, // < -1%
        volume_5m: 300_000,
        volume_15m: 500_000,
      }

      // 3 * -1.5 = -4.5 < -1.2 ✓
      // 2 * 300k = 600k > 500k ✓
      expect(evaluateFuturesPioneerBear(metrics)).toBe(true)
    })
  })

  describe('5 Big Bull', () => {
    it('should trigger when all criteria met', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_5m: 0.7, // > 0.6%
        change_15m: 1.0, // > change_5m
        change_1h: 1.5, // > change_15m
        change_1d: 10.0, // < 15%
        volume_5m: 150_000, // > 100k
        volume_15m: 400_000,
        volume_1h: 1_200_000, // > 1M
        volume_8h: 10_000_000,
      }

      // volume_5m > volume_15m / 3: 150k > 133k ✓
      // volume_5m > volume_1h / 6: 150k > 200k ✗ (need adjustment)
      
      metrics.volume_5m = 250_000
      // 250k > 133k ✓
      // 250k > 200k ✓
      // 250k > 151k ✓

      expect(evaluateFutures5BigBull(metrics)).toBe(true)
    })

    it('should not trigger without progressive validation', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_5m: 0.7,
        change_15m: 0.5, // < change_5m (not progressive)
        change_1h: 1.5,
        change_1d: 10.0,
        volume_5m: 250_000,
        volume_15m: 400_000,
        volume_1h: 1_200_000,
        volume_8h: 10_000_000,
      }

      expect(evaluateFutures5BigBull(metrics)).toBe(false)
    })
  })

  describe('5 Big Bear', () => {
    it('should trigger when all criteria met', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_5m: -0.7, // < -0.6%
        change_15m: -1.0, // < change_5m
        change_1h: -1.5, // < change_15m
        change_1d: -10.0, // > -15%
        volume_5m: 250_000,
        volume_15m: 400_000,
        volume_1h: 1_200_000,
        volume_8h: 10_000_000,
      }

      expect(evaluateFutures5BigBear(metrics)).toBe(true)
    })
  })

  describe('15 Big Bull', () => {
    it('should trigger when all criteria met', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_15m: 1.2, // > 1%
        change_1h: 1.5, // > change_15m
        change_8h: 2.0, // > change_1h
        change_1d: 10.0, // < 15%
        volume_15m: 500_000, // > 400k
        volume_1h: 1_200_000, // > 1M
        volume_8h: 12_000_000,
      }

      // volume_15m > volume_1h / 3: 500k > 400k ✓
      // volume_15m > volume_8h / 26: 500k > 461k ✓

      expect(evaluateFutures15BigBull(metrics)).toBe(true)
    })
  })

  describe('15 Big Bear', () => {
    it('should trigger when all criteria met', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_15m: -1.2, // < -1%
        change_1h: -1.5, // < change_15m
        change_8h: -2.0, // < change_1h
        change_1d: -10.0, // > -15%
        volume_15m: 500_000,
        volume_1h: 1_200_000,
        volume_8h: 12_000_000,
      }

      expect(evaluateFutures15BigBear(metrics)).toBe(true)
    })
  })

  describe('Bottom Hunter', () => {
    it('should trigger when reversal detected', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_1h: -1.0, // < -0.7% (in decline)
        change_15m: -0.8, // < -0.6% (confirming decline)
        change_5m: 0.6, // > 0.5% (reversal!)
        volume_5m: 100_000,
        volume_15m: 150_000,
        volume_1h: 700_000,
      }

      // volume_5m > volume_15m / 2: 100k > 75k ✓
      // volume_5m > volume_1h / 8: 100k > 87.5k ✓

      expect(evaluateFuturesBottomHunter(metrics)).toBe(true)
    })

    it('should not trigger without 5m reversal', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_1h: -1.0,
        change_15m: -0.8,
        change_5m: 0.3, // < 0.5% (no reversal)
        volume_5m: 100_000,
        volume_15m: 150_000,
        volume_1h: 700_000,
      }

      expect(evaluateFuturesBottomHunter(metrics)).toBe(false)
    })
  })

  describe('Top Hunter', () => {
    it('should trigger when reversal detected', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_1h: 1.0, // > 0.7% (in rally)
        change_15m: 0.8, // > 0.6% (confirming rally)
        change_5m: -0.6, // < -0.5% (reversal!)
        volume_5m: 100_000,
        volume_15m: 150_000,
        volume_1h: 700_000,
      }

      expect(evaluateFuturesTopHunter(metrics)).toBe(true)
    })

    it('should not trigger without 5m reversal', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_1h: 1.0,
        change_15m: 0.8,
        change_5m: -0.3, // > -0.5% (no reversal)
        volume_5m: 100_000,
        volume_15m: 150_000,
        volume_1h: 700_000,
      }

      expect(evaluateFuturesTopHunter(metrics)).toBe(false)
    })
  })

  describe('evaluateAllFuturesAlerts', () => {
    it('should return multiple triggered alerts', () => {
      const metrics: FuturesMetrics = {
        ...createBaseMetrics(),
        change_5m: 1.5,
        change_15m: 1.2,
        change_1h: 2.0,
        change_8h: 3.0,
        change_1d: 4.0,
        volume_5m: 300_000,
        volume_15m: 500_000,
        volume_1h: 1_000_000, // > 500k
        volume_8h: 5_500_000, // > 5M, < 6M (6*vol_1h)
        volume_1d: 15_000_000, // < 16M (16*vol_1h)
      }

      const alerts = evaluateAllFuturesAlerts(metrics)

      expect(alerts).toContain('futures_big_bull_60')
      expect(alerts).toContain('futures_pioneer_bull')
      expect(alerts.length).toBeGreaterThan(0)
    })

    it('should return empty array when no alerts triggered', () => {
      const metrics = createBaseMetrics()
      const alerts = evaluateAllFuturesAlerts(metrics)

      expect(alerts).toEqual([])
    })
  })
})
