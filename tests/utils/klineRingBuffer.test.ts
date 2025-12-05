/**
 * Tests for KlineRingBuffer - Circular buffer for 5-minute klines
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { KlineRingBuffer, type Kline5m } from '@/utils/klineRingBuffer'

// Helper to create mock candle
function createCandle(timestamp: number, close: number): Kline5m {
  return {
    openTime: timestamp,
    closeTime: timestamp + 300000, // +5 minutes
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close: close,
    volume: 1000,
    quoteVolume: 1000000,
    isFinal: true
  }
}

describe('KlineRingBuffer', () => {
  let buffer: KlineRingBuffer

  beforeEach(() => {
    buffer = new KlineRingBuffer('BTCUSDT')
  })

  describe('Initialization', () => {
    it('should initialize with correct symbol', () => {
      expect(buffer.symbol).toBe('BTCUSDT')
    })

    it('should start empty', () => {
      expect(buffer.getCount()).toBe(0)
      expect(buffer.isFull()).toBe(false)
      expect(buffer.getFillPercentage()).toBe(0)
    })

    it('should have capacity of 288', () => {
      expect(buffer.getCapacity()).toBe(288)
    })

    it('should return null for oldest/newest when empty', () => {
      expect(buffer.getOldestCandle()).toBeNull()
      expect(buffer.getNewestCandle()).toBeNull()
    })
  })

  describe('Push Single Candle', () => {
    it('should push a valid candle', () => {
      const candle = createCandle(1000, 100)
      buffer.push(candle)

      expect(buffer.getCount()).toBe(1)
      expect(buffer.getFillPercentage()).toBeCloseTo(0.35, 1) // 1/288 = 0.347%
    })

    it('should reject invalid candle (missing openTime)', () => {
      const invalidCandle = { close: 100 } as Kline5m
      
      expect(() => buffer.push(invalidCandle)).toThrow('Invalid candle')
    })

    it('should reject invalid candle (missing close)', () => {
      const invalidCandle = { openTime: 1000 } as Kline5m
      
      expect(() => buffer.push(invalidCandle)).toThrow('Invalid candle')
    })

    it('should allow close to be 0', () => {
      const candle = createCandle(1000, 0)
      expect(() => buffer.push(candle)).not.toThrow()
      expect(buffer.getCount()).toBe(1)
    })
  })

  describe('Push Multiple Candles', () => {
    it('should push 10 candles', () => {
      for (let i = 0; i < 10; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      expect(buffer.getCount()).toBe(10)
      expect(buffer.isFull()).toBe(false)
    })

    it('should push exactly 288 candles (full buffer)', () => {
      for (let i = 0; i < 288; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      expect(buffer.getCount()).toBe(288)
      expect(buffer.isFull()).toBe(true)
      expect(buffer.getFillPercentage()).toBe(100)
    })

    it('should overwrite oldest when pushing 289th candle', () => {
      // Fill buffer with 288 candles
      for (let i = 0; i < 288; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      const oldest = buffer.getOldestCandle()
      expect(oldest?.close).toBe(100) // First candle

      // Push one more (should overwrite first)
      buffer.push(createCandle(1000 + 288 * 300000, 388))

      expect(buffer.getCount()).toBe(288) // Still 288
      expect(buffer.isFull()).toBe(true)

      const newOldest = buffer.getOldestCandle()
      expect(newOldest?.close).toBe(101) // Second candle is now oldest
    })

    it('should handle pushing 300 candles (12 overwrites)', () => {
      for (let i = 0; i < 300; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      expect(buffer.getCount()).toBe(288)
      expect(buffer.isFull()).toBe(true)

      // Oldest should be candle #13 (12 were overwritten)
      const oldest = buffer.getOldestCandle()
      expect(oldest?.close).toBe(112) // 100 + 12

      // Newest should be candle #300
      const newest = buffer.getNewestCandle()
      expect(newest?.close).toBe(399) // 100 + 299
    })
  })

  describe('getLastN()', () => {
    beforeEach(() => {
      // Add 10 candles for testing
      for (let i = 0; i < 10; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }
    })

    it('should get last 1 candle', () => {
      const candles = buffer.getLastN(1)
      
      expect(candles).toHaveLength(1)
      expect(candles[0].close).toBe(109) // Last candle
    })

    it('should get last 3 candles in order', () => {
      const candles = buffer.getLastN(3)
      
      expect(candles).toHaveLength(3)
      expect(candles[0].close).toBe(107) // 3rd from last
      expect(candles[1].close).toBe(108) // 2nd from last
      expect(candles[2].close).toBe(109) // Last
    })

    it('should get last 5 candles', () => {
      const candles = buffer.getLastN(5)
      
      expect(candles).toHaveLength(5)
      expect(candles[0].close).toBe(105)
      expect(candles[4].close).toBe(109)
    })

    it('should get all 10 candles', () => {
      const candles = buffer.getLastN(10)
      
      expect(candles).toHaveLength(10)
      expect(candles[0].close).toBe(100)
      expect(candles[9].close).toBe(109)
    })

    it('should throw error when requesting more than available', () => {
      expect(() => buffer.getLastN(11)).toThrow('Not enough data')
    })

    it('should return empty array for N=0', () => {
      const candles = buffer.getLastN(0)
      expect(candles).toHaveLength(0)
    })

    it('should return empty array for negative N', () => {
      const candles = buffer.getLastN(-1)
      expect(candles).toHaveLength(0)
    })
  })

  describe('getLastN() with Full Buffer', () => {
    beforeEach(() => {
      // Fill buffer completely with 288 candles
      for (let i = 0; i < 288; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }
    })

    it('should get last 1 candle from full buffer', () => {
      const candles = buffer.getLastN(1)
      expect(candles[0].close).toBe(387) // 100 + 287
    })

    it('should get last 12 candles (1 hour)', () => {
      const candles = buffer.getLastN(12)
      
      expect(candles).toHaveLength(12)
      expect(candles[0].close).toBe(376) // 100 + 276
      expect(candles[11].close).toBe(387) // 100 + 287
    })

    it('should get last 96 candles (8 hours)', () => {
      const candles = buffer.getLastN(96)
      
      expect(candles).toHaveLength(96)
      expect(candles[0].close).toBe(292) // 100 + 192
      expect(candles[95].close).toBe(387) // 100 + 287
    })

    it('should get all 288 candles', () => {
      const candles = buffer.getLastN(288)
      
      expect(candles).toHaveLength(288)
      expect(candles[0].close).toBe(100)
      expect(candles[287].close).toBe(387)
    })
  })

  describe('getLastN() with Wraparound', () => {
    it('should handle wraparound correctly', () => {
      // Fill buffer + 5 more (wraps head to position 5)
      for (let i = 0; i < 293; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      // Get last 10 candles
      const candles = buffer.getLastN(10)
      
      expect(candles).toHaveLength(10)
      // Should be candles 284-293 (close values 383-392)
      expect(candles[0].close).toBe(383) // 100 + 283
      expect(candles[9].close).toBe(392) // 100 + 292
    })

    it('should handle multiple wraparounds', () => {
      // Add 500 candles (wrapped around almost twice)
      for (let i = 0; i < 500; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      expect(buffer.getCount()).toBe(288)

      // Get last 288 candles (full buffer)
      const candles = buffer.getLastN(288)
      
      // Should be candles 213-500 (212 were overwritten)
      expect(candles[0].close).toBe(312) // 100 + 212
      expect(candles[287].close).toBe(599) // 100 + 499
    })
  })

  describe('Oldest and Newest Candles', () => {
    it('should track oldest candle correctly (not full)', () => {
      for (let i = 0; i < 10; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      const oldest = buffer.getOldestCandle()
      expect(oldest?.close).toBe(100)
    })

    it('should track newest candle correctly (not full)', () => {
      for (let i = 0; i < 10; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      const newest = buffer.getNewestCandle()
      expect(newest?.close).toBe(109)
    })

    it('should track oldest candle correctly (full buffer)', () => {
      for (let i = 0; i < 288; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      const oldest = buffer.getOldestCandle()
      expect(oldest?.close).toBe(100)
    })

    it('should track oldest candle after wraparound', () => {
      for (let i = 0; i < 300; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      const oldest = buffer.getOldestCandle()
      expect(oldest?.close).toBe(112) // First 12 overwritten
    })

    it('should update newest candle after each push', () => {
      buffer.push(createCandle(1000, 100))
      expect(buffer.getNewestCandle()?.close).toBe(100)

      buffer.push(createCandle(2000, 200))
      expect(buffer.getNewestCandle()?.close).toBe(200)

      buffer.push(createCandle(3000, 300))
      expect(buffer.getNewestCandle()?.close).toBe(300)
    })
  })

  describe('hasEnoughData()', () => {
    beforeEach(() => {
      for (let i = 0; i < 100; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }
    })

    it('should return true when enough data', () => {
      expect(buffer.hasEnoughData(1)).toBe(true)
      expect(buffer.hasEnoughData(50)).toBe(true)
      expect(buffer.hasEnoughData(100)).toBe(true)
    })

    it('should return false when not enough data', () => {
      expect(buffer.hasEnoughData(101)).toBe(false)
      expect(buffer.hasEnoughData(200)).toBe(false)
      expect(buffer.hasEnoughData(288)).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(buffer.hasEnoughData(0)).toBe(true)
      expect(buffer.hasEnoughData(-1)).toBe(true) // Technically true (has more than -1)
    })
  })

  describe('Clear Buffer', () => {
    it('should clear all data', () => {
      for (let i = 0; i < 10; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      expect(buffer.getCount()).toBe(10)

      buffer.clear()

      expect(buffer.getCount()).toBe(0)
      expect(buffer.isFull()).toBe(false)
      expect(buffer.getFillPercentage()).toBe(0)
      expect(buffer.getOldestCandle()).toBeNull()
      expect(buffer.getNewestCandle()).toBeNull()
    })

    it('should allow pushing after clear', () => {
      for (let i = 0; i < 10; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      buffer.clear()

      buffer.push(createCandle(5000, 500))
      
      expect(buffer.getCount()).toBe(1)
      expect(buffer.getNewestCandle()?.close).toBe(500)
    })
  })

  describe('Debug Info', () => {
    it('should return correct debug info for empty buffer', () => {
      const info = buffer.getDebugInfo()

      expect(info).toEqual({
        symbol: 'BTCUSDT',
        count: 0,
        capacity: 288,
        head: 0,
        fillPercentage: 0,
        isFull: false
      })
    })

    it('should return correct debug info for partial buffer', () => {
      for (let i = 0; i < 50; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      const info = buffer.getDebugInfo()

      expect(info.symbol).toBe('BTCUSDT')
      expect(info.count).toBe(50)
      expect(info.capacity).toBe(288)
      expect(info.head).toBe(50)
      expect(info.fillPercentage).toBeCloseTo(17.36, 1)
      expect(info.isFull).toBe(false)
    })

    it('should return correct debug info for full buffer', () => {
      for (let i = 0; i < 288; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      const info = buffer.getDebugInfo()

      expect(info.count).toBe(288)
      expect(info.head).toBe(0) // Wrapped back to 0
      expect(info.fillPercentage).toBe(100)
      expect(info.isFull).toBe(true)
    })
  })

  describe('Memory Efficiency', () => {
    it('should not grow beyond capacity', () => {
      // Push 1000 candles
      for (let i = 0; i < 1000; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      // Count should stay at 288
      expect(buffer.getCount()).toBe(288)
      expect(buffer.getCapacity()).toBe(288)
    })

    it('should reuse memory slots', () => {
      // Fill buffer
      for (let i = 0; i < 288; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      const firstFill = buffer.getOldestCandle()

      // Overwrite with 288 more
      for (let i = 288; i < 576; i++) {
        buffer.push(createCandle(1000 + i * 300000, 100 + i))
      }

      const secondFill = buffer.getOldestCandle()

      // Old data should be completely replaced
      expect(firstFill?.close).not.toBe(secondFill?.close)
      expect(buffer.getCount()).toBe(288) // Size unchanged
    })
  })
})
