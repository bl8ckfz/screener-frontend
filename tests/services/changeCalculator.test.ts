/**
 * Change Calculator Tests
 * 
 * Tests for multi-timeframe price change and volume calculations
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ChangeCalculator } from '@/services/changeCalculator'
import { RingBufferManager } from '@/services/ringBufferManager'
import type { Kline5m } from '@/utils/klineRingBuffer'
import type { Timeframe } from '@/types/metrics'

describe('ChangeCalculator', () => {
  let bufferManager: RingBufferManager
  let calculator: ChangeCalculator

  beforeEach(() => {
    bufferManager = new RingBufferManager()
    calculator = new ChangeCalculator(bufferManager)
  })

  // Helper to create test candle
  const createCandle = (openTime: number, close: number, volume: number = 1000, quoteVolume: number = 100000): Kline5m => ({
    openTime,
    closeTime: openTime + 300000, // +5 minutes
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume,
    quoteVolume,
    isFinal: true
  })

  describe('getChange - Single Timeframe', () => {
    it('should return null for symbol without buffer', () => {
      const result = calculator.getChange('BTCUSDT', '5m')
      expect(result).toBeNull()
    })

    it('should return null when not enough data (5m requires 1 candle)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      const result = calculator.getChange('BTCUSDT', '5m')
      expect(result).toBeNull()
    })

    it('should calculate 5m change (1 candle)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      bufferManager.updateCandle('BTCUSDT', createCandle(1000, 100))

      const result = calculator.getChange('BTCUSDT', '5m')

      expect(result).not.toBeNull()
      expect(result!.priceChange).toBe(0) // Same candle, no change
      expect(result!.priceChangePercent).toBe(0)
      expect(result!.baseVolume).toBe(1000)
      expect(result!.quoteVolume).toBe(100000)
      expect(result!.candleCount).toBe(1)
      expect(result!.windowStart).toBe(1000)
    })

    it('should calculate 15m change (3 candles)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      // Add 3 candles with increasing prices
      bufferManager.updateCandle('BTCUSDT', createCandle(1000, 100, 1000, 100000))
      bufferManager.updateCandle('BTCUSDT', createCandle(1300000, 105, 1200, 126000))
      bufferManager.updateCandle('BTCUSDT', createCandle(1600000, 110, 1100, 121000))

      const result = calculator.getChange('BTCUSDT', '15m')

      expect(result).not.toBeNull()
      expect(result!.priceChange).toBe(10) // 110 - 100
      expect(result!.priceChangePercent).toBeCloseTo(10, 2) // (10/100) * 100
      expect(result!.baseVolume).toBe(3300) // 1000 + 1200 + 1100
      expect(result!.quoteVolume).toBe(347000) // 100000 + 126000 + 121000
      expect(result!.candleCount).toBe(3)
      expect(result!.windowStart).toBe(1000)
      expect(result!.windowEnd).toBe(1600000)
    })

    it('should calculate 1h change (12 candles)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      // Add 12 candles
      for (let i = 0; i < 12; i++) {
        const openTime = 1000 + i * 300000 // 5 min intervals
        const close = 100 + i // Price increases by 1 each candle
        bufferManager.updateCandle('BTCUSDT', createCandle(openTime, close, 1000, 100000))
      }

      const result = calculator.getChange('BTCUSDT', '1h')

      expect(result).not.toBeNull()
      expect(result!.priceChange).toBe(11) // 111 - 100
      expect(result!.priceChangePercent).toBeCloseTo(11, 2)
      expect(result!.baseVolume).toBe(12000) // 12 * 1000
      expect(result!.quoteVolume).toBe(1200000) // 12 * 100000
      expect(result!.candleCount).toBe(12)
    })

    it('should calculate 4h change (48 candles)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      // Add 48 candles
      for (let i = 0; i < 48; i++) {
        const openTime = 1000 + i * 300000
        const close = 100 + i * 0.5 // Price increases by 0.5 each candle
        bufferManager.updateCandle('BTCUSDT', createCandle(openTime, close, 500, 50000))
      }

      const result = calculator.getChange('BTCUSDT', '4h')

      expect(result).not.toBeNull()
      expect(result!.priceChange).toBeCloseTo(23.5, 2) // 47 * 0.5
      expect(result!.priceChangePercent).toBeCloseTo(23.5, 2)
      expect(result!.baseVolume).toBe(24000) // 48 * 500
      expect(result!.quoteVolume).toBe(2400000) // 48 * 50000
      expect(result!.candleCount).toBe(48)
    })

    it('should calculate 8h change (96 candles)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      // Add 96 candles
      for (let i = 0; i < 96; i++) {
        const openTime = 1000 + i * 300000
        const close = 100 + i * 0.1
        bufferManager.updateCandle('BTCUSDT', createCandle(openTime, close, 100, 10000))
      }

      const result = calculator.getChange('BTCUSDT', '8h')

      expect(result).not.toBeNull()
      expect(result!.priceChange).toBeCloseTo(9.5, 2) // 95 * 0.1
      expect(result!.candleCount).toBe(96)
    })

    it('should calculate 12h change (144 candles)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      // Add 144 candles
      for (let i = 0; i < 144; i++) {
        const openTime = 1000 + i * 300000
        const close = 100 + Math.sin(i / 10) * 10 // Oscillating price
        bufferManager.updateCandle('BTCUSDT', createCandle(openTime, close, 100, 10000))
      }

      const result = calculator.getChange('BTCUSDT', '12h')

      expect(result).not.toBeNull()
      expect(result!.candleCount).toBe(144)
      expect(result!.baseVolume).toBe(14400) // 144 * 100
    })

    it('should calculate 1d change (288 candles)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      // Add 288 candles
      for (let i = 0; i < 288; i++) {
        const openTime = 1000 + i * 300000
        const close = 100 + i * 0.05 // Small incremental increase
        bufferManager.updateCandle('BTCUSDT', createCandle(openTime, close, 50, 5000))
      }

      const result = calculator.getChange('BTCUSDT', '1d')

      expect(result).not.toBeNull()
      expect(result!.priceChange).toBeCloseTo(14.35, 2) // 287 * 0.05
      expect(result!.priceChangePercent).toBeCloseTo(14.35, 2)
      expect(result!.baseVolume).toBe(14400) // 288 * 50
      expect(result!.quoteVolume).toBe(1440000) // 288 * 5000
      expect(result!.candleCount).toBe(288)
    })

    it('should return null for 15m when only 2 candles available', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      bufferManager.updateCandle('BTCUSDT', createCandle(1000, 100))
      bufferManager.updateCandle('BTCUSDT', createCandle(1300000, 105))

      const result = calculator.getChange('BTCUSDT', '15m')
      expect(result).toBeNull() // Needs 3 candles, only has 2
    })

    it('should handle price decrease correctly', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      bufferManager.updateCandle('BTCUSDT', createCandle(1000, 100))
      bufferManager.updateCandle('BTCUSDT', createCandle(1300000, 95))
      bufferManager.updateCandle('BTCUSDT', createCandle(1600000, 90))

      const result = calculator.getChange('BTCUSDT', '15m')

      expect(result).not.toBeNull()
      expect(result!.priceChange).toBe(-10) // 90 - 100
      expect(result!.priceChangePercent).toBeCloseTo(-10, 2)
    })

    it('should handle zero volumes', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      bufferManager.updateCandle('BTCUSDT', createCandle(1000, 100, 0, 0))

      const result = calculator.getChange('BTCUSDT', '5m')

      expect(result).not.toBeNull()
      expect(result!.baseVolume).toBe(0)
      expect(result!.quoteVolume).toBe(0)
    })
  })

  describe('getAllChanges - Multiple Timeframes', () => {
    it('should return all nulls for empty buffer', async () => {
      await bufferManager.initialize(['BTCUSDT'])

      const result = calculator.getAllChanges('BTCUSDT')

      expect(result.symbol).toBe('BTCUSDT')
      expect(result.timestamp).toBeGreaterThan(0)
      
      // All timeframes should be null
      expect(result.change_5m).toBeNull()
      expect(result.change_15m).toBeNull()
      expect(result.change_1h).toBeNull()
      expect(result.change_4h).toBeNull()
      expect(result.change_8h).toBeNull()
      expect(result.change_12h).toBeNull()
      expect(result.change_1d).toBeNull()
    })

    it('should return 5m data only when 1 candle available', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      bufferManager.updateCandle('BTCUSDT', createCandle(1000, 100, 1000, 100000))

      const result = calculator.getAllChanges('BTCUSDT')

      // Only 5m should have data
      expect(result.change_5m).not.toBeNull()
      expect(result.baseVolume_5m).toBe(1000)
      expect(result.quoteVolume_5m).toBe(100000)
      
      // Rest should be null
      expect(result.change_15m).toBeNull()
      expect(result.change_1h).toBeNull()
      expect(result.change_4h).toBeNull()
      expect(result.change_8h).toBeNull()
      expect(result.change_12h).toBeNull()
      expect(result.change_1d).toBeNull()
    })

    it('should return 5m and 15m data when 3 candles available', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      for (let i = 0; i < 3; i++) {
        bufferManager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i, 1000, 100000))
      }

      const result = calculator.getAllChanges('BTCUSDT')

      // 5m and 15m should have data
      expect(result.change_5m).not.toBeNull()
      expect(result.change_15m).not.toBeNull()
      
      // Rest should be null
      expect(result.change_1h).toBeNull()
      expect(result.change_4h).toBeNull()
    })

    it('should return all timeframes when 288 candles available', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      for (let i = 0; i < 288; i++) {
        bufferManager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i * 0.1, 1000, 100000))
      }

      const result = calculator.getAllChanges('BTCUSDT')

      // All timeframes should have data
      expect(result.change_5m).not.toBeNull()
      expect(result.change_15m).not.toBeNull()
      expect(result.change_1h).not.toBeNull()
      expect(result.change_4h).not.toBeNull()
      expect(result.change_8h).not.toBeNull()
      expect(result.change_12h).not.toBeNull()
      expect(result.change_1d).not.toBeNull()
      
      // Verify volumes are populated
      expect(result.baseVolume_5m).toBeGreaterThan(0)
      expect(result.baseVolume_15m).toBeGreaterThan(0)
      expect(result.baseVolume_1h).toBeGreaterThan(0)
      expect(result.baseVolume_4h).toBeGreaterThan(0)
      expect(result.baseVolume_8h).toBeGreaterThan(0)
      expect(result.baseVolume_12h).toBeGreaterThan(0)
      expect(result.baseVolume_1d).toBeGreaterThan(0)
    })

    it('should handle non-existent symbol gracefully', () => {
      const result = calculator.getAllChanges('NONEXISTENT')

      expect(result.symbol).toBe('NONEXISTENT')
      expect(result.change_5m).toBeNull()
      expect(result.change_15m).toBeNull()
      expect(result.change_1h).toBeNull()
    })
  })

  describe('getAllSymbolsChanges - Multi-Symbol', () => {
    it('should return empty map when no symbols initialized', () => {
      const result = calculator.getAllSymbolsChanges()
      expect(result.size).toBe(0)
    })

    it('should calculate metrics for all symbols', async () => {
      await bufferManager.initialize(['BTCUSDT', 'ETHUSDT', 'BNBUSDT'])
      
      // Add data to each symbol
      for (let i = 0; i < 12; i++) {
        bufferManager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
        bufferManager.updateCandle('ETHUSDT', createCandle(1000 + i * 300000, 200 + i * 2))
        bufferManager.updateCandle('BNBUSDT', createCandle(1000 + i * 300000, 50 + i * 0.5))
      }

      const result = calculator.getAllSymbolsChanges()

      expect(result.size).toBe(3)
      expect(result.has('BTCUSDT')).toBe(true)
      expect(result.has('ETHUSDT')).toBe(true)
      expect(result.has('BNBUSDT')).toBe(true)

      // Verify each has 1h data (12 candles)
      expect(result.get('BTCUSDT')!.change_1h).not.toBeNull()
      expect(result.get('ETHUSDT')!.change_1h).not.toBeNull()
      expect(result.get('BNBUSDT')!.change_1h).not.toBeNull()
    })

    it('should handle mixed warm-up states', async () => {
      await bufferManager.initialize(['BTCUSDT', 'ETHUSDT'])
      
      // BTCUSDT: 12 candles (1h ready)
      for (let i = 0; i < 12; i++) {
        bufferManager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      
      // ETHUSDT: 3 candles (only 15m ready)
      for (let i = 0; i < 3; i++) {
        bufferManager.updateCandle('ETHUSDT', createCandle(1000 + i * 300000, 200 + i))
      }

      const result = calculator.getAllSymbolsChanges()

      expect(result.size).toBe(2)
      
      // BTCUSDT should have 1h data
      expect(result.get('BTCUSDT')!.change_1h).not.toBeNull()
      
      // ETHUSDT should NOT have 1h data
      expect(result.get('ETHUSDT')!.change_1h).toBeNull()
      expect(result.get('ETHUSDT')!.change_15m).not.toBeNull()
    })
  })

  describe('getReadySymbols - Filtering', () => {
    it('should return empty array when no symbols ready', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      const result = calculator.getReadySymbols('5m')
      expect(result).toEqual([])
    })

    it('should return symbols ready for specific timeframe', async () => {
      await bufferManager.initialize(['BTCUSDT', 'ETHUSDT', 'BNBUSDT'])
      
      // BTCUSDT: 12 candles (5m, 15m, 1h ready)
      for (let i = 0; i < 12; i++) {
        bufferManager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      
      // ETHUSDT: 3 candles (5m, 15m ready)
      for (let i = 0; i < 3; i++) {
        bufferManager.updateCandle('ETHUSDT', createCandle(1000 + i * 300000, 200 + i))
      }
      
      // BNBUSDT: 1 candle (only 5m ready)
      bufferManager.updateCandle('BNBUSDT', createCandle(1000, 50))

      expect(calculator.getReadySymbols('5m')).toEqual(['BTCUSDT', 'ETHUSDT', 'BNBUSDT'])
      expect(calculator.getReadySymbols('15m')).toEqual(['BTCUSDT', 'ETHUSDT'])
      expect(calculator.getReadySymbols('1h')).toEqual(['BTCUSDT'])
      expect(calculator.getReadySymbols('4h')).toEqual([])
    })
  })

  describe('isReady - Individual Checks', () => {
    it('should return false for non-existent symbol', () => {
      expect(calculator.isReady('NONEXISTENT', '5m')).toBe(false)
    })

    it('should return false for insufficient data', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      bufferManager.updateCandle('BTCUSDT', createCandle(1000, 100))

      expect(calculator.isReady('BTCUSDT', '5m')).toBe(true)
      expect(calculator.isReady('BTCUSDT', '15m')).toBe(false)
    })

    it('should return true when enough data available', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      for (let i = 0; i < 12; i++) {
        bufferManager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }

      expect(calculator.isReady('BTCUSDT', '5m')).toBe(true)
      expect(calculator.isReady('BTCUSDT', '15m')).toBe(true)
      expect(calculator.isReady('BTCUSDT', '1h')).toBe(true)
      expect(calculator.isReady('BTCUSDT', '4h')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large volume numbers', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      const largeVolume = 1000000000 // 1 billion
      bufferManager.updateCandle('BTCUSDT', createCandle(1000, 100, largeVolume, largeVolume * 100))

      const result = calculator.getChange('BTCUSDT', '5m')

      expect(result).not.toBeNull()
      expect(result!.baseVolume).toBe(largeVolume)
      expect(result!.quoteVolume).toBe(largeVolume * 100)
    })

    it('should handle price at zero (edge case)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      bufferManager.updateCandle('BTCUSDT', createCandle(1000, 0.00001, 1000, 100))

      const result = calculator.getChange('BTCUSDT', '5m')

      expect(result).not.toBeNull()
      expect(result!.priceChange).toBe(0)
      expect(result!.priceChangePercent).toBe(0)
    })

    it('should handle exact 288 candles (boundary)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      // Add exactly 288 candles
      for (let i = 0; i < 288; i++) {
        bufferManager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i * 0.01))
      }

      const result = calculator.getChange('BTCUSDT', '1d')

      expect(result).not.toBeNull()
      expect(result!.candleCount).toBe(288)
    })

    it('should handle more than 288 candles (buffer wraparound)', async () => {
      await bufferManager.initialize(['BTCUSDT'])
      
      // Add 300 candles (12 more than buffer capacity)
      for (let i = 0; i < 300; i++) {
        bufferManager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i * 0.01))
      }

      const result = calculator.getChange('BTCUSDT', '1d')

      expect(result).not.toBeNull()
      expect(result!.candleCount).toBe(288) // Still uses last 288
      
      // Should use candles 12-299 (oldest 12 were overwritten)
      const oldestTime = 1000 + 12 * 300000
      expect(result!.windowStart).toBe(oldestTime)
    })
  })
})
