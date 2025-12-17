import { describe, it, expect } from 'vitest'
import {
  calculateVCP,
  calculateFibonacciPivots,
  calculateMarketDominance,
  calculateIchimoku,
  type CandlestickForIchimoku,
} from '@/utils/indicators'
import type { Coin } from '@/types/coin'

describe('Technical Indicators', () => {
  describe('calculateVCP', () => {
    it('should calculate VCP correctly for valid coin data', () => {
      const coin: Partial<Coin> = {
        symbol: 'BTCUSDT',
        price: 51000, // Above midpoint to get positive VCP
        weightedAvgPrice: 49500,
        low: 48000,
        high: 52000,
      }

      const vcp = calculateVCP(coin as Coin)

      expect(vcp).toBeGreaterThan(0)
      expect(typeof vcp).toBe('number')
      expect(isFinite(vcp)).toBe(true)
    })

    it('should return 0 for invalid data (zero high-low range)', () => {
      const coin: Partial<Coin> = {
        symbol: 'BTCUSDT',
        price: 50000,
        weightedAvgPrice: 50000,
        low: 50000,
        high: 50000, // Same as low
      }

      const vcp = calculateVCP(coin as Coin)

      expect(vcp).toBe(0)
    })

    it('should handle edge case where close is at low', () => {
      const coin: Partial<Coin> = {
        symbol: 'BTCUSDT',
        price: 48000, // At low
        weightedAvgPrice: 49000,
        low: 48000,
        high: 52000,
      }

      const vcp = calculateVCP(coin as Coin)

      // When price is at low, VCP will be negative (bearish signal)
      expect(vcp).toBeLessThan(0)
      expect(isFinite(vcp)).toBe(true)
    })

    it('should handle edge case where close is at high', () => {
      const coin: Partial<Coin> = {
        symbol: 'BTCUSDT',
        price: 52000, // At high
        weightedAvgPrice: 51000,
        low: 48000,
        high: 52000,
      }

      const vcp = calculateVCP(coin as Coin)

      expect(vcp).toBeGreaterThanOrEqual(0)
      expect(isFinite(vcp)).toBe(true)
    })
  })

  describe('calculateFibonacciPivots', () => {
    it('should calculate all 7 Fibonacci levels correctly', () => {
      const coin: Partial<Coin> = {
        symbol: 'BTCUSDT',
        price: 50000,
        high: 52000,
        low: 48000,
      }

      const pivots = calculateFibonacciPivots(coin as Coin)

      // Check all levels exist
      expect(pivots).toHaveProperty('r3')
      expect(pivots).toHaveProperty('r2')
      expect(pivots).toHaveProperty('r1')
      expect(pivots).toHaveProperty('pivot')
      expect(pivots).toHaveProperty('s1')
      expect(pivots).toHaveProperty('s2')
      expect(pivots).toHaveProperty('s3')

      // All values should be numbers
      Object.values(pivots).forEach((value) => {
        expect(typeof value).toBe('number')
        expect(isFinite(value)).toBe(true)
      })

      // Logical ordering: r3 > r2 > r1 > pivot > s1 > s2 > s3
      expect(pivots.r3).toBeGreaterThan(pivots.r2)
      expect(pivots.r2).toBeGreaterThan(pivots.r1)
      expect(pivots.r1).toBeGreaterThan(pivots.pivot)
      expect(pivots.pivot).toBeGreaterThan(pivots.s1)
      expect(pivots.s1).toBeGreaterThan(pivots.s2)
      expect(pivots.s2).toBeGreaterThan(pivots.s3)
    })

    it('should calculate pivot as average of high, low, and close', () => {
      const coin: Partial<Coin> = {
        symbol: 'BTCUSDT',
        price: 50000,
        high: 60000,
        low: 40000,
      }

      const pivots = calculateFibonacciPivots(coin as Coin)

      // Pivot = (H + L + C) / 3
      const expectedPivot = (60000 + 40000 + 50000) / 3
      expect(pivots.pivot).toBeCloseTo(expectedPivot, 2)
    })

    it('should handle symmetric price range', () => {
      const coin: Partial<Coin> = {
        symbol: 'BTCUSDT',
        price: 50000,
        high: 50000,
        low: 50000,
      }

      const pivots = calculateFibonacciPivots(coin as Coin)

      // When H = L = C, all pivots should equal price
      expect(pivots.pivot).toBe(50000)
      expect(pivots.r1).toBe(50000)
      expect(pivots.s1).toBe(50000)
    })
  })

  describe('calculateMarketDominance', () => {
    it('should calculate dominance percentages for BTC, ETH, and PAXG', () => {
      const coins: Partial<Coin>[] = [
        { symbol: 'BTCUSDT', quoteVolume: 1000000000 }, // 1B
        { symbol: 'ETHUSDT', quoteVolume: 500000000 }, // 500M
        { symbol: 'PAXGUSDT', quoteVolume: 250000000 }, // 250M
        { symbol: 'ADAUSDT', quoteVolume: 250000000 }, // 250M
      ]

      const dominance = calculateMarketDominance(coins as Coin[])

      // Total volume = 2B
      expect(dominance.btcDominance).toBeCloseTo(50, 1) // 1B/2B = 50%
      expect(dominance.ethDominance).toBeCloseTo(25, 1) // 500M/2B = 25%
      expect(dominance.paxgDominance).toBeCloseTo(12.5, 1) // 250M/2B = 12.5%

      // Sum should be reasonable (BTC + ETH dominance)
      expect(dominance.btcDominance + dominance.ethDominance).toBeCloseTo(75, 1)
    })

    it('should return 0 for missing coins', () => {
      const coins: Partial<Coin>[] = [
        { symbol: 'ADAUSDT', quoteVolume: 1000000000 },
        { symbol: 'SOLUSDT', quoteVolume: 500000000 },
      ]

      const dominance = calculateMarketDominance(coins as Coin[])

      expect(dominance.btcDominance).toBe(0)
      expect(dominance.ethDominance).toBe(0)
      expect(dominance.paxgDominance).toBe(0)
    })

    it('should handle empty coin array', () => {
      const dominance = calculateMarketDominance([])

      expect(dominance.btcDominance).toBe(0)
      expect(dominance.ethDominance).toBe(0)
      expect(dominance.paxgDominance).toBe(0)
    })

    it('should calculate 100% dominance for single coin', () => {
      const coins: Partial<Coin>[] = [
        { symbol: 'BTCUSDT', quoteVolume: 1000000000 },
      ]

      const dominance = calculateMarketDominance(coins as Coin[])

      expect(dominance.btcDominance).toBeCloseTo(100, 1)
      expect(dominance.ethDominance).toBe(0)
      expect(dominance.paxgDominance).toBe(0)
    })
  })

  describe('calculateIchimoku', () => {
    // Helper to generate mock candlestick data
    const generateMockCandles = (count: number, basePrice: number = 50000): CandlestickForIchimoku[] => {
      const candles: CandlestickForIchimoku[] = []
      const now = Math.floor(Date.now() / 1000)
      
      for (let i = 0; i < count; i++) {
        const price = basePrice + (Math.random() - 0.5) * 1000 // Random variation
        candles.push({
          time: now - (count - i) * 300, // 5-minute intervals
          high: price + 100,
          low: price - 100,
          close: price,
        })
      }
      
      return candles
    }

    it('should return empty array for insufficient data (<52 candles)', () => {
      const candles = generateMockCandles(51)
      const result = calculateIchimoku(candles)
      
      expect(result).toEqual([])
    })

    it('should calculate Ichimoku for exactly 52 candles', () => {
      const candles = generateMockCandles(52)
      const result = calculateIchimoku(candles)
      
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBe(1) // Only 1 data point with 52 candles
    })

    it('should calculate Ichimoku for 100 candles', () => {
      const candles = generateMockCandles(100)
      const result = calculateIchimoku(candles)
      
      // Should return 49 points (100 - 52 + 1)
      expect(result.length).toBe(49)
    })

    it('should have all required properties for each data point', () => {
      const candles = generateMockCandles(100)
      const result = calculateIchimoku(candles)
      
      expect(result.length).toBeGreaterThan(0)
      
      result.forEach(point => {
        expect(point).toHaveProperty('time')
        expect(point).toHaveProperty('tenkanSen')
        expect(point).toHaveProperty('kijunSen')
        expect(point).toHaveProperty('senkouSpanA')
        expect(point).toHaveProperty('senkouSpanB')
        expect(point).toHaveProperty('chikouSpan')
        
        // All values should be finite numbers
        expect(typeof point.time).toBe('number')
        expect(isFinite(point.tenkanSen)).toBe(true)
        expect(isFinite(point.kijunSen)).toBe(true)
        expect(isFinite(point.senkouSpanA)).toBe(true)
        expect(isFinite(point.senkouSpanB)).toBe(true)
        expect(isFinite(point.chikouSpan)).toBe(true)
      })
    })

    it('should calculate correct Tenkan-sen (9-period)', () => {
      // Create simple test data with known values
      const candles: CandlestickForIchimoku[] = []
      const now = Math.floor(Date.now() / 1000)
      
      // Create 52 candles with predictable values
      for (let i = 0; i < 52; i++) {
        candles.push({
          time: now - (52 - i) * 300,
          high: 100 + i, // Increasing high
          low: 50 + i,   // Increasing low
          close: 75 + i,
        })
      }
      
      const result = calculateIchimoku(candles)
      expect(result.length).toBeGreaterThan(0)
      
      const lastPoint = result[result.length - 1]
      
      // For the last candle (index 51):
      // 9-period high = max of candles[43-51] = 100 + 51 = 151
      // 9-period low = min of candles[43-51] = 50 + 43 = 93
      // Tenkan-sen = (151 + 93) / 2 = 122
      expect(lastPoint.tenkanSen).toBeCloseTo(122, 5)
    })

    it('should calculate correct Kijun-sen (26-period)', () => {
      const candles: CandlestickForIchimoku[] = []
      const now = Math.floor(Date.now() / 1000)
      
      for (let i = 0; i < 52; i++) {
        candles.push({
          time: now - (52 - i) * 300,
          high: 100 + i,
          low: 50 + i,
          close: 75 + i,
        })
      }
      
      const result = calculateIchimoku(candles)
      const lastPoint = result[result.length - 1]
      
      // For the last candle (index 51):
      // 26-period high = max of candles[26-51] = 100 + 51 = 151
      // 26-period low = min of candles[26-51] = 50 + 26 = 76
      // Kijun-sen = (151 + 76) / 2 = 113.5
      expect(lastPoint.kijunSen).toBeCloseTo(113.5, 5)
    })

    it('should calculate Senkou Span A as average of Tenkan and Kijun', () => {
      const candles = generateMockCandles(100)
      const result = calculateIchimoku(candles)
      
      result.forEach(point => {
        const expectedSpanA = (point.tenkanSen + point.kijunSen) / 2
        expect(point.senkouSpanA).toBeCloseTo(expectedSpanA, 5)
      })
    })

    it('should calculate correct Senkou Span B (52-period)', () => {
      const candles: CandlestickForIchimoku[] = []
      const now = Math.floor(Date.now() / 1000)
      
      for (let i = 0; i < 52; i++) {
        candles.push({
          time: now - (52 - i) * 300,
          high: 100 + i,
          low: 50 + i,
          close: 75 + i,
        })
      }
      
      const result = calculateIchimoku(candles)
      const lastPoint = result[result.length - 1]
      
      // For the last candle (index 51):
      // 52-period high = max of all candles[0-51] = 100 + 51 = 151
      // 52-period low = min of all candles[0-51] = 50 + 0 = 50
      // Senkou Span B = (151 + 50) / 2 = 100.5
      expect(lastPoint.senkouSpanB).toBeCloseTo(100.5, 5)
    })

    it('should use close price for Chikou Span', () => {
      const candles: CandlestickForIchimoku[] = []
      const now = Math.floor(Date.now() / 1000)
      const testClosePrice = 12345.67
      
      for (let i = 0; i < 52; i++) {
        candles.push({
          time: now - (52 - i) * 300,
          high: testClosePrice + 100,
          low: testClosePrice - 100,
          close: i === 51 ? testClosePrice : testClosePrice + i,
        })
      }
      
      const result = calculateIchimoku(candles)
      const lastPoint = result[result.length - 1]
      
      // Chikou Span should equal the close price
      expect(lastPoint.chikouSpan).toBeCloseTo(testClosePrice, 5)
    })

    it('should handle custom periods', () => {
      const candles = generateMockCandles(100)
      
      // Test with custom periods
      const result = calculateIchimoku(candles, 7, 22, 44)
      
      // With 44-period senkouB, should have more data points
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBe(100 - 44 + 1) // 57 points
    })

    it('should return empty array when insufficient data for custom periods', () => {
      const candles = generateMockCandles(30)
      
      // Request 52-period but only have 30 candles
      const result = calculateIchimoku(candles, 9, 26, 52)
      
      expect(result).toEqual([])
    })

    it('should handle flat market (all prices same)', () => {
      const candles: CandlestickForIchimoku[] = []
      const now = Math.floor(Date.now() / 1000)
      const flatPrice = 50000
      
      for (let i = 0; i < 52; i++) {
        candles.push({
          time: now - (52 - i) * 300,
          high: flatPrice,
          low: flatPrice,
          close: flatPrice,
        })
      }
      
      const result = calculateIchimoku(candles)
      const point = result[0]
      
      // All lines should equal the flat price
      expect(point.tenkanSen).toBeCloseTo(flatPrice, 5)
      expect(point.kijunSen).toBeCloseTo(flatPrice, 5)
      expect(point.senkouSpanA).toBeCloseTo(flatPrice, 5)
      expect(point.senkouSpanB).toBeCloseTo(flatPrice, 5)
      expect(point.chikouSpan).toBeCloseTo(flatPrice, 5)
    })

    it('should have increasing times in sequence', () => {
      const candles = generateMockCandles(100)
      const result = calculateIchimoku(candles)
      
      for (let i = 1; i < result.length; i++) {
        expect(result[i].time).toBeGreaterThan(result[i - 1].time)
      }
    })

    it('should round values to 6 decimals', () => {
      const candles = generateMockCandles(100, 0.123456789)
      const result = calculateIchimoku(candles)
      
      result.forEach(point => {
        // Check that values are rounded (no more than 6 decimals)
        const tenkanStr = point.tenkanSen.toString()
        const kijunStr = point.kijunSen.toString()
        
        if (tenkanStr.includes('.')) {
          const decimals = tenkanStr.split('.')[1]?.length || 0
          expect(decimals).toBeLessThanOrEqual(6)
        }
        
        if (kijunStr.includes('.')) {
          const decimals = kijunStr.split('.')[1]?.length || 0
          expect(decimals).toBeLessThanOrEqual(6)
        }
      })
    })
  })
})
