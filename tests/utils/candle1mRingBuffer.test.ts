import { describe, it, expect, beforeEach } from 'vitest'
import { Candle1mRingBuffer } from '@/utils/candle1mRingBuffer'
import type { Candle1m } from '@/types/api'

describe('Candle1mRingBuffer', () => {
  let buffer: Candle1mRingBuffer
  
  // Helper to create test candle
  const createCandle = (time: number, close: number = 50000): Candle1m => ({
    openTime: time,
    close,
    volume: 100,
    quoteVolume: close * 100,
  })
  
  beforeEach(() => {
    buffer = new Candle1mRingBuffer('BTCUSDT')
  })
  
  describe('Initialization', () => {
    it('should create empty buffer with correct capacity', () => {
      expect(buffer.getCount()).toBe(0)
      expect(buffer.getCapacity()).toBe(1440)
      expect(buffer.symbol).toBe('BTCUSDT')
    })
    
    it('should have 0% fill on init', () => {
      expect(buffer.getFillPercentage()).toBe(0)
    })
    
    it('should return null for newest/oldest when empty', () => {
      expect(buffer.getNewest()).toBeNull()
      expect(buffer.getOldest(1)).toBeNull()
    })
  })
  
  describe('Push Operations', () => {
    it('should add single candle', () => {
      const candle = createCandle(1000)
      const evicted = buffer.push(candle)
      
      expect(evicted).toBeNull() // No eviction when not full
      expect(buffer.getCount()).toBe(1)
      expect(buffer.getNewest()).toEqual(candle)
    })
    
    it('should add multiple candles', () => {
      buffer.push(createCandle(1000))
      buffer.push(createCandle(2000))
      buffer.push(createCandle(3000))
      
      expect(buffer.getCount()).toBe(3)
      expect(buffer.getNewest()?.openTime).toBe(3000)
    })
    
    it('should handle circular wraparound', () => {
      // Fill buffer completely
      for (let i = 0; i < 1440; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      expect(buffer.getCount()).toBe(1440)
      expect(buffer.getFillPercentage()).toBe(100)
    })
    
    it('should evict oldest candle when full', () => {
      // Fill buffer
      for (let i = 0; i < 1440; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      // Add one more (should evict first candle)
      const oldest = buffer.get(0)
      const evicted = buffer.push(createCandle(1440 * 60000))
      
      expect(evicted).toEqual(oldest)
      expect(buffer.getCount()).toBe(1440) // Still 1440
    })
    
    it('should maintain correct order after wraparound', () => {
      // Fill + overflow
      for (let i = 0; i < 1500; i++) {
        buffer.push(createCandle(i * 60000))
      })
      
      // Should have candles 60-1499 (1440 candles)
      const oldest = buffer.get(0)
      const newest = buffer.getNewest()
      
      expect(oldest?.openTime).toBe(60 * 60000)
      expect(newest?.openTime).toBe(1499 * 60000)
    })
  })
  
  describe('Index Access - get(i)', () => {
    beforeEach(() => {
      // Add 10 candles
      for (let i = 0; i < 10; i++) {
        buffer.push(createCandle(i * 60000, 50000 + i))
      }
    })
    
    it('should get candle at index 0 (oldest)', () => {
      const candle = buffer.get(0)
      expect(candle?.openTime).toBe(0)
      expect(candle?.close).toBe(50000)
    })
    
    it('should get candle at index count-1 (newest)', () => {
      const candle = buffer.get(9)
      expect(candle?.openTime).toBe(9 * 60000)
      expect(candle?.close).toBe(50009)
    })
    
    it('should get candle at middle index', () => {
      const candle = buffer.get(5)
      expect(candle?.openTime).toBe(5 * 60000)
      expect(candle?.close).toBe(50005)
    })
    
    it('should return null for negative index', () => {
      expect(buffer.get(-1)).toBeNull()
    })
    
    it('should return null for index >= count', () => {
      expect(buffer.get(10)).toBeNull()
      expect(buffer.get(100)).toBeNull()
    })
    
    it('should handle wraparound correctly', () => {
      // Fill buffer + add more to trigger wraparound
      for (let i = 10; i < 1450; i++) {
        buffer.push(createCandle(i * 60000, 50000 + i))
      }
      
      // Should have candles 10-1449
      const oldest = buffer.get(0)
      const newest = buffer.get(1439)
      
      expect(oldest?.openTime).toBe(10 * 60000)
      expect(newest?.openTime).toBe(1449 * 60000)
    })
  })
  
  describe('Boundary Access', () => {
    beforeEach(() => {
      // Add 100 candles
      for (let i = 0; i < 100; i++) {
        buffer.push(createCandle(i * 60000, 50000 + i))
      }
    })
    
    it('getNewest() should return most recent candle', () => {
      const newest = buffer.getNewest()
      expect(newest?.openTime).toBe(99 * 60000)
      expect(newest?.close).toBe(50099)
    })
    
    it('getOldest(n) should return candle n positions back', () => {
      // Get oldest candle in 60-candle window
      const oldest = buffer.getOldest(60)
      expect(oldest?.openTime).toBe((100 - 60) * 60000)
      expect(oldest?.close).toBe(50040)
    })
    
    it('getOldest(1) should return newest candle', () => {
      const oldest = buffer.getOldest(1)
      const newest = buffer.getNewest()
      expect(oldest).toEqual(newest)
    })
    
    it('getOldest(count) should return oldest candle', () => {
      const oldest = buffer.getOldest(100)
      expect(oldest?.openTime).toBe(0)
      expect(oldest?.close).toBe(50000)
    })
    
    it('getOldest(n) should return null if n > count', () => {
      expect(buffer.getOldest(101)).toBeNull()
      expect(buffer.getOldest(1000)).toBeNull()
    })
    
    it('getOldest(0) should return null', () => {
      expect(buffer.getOldest(0)).toBeNull()
    })
    
    it('getOldest(-1) should return null', () => {
      expect(buffer.getOldest(-1)).toBeNull()
    })
  })
  
  describe('Window Availability', () => {
    it('hasWindow(n) should return false for empty buffer', () => {
      expect(buffer.hasWindow(1)).toBe(false)
      expect(buffer.hasWindow(60)).toBe(false)
    })
    
    it('hasWindow(n) should return true if count >= n', () => {
      // Add 60 candles
      for (let i = 0; i < 60; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      expect(buffer.hasWindow(60)).toBe(true)
      expect(buffer.hasWindow(30)).toBe(true)
      expect(buffer.hasWindow(1)).toBe(true)
    })
    
    it('hasWindow(n) should return false if count < n', () => {
      // Add 50 candles
      for (let i = 0; i < 50; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      expect(buffer.hasWindow(60)).toBe(false)
      expect(buffer.hasWindow(100)).toBe(false)
    })
    
    it('should check all standard windows', () => {
      // Add enough candles for all windows
      for (let i = 0; i < 1440; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      expect(buffer.hasWindow(5)).toBe(true)    // 5m
      expect(buffer.hasWindow(15)).toBe(true)   // 15m
      expect(buffer.hasWindow(60)).toBe(true)   // 1h
      expect(buffer.hasWindow(480)).toBe(true)  // 8h
      expect(buffer.hasWindow(1440)).toBe(true) // 1d
    })
  })
  
  describe('Utility Methods', () => {
    it('getFillPercentage() should calculate correctly', () => {
      expect(buffer.getFillPercentage()).toBe(0)
      
      // Add 720 candles (50%)
      for (let i = 0; i < 720; i++) {
        buffer.push(createCandle(i * 60000))
      }
      expect(buffer.getFillPercentage()).toBe(50)
      
      // Fill completely
      for (let i = 720; i < 1440; i++) {
        buffer.push(createCandle(i * 60000))
      }
      expect(buffer.getFillPercentage()).toBe(100)
    })
    
    it('clear() should reset buffer', () => {
      // Add candles
      for (let i = 0; i < 100; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      buffer.clear()
      
      expect(buffer.getCount()).toBe(0)
      expect(buffer.getFillPercentage()).toBe(0)
      expect(buffer.getNewest()).toBeNull()
    })
    
    it('toArray() should return candles in order', () => {
      // Add 5 candles
      for (let i = 0; i < 5; i++) {
        buffer.push(createCandle(i * 60000, 50000 + i))
      }
      
      const array = buffer.toArray()
      
      expect(array.length).toBe(5)
      expect(array[0].openTime).toBe(0)
      expect(array[4].openTime).toBe(4 * 60000)
      expect(array[0].close).toBe(50000)
      expect(array[4].close).toBe(50004)
    })
    
    it('toArray() should handle wraparound', () => {
      // Fill + overflow
      for (let i = 0; i < 1450; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      const array = buffer.toArray()
      
      expect(array.length).toBe(1440)
      expect(array[0].openTime).toBe(10 * 60000) // First 10 evicted
      expect(array[1439].openTime).toBe(1449 * 60000)
    })
    
    it('getDebugInfo() should return correct info', () => {
      // Add 100 candles
      for (let i = 0; i < 100; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      const debug = buffer.getDebugInfo()
      
      expect(debug.symbol).toBe('BTCUSDT')
      expect(debug.count).toBe(100)
      expect(debug.capacity).toBe(1440)
      expect(debug.fillPercentage).toBeCloseTo(6.94, 1)
      expect(debug.oldestTime).toBe(0)
      expect(debug.newestTime).toBe(99 * 60000)
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle single candle correctly', () => {
      const candle = createCandle(1000, 50000)
      buffer.push(candle)
      
      expect(buffer.getNewest()).toEqual(candle)
      expect(buffer.getOldest(1)).toEqual(candle)
      expect(buffer.get(0)).toEqual(candle)
      expect(buffer.hasWindow(1)).toBe(true)
      expect(buffer.hasWindow(2)).toBe(false)
    })
    
    it('should handle exact capacity fill', () => {
      // Add exactly 1440 candles
      for (let i = 0; i < 1440; i++) {
        const evicted = buffer.push(createCandle(i * 60000))
        expect(evicted).toBeNull() // No eviction until full
      }
      
      expect(buffer.getCount()).toBe(1440)
      expect(buffer.getFillPercentage()).toBe(100)
      
      // Add one more (should evict)
      const evicted = buffer.push(createCandle(1440 * 60000))
      expect(evicted).not.toBeNull()
      expect(buffer.getCount()).toBe(1440)
    })
    
    it('should handle large volume numbers', () => {
      const candle = createCandle(1000, 50000)
      candle.volume = 1e9 // 1 billion
      candle.quoteVolume = 50e12 // 50 trillion
      
      buffer.push(candle)
      const retrieved = buffer.getNewest()
      
      expect(retrieved?.volume).toBe(1e9)
      expect(retrieved?.quoteVolume).toBe(50e12)
    })
    
    it('should maintain precision with float values', () => {
      const candle = createCandle(1000, 50123.456789)
      buffer.push(candle)
      
      const retrieved = buffer.getNewest()
      expect(retrieved?.close).toBe(50123.456789)
    })
    
    it('should handle multiple clears', () => {
      buffer.push(createCandle(1000))
      buffer.clear()
      buffer.push(createCandle(2000))
      buffer.clear()
      
      expect(buffer.getCount()).toBe(0)
    })
    
    it('should handle push after clear', () => {
      // Fill buffer
      for (let i = 0; i < 1440; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      buffer.clear()
      
      // Add new candles
      buffer.push(createCandle(1000))
      buffer.push(createCandle(2000))
      
      expect(buffer.getCount()).toBe(2)
      expect(buffer.get(0)?.openTime).toBe(1000)
      expect(buffer.get(1)?.openTime).toBe(2000)
    })
  })
  
  describe('Memory Efficiency', () => {
    it('should not grow beyond capacity', () => {
      const initialCapacity = buffer.getCapacity()
      
      // Add way more than capacity
      for (let i = 0; i < 3000; i++) {
        buffer.push(createCandle(i * 60000))
      }
      
      expect(buffer.getCapacity()).toBe(initialCapacity)
      expect(buffer.getCount()).toBe(1440)
    })
    
    it('should reuse array slots on wraparound', () => {
      // Fill buffer twice (test slot reuse)
      for (let i = 0; i < 2880; i++) {
        buffer.push(createCandle(i * 60000, 50000 + i))
      }
      
      // Should have candles 1440-2879
      const oldest = buffer.get(0)
      expect(oldest?.openTime).toBe(1440 * 60000)
      expect(oldest?.close).toBe(51440)
    })
  })
})
