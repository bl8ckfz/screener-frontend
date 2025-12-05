/**
 * Tests for RingBufferManager
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { RingBufferManager, type Timeframe } from '@/services/ringBufferManager'
import type { Kline5m } from '@/utils/klineRingBuffer'

// Helper to create mock candle
function createCandle(timestamp: number, close: number, isFinal = true): Kline5m {
  return {
    openTime: timestamp,
    closeTime: timestamp + 300000,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close: close,
    volume: 1000,
    quoteVolume: 1000000,
    isFinal
  }
}

describe('RingBufferManager', () => {
  let manager: RingBufferManager

  beforeEach(() => {
    manager = new RingBufferManager()
  })

  describe('Initialization', () => {
    it('should initialize with empty buffers', () => {
      expect(manager.getSymbolCount()).toBe(0)
      expect(manager.getSymbols()).toEqual([])
    })

    it('should initialize buffers for given symbols', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
      await manager.initialize(symbols)

      expect(manager.getSymbolCount()).toBe(3)
      expect(manager.getSymbols()).toEqual(symbols)
    })

    it('should not duplicate buffers on re-initialization', async () => {
      await manager.initialize(['BTCUSDT', 'ETHUSDT'])
      await manager.initialize(['BTCUSDT', 'BNBUSDT']) // BTCUSDT already exists

      expect(manager.getSymbolCount()).toBe(3)
      const symbols = manager.getSymbols()
      expect(symbols).toContain('BTCUSDT')
      expect(symbols).toContain('ETHUSDT')
      expect(symbols).toContain('BNBUSDT')
    })

    it('should initialize empty array', async () => {
      await manager.initialize([])
      expect(manager.getSymbolCount()).toBe(0)
    })
  })

  describe('Update Candle', () => {
    beforeEach(async () => {
      await manager.initialize(['BTCUSDT'])
    })

    it('should update buffer with final candle', () => {
      const candle = createCandle(1000, 100, true)
      manager.updateCandle('BTCUSDT', candle)

      const buffer = manager.getBuffer('BTCUSDT')
      expect(buffer?.getCount()).toBe(1)
    })

    it('should ignore non-final candles', () => {
      const candle = createCandle(1000, 100, false)
      manager.updateCandle('BTCUSDT', candle)

      const buffer = manager.getBuffer('BTCUSDT')
      expect(buffer?.getCount()).toBe(0)
    })

    it('should auto-create buffer for new symbol', () => {
      const candle = createCandle(1000, 100, true)
      manager.updateCandle('NEWUSDT', candle) // Symbol not initialized

      expect(manager.getSymbolCount()).toBe(2) // BTCUSDT + NEWUSDT
      const buffer = manager.getBuffer('NEWUSDT')
      expect(buffer?.getCount()).toBe(1)
    })

    it('should handle multiple candles', () => {
      for (let i = 0; i < 10; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i, true))
      }

      const buffer = manager.getBuffer('BTCUSDT')
      expect(buffer?.getCount()).toBe(10)
    })

    it('should handle mixed final and non-final candles', () => {
      manager.updateCandle('BTCUSDT', createCandle(1000, 100, true))  // Count: 1
      manager.updateCandle('BTCUSDT', createCandle(2000, 101, false)) // Ignored
      manager.updateCandle('BTCUSDT', createCandle(3000, 102, true))  // Count: 2
      manager.updateCandle('BTCUSDT', createCandle(4000, 103, false)) // Ignored
      manager.updateCandle('BTCUSDT', createCandle(5000, 104, true))  // Count: 3

      const buffer = manager.getBuffer('BTCUSDT')
      expect(buffer?.getCount()).toBe(3)
    })
  })

  describe('Ready Status', () => {
    beforeEach(async () => {
      await manager.initialize(['BTCUSDT'])
    })

    it('should not be ready with no data', () => {
      expect(manager.isReady('BTCUSDT', '5m')).toBe(false)
      expect(manager.isReady('BTCUSDT', '15m')).toBe(false)
      expect(manager.isReady('BTCUSDT', '1h')).toBe(false)
    })

    it('should be ready for 5m with 1 candle', () => {
      manager.updateCandle('BTCUSDT', createCandle(1000, 100))
      expect(manager.isReady('BTCUSDT', '5m')).toBe(true)
    })

    it('should be ready for 15m with 3 candles', () => {
      for (let i = 0; i < 3; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.isReady('BTCUSDT', '15m')).toBe(true)
      expect(manager.isReady('BTCUSDT', '1h')).toBe(false) // Not enough for 1h
    })

    it('should be ready for 1h with 12 candles', () => {
      for (let i = 0; i < 12; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.isReady('BTCUSDT', '5m')).toBe(true)
      expect(manager.isReady('BTCUSDT', '15m')).toBe(true)
      expect(manager.isReady('BTCUSDT', '1h')).toBe(true)
      expect(manager.isReady('BTCUSDT', '8h')).toBe(false)
    })

    it('should be ready for 4h with 48 candles', () => {
      for (let i = 0; i < 48; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.isReady('BTCUSDT', '4h')).toBe(true)
      expect(manager.isReady('BTCUSDT', '8h')).toBe(false)
    })

    it('should be ready for 8h with 96 candles', () => {
      for (let i = 0; i < 96; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.isReady('BTCUSDT', '8h')).toBe(true)
      expect(manager.isReady('BTCUSDT', '1d')).toBe(false)
    })

    it('should be ready for 12h with 144 candles', () => {
      for (let i = 0; i < 144; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.isReady('BTCUSDT', '12h')).toBe(true)
      expect(manager.isReady('BTCUSDT', '1d')).toBe(false)
    })

    it('should be ready for 1d with 288 candles', () => {
      for (let i = 0; i < 288; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.isReady('BTCUSDT', '1d')).toBe(true)
    })

    it('should return false for non-existent symbol', () => {
      expect(manager.isReady('NONEXISTENT', '5m')).toBe(false)
    })
  })

  describe('Fully Loaded Status', () => {
    beforeEach(async () => {
      await manager.initialize(['BTCUSDT'])
    })

    it('should not be fully loaded with partial data', () => {
      for (let i = 0; i < 100; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.isFullyLoaded('BTCUSDT')).toBe(false)
    })

    it('should be fully loaded with 288 candles', () => {
      for (let i = 0; i < 288; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.isFullyLoaded('BTCUSDT')).toBe(true)
    })

    it('should return false for non-existent symbol', () => {
      expect(manager.isFullyLoaded('NONEXISTENT')).toBe(false)
    })
  })

  describe('Warm-up Progress', () => {
    beforeEach(async () => {
      await manager.initialize(['BTCUSDT'])
    })

    it('should return 0% for empty buffer', () => {
      expect(manager.getWarmupProgress('BTCUSDT')).toBe(0)
    })

    it('should return correct percentage for partial fill', () => {
      // Add 50 candles (50/288 = 17.36%)
      for (let i = 0; i < 50; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.getWarmupProgress('BTCUSDT')).toBeCloseTo(17.36, 1)
    })

    it('should return 100% for full buffer', () => {
      for (let i = 0; i < 288; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      expect(manager.getWarmupProgress('BTCUSDT')).toBe(100)
    })

    it('should return 0 for non-existent symbol', () => {
      expect(manager.getWarmupProgress('NONEXISTENT')).toBe(0)
    })
  })

  describe('Warm-up Status Details', () => {
    beforeEach(async () => {
      await manager.initialize(['BTCUSDT'])
    })

    it('should return null for non-existent symbol', () => {
      expect(manager.getWarmupStatus('NONEXISTENT')).toBeNull()
    })

    it('should return detailed status with 0 candles', () => {
      const status = manager.getWarmupStatus('BTCUSDT')
      
      expect(status).not.toBeNull()
      expect(status?.symbol).toBe('BTCUSDT')
      expect(status?.candleCount).toBe(0)
      expect(status?.fillPercentage).toBe(0)
      expect(status?.ready).toEqual({
        '5m': false,
        '15m': false,
        '1h': false,
        '4h': false,
        '8h': false,
        '12h': false,
        '1d': false
      })
    })

    it('should return detailed status with 12 candles', () => {
      for (let i = 0; i < 12; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }

      const status = manager.getWarmupStatus('BTCUSDT')
      
      expect(status?.candleCount).toBe(12)
      expect(status?.ready).toEqual({
        '5m': true,
        '15m': true,
        '1h': true,
        '4h': false,
        '8h': false,
        '12h': false,
        '1d': false
      })
    })

    it('should return detailed status for fully loaded buffer', () => {
      for (let i = 0; i < 288; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }

      const status = manager.getWarmupStatus('BTCUSDT')
      
      expect(status?.candleCount).toBe(288)
      expect(status?.fillPercentage).toBe(100)
      expect(status?.ready).toEqual({
        '5m': true,
        '15m': true,
        '1h': true,
        '4h': true,
        '8h': true,
        '12h': true,
        '1d': true
      })
    })
  })

  describe('Overall Status', () => {
    it('should return zero status when empty', () => {
      const status = manager.getStatus()
      
      expect(status).toEqual({
        totalSymbols: 0,
        fullyLoaded: 0,
        loading: 0,
        averageFill: 0
      })
    })

    it('should track multiple symbols', async () => {
      await manager.initialize(['BTCUSDT', 'ETHUSDT', 'BNBUSDT'])

      // BTCUSDT: fully loaded (288 candles)
      for (let i = 0; i < 288; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }

      // ETHUSDT: half loaded (144 candles)
      for (let i = 0; i < 144; i++) {
        manager.updateCandle('ETHUSDT', createCandle(1000 + i * 300000, 200 + i))
      }

      // BNBUSDT: quarter loaded (72 candles)
      for (let i = 0; i < 72; i++) {
        manager.updateCandle('BNBUSDT', createCandle(1000 + i * 300000, 300 + i))
      }

      const status = manager.getStatus()
      
      expect(status.totalSymbols).toBe(3)
      expect(status.fullyLoaded).toBe(1) // Only BTCUSDT
      expect(status.loading).toBe(2) // ETHUSDT and BNBUSDT
      expect(status.averageFill).toBeCloseTo(58.33, 1) // (100 + 50 + 25) / 3
    })
  })

  describe('Ready Symbols', () => {
    beforeEach(async () => {
      await manager.initialize(['BTCUSDT', 'ETHUSDT', 'BNBUSDT'])

      // BTCUSDT: 100 candles
      for (let i = 0; i < 100; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }

      // ETHUSDT: 12 candles
      for (let i = 0; i < 12; i++) {
        manager.updateCandle('ETHUSDT', createCandle(1000 + i * 300000, 200 + i))
      }

      // BNBUSDT: 3 candles
      for (let i = 0; i < 3; i++) {
        manager.updateCandle('BNBUSDT', createCandle(1000 + i * 300000, 300 + i))
      }
    })

    it('should get symbols ready for 5m', () => {
      const ready = manager.getReadySymbols('5m')
      expect(ready).toHaveLength(3)
      expect(ready).toContain('BTCUSDT')
      expect(ready).toContain('ETHUSDT')
      expect(ready).toContain('BNBUSDT')
    })

    it('should get symbols ready for 15m', () => {
      const ready = manager.getReadySymbols('15m')
      expect(ready).toHaveLength(3)
    })

    it('should get symbols ready for 1h', () => {
      const ready = manager.getReadySymbols('1h')
      expect(ready).toHaveLength(2) // BTCUSDT and ETHUSDT
      expect(ready).toContain('BTCUSDT')
      expect(ready).toContain('ETHUSDT')
    })

    it('should get symbols ready for 8h', () => {
      const ready = manager.getReadySymbols('8h')
      expect(ready).toHaveLength(1) // Only BTCUSDT
      expect(ready).toContain('BTCUSDT')
    })

    it('should get empty array when no symbols ready', () => {
      const ready = manager.getReadySymbols('1d')
      expect(ready).toHaveLength(0)
    })
  })

  describe('Clear Operations', () => {
    beforeEach(async () => {
      await manager.initialize(['BTCUSDT', 'ETHUSDT'])
      
      for (let i = 0; i < 10; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
        manager.updateCandle('ETHUSDT', createCandle(1000 + i * 300000, 200 + i))
      }
    })

    it('should clear specific symbol', () => {
      manager.clearSymbol('BTCUSDT')
      
      expect(manager.getBuffer('BTCUSDT')?.getCount()).toBe(0)
      expect(manager.getBuffer('ETHUSDT')?.getCount()).toBe(10)
    })

    it('should clear all symbols', () => {
      manager.clearAll()
      
      expect(manager.getBuffer('BTCUSDT')?.getCount()).toBe(0)
      expect(manager.getBuffer('ETHUSDT')?.getCount()).toBe(0)
    })

    it('should handle clearing non-existent symbol', () => {
      expect(() => manager.clearSymbol('NONEXISTENT')).not.toThrow()
    })
  })

  describe('Remove Symbol', () => {
    beforeEach(async () => {
      await manager.initialize(['BTCUSDT', 'ETHUSDT'])
    })

    it('should remove symbol buffer', () => {
      const removed = manager.removeSymbol('BTCUSDT')
      
      expect(removed).toBe(true)
      expect(manager.getSymbolCount()).toBe(1)
      expect(manager.getBuffer('BTCUSDT')).toBeUndefined()
    })

    it('should return false when removing non-existent symbol', () => {
      const removed = manager.removeSymbol('NONEXISTENT')
      expect(removed).toBe(false)
    })
  })

  describe('Memory Usage', () => {
    it('should estimate memory usage', async () => {
      await manager.initialize(['BTCUSDT', 'ETHUSDT'])

      // Add 100 candles to each (200 total)
      for (let i = 0; i < 100; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
        manager.updateCandle('ETHUSDT', createCandle(1000 + i * 300000, 200 + i))
      }

      const memoryMB = manager.getMemoryUsage()
      
      // 200 candles × 56 bytes ≈ 0.0107 MB
      expect(memoryMB).toBeGreaterThan(0)
      expect(memoryMB).toBeLessThan(1)
    })

    it('should return 0 memory for empty manager', () => {
      expect(manager.getMemoryUsage()).toBe(0)
    })
  })

  describe('Statistics', () => {
    it('should return comprehensive statistics', async () => {
      await manager.initialize(['BTCUSDT', 'ETHUSDT', 'BNBUSDT'])

      // Add varying amounts of data
      for (let i = 0; i < 288; i++) {
        manager.updateCandle('BTCUSDT', createCandle(1000 + i * 300000, 100 + i))
      }
      for (let i = 0; i < 100; i++) {
        manager.updateCandle('ETHUSDT', createCandle(1000 + i * 300000, 200 + i))
      }
      for (let i = 0; i < 12; i++) {
        manager.updateCandle('BNBUSDT', createCandle(1000 + i * 300000, 300 + i))
      }

      const stats = manager.getStatistics()
      
      expect(stats.totalSymbols).toBe(3)
      expect(stats.fullyLoaded).toBe(1)
      expect(stats.loading).toBe(2)
      expect(stats.memoryUsageMB).toBeGreaterThan(0)
      expect(stats.readyByTimeframe['5m']).toBe(3)
      expect(stats.readyByTimeframe['15m']).toBe(3)
      expect(stats.readyByTimeframe['1h']).toBe(3)
      expect(stats.readyByTimeframe['8h']).toBe(2) // BTCUSDT and ETHUSDT
      expect(stats.readyByTimeframe['1d']).toBe(1) // Only BTCUSDT
    })
  })

  describe('Backfill', () => {
    let mockApiClient: any

    beforeEach(() => {
      // Mock API client with fetchKlines method
      mockApiClient = {
        fetchKlines: vi.fn()
      }
      manager = new RingBufferManager(mockApiClient)
    })

    describe('backfillSymbol', () => {
      it('should backfill single symbol with 288 candles', async () => {
        // Mock API response with 288 klines
        const mockKlines = Array.from({ length: 288 }, (_, i) => ({
          openTime: 1000 + i * 300000,
          closeTime: 1000 + i * 300000 + 300000,
          open: `${100 + i}`,
          high: `${102 + i}`,
          low: `${98 + i}`,
          close: `${101 + i}`,
          volume: `${1000}`,
          quoteVolume: `${100000}`,
          trades: 500,
          takerBuyBaseVolume: `${500}`,
          takerBuyQuoteVolume: `${50000}`,
          ignore: '0'
        }))

        mockApiClient.fetchKlines.mockResolvedValue(mockKlines)

        await manager.backfillSymbol('BTCUSDT')

        expect(mockApiClient.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '5m', 288)

        const buffer = manager.getBuffer('BTCUSDT')
        expect(buffer?.getCount()).toBe(288)
        expect(buffer?.isFull()).toBe(true)
        expect(manager.isFullyLoaded('BTCUSDT')).toBe(true)
      })

      it('should convert API format to Kline5m correctly', async () => {
        const mockKlines = [{
          openTime: 1000,
          closeTime: 1300000,
          open: '43250.50',
          high: '43500.00',
          low: '43000.00',
          close: '43350.75',
          volume: '15234.567',
          quoteVolume: '659876543.21',
          trades: 12345,
          takerBuyBaseVolume: '7000',
          takerBuyQuoteVolume: '300000000',
          ignore: '0'
        }]

        mockApiClient.fetchKlines.mockResolvedValue(mockKlines)

        await manager.backfillSymbol('BTCUSDT')

        const buffer = manager.getBuffer('BTCUSDT')
        const candle = buffer?.getNewestCandle()

        expect(candle).toMatchObject({
          openTime: 1000,
          closeTime: 1300000,
          open: 43250.50,
          high: 43500.00,
          low: 43000.00,
          close: 43350.75,
          volume: 15234.567,
          quoteVolume: 659876543.21,
          isFinal: true
        })
      })

      it('should create buffer if it does not exist', async () => {
        mockApiClient.fetchKlines.mockResolvedValue([
          {
            openTime: 1000,
            closeTime: 1300000,
            open: '100',
            high: '101',
            low: '99',
            close: '100.5',
            volume: '1000',
            quoteVolume: '100000',
            trades: 100,
            takerBuyBaseVolume: '500',
            takerBuyQuoteVolume: '50000',
            ignore: '0'
          }
        ])

        expect(manager.getBuffer('NEWUSDT')).toBeUndefined()

        await manager.backfillSymbol('NEWUSDT')

        expect(manager.getBuffer('NEWUSDT')).toBeDefined()
        expect(manager.getBuffer('NEWUSDT')?.getCount()).toBe(1)
      })

      it('should throw error on API failure', async () => {
        mockApiClient.fetchKlines.mockRejectedValue(new Error('Network error'))

        await expect(manager.backfillSymbol('BTCUSDT')).rejects.toThrow('Network error')
      })

      it('should mark all candles as final', async () => {
        const mockKlines = Array.from({ length: 10 }, (_, i) => ({
          openTime: 1000 + i * 300000,
          closeTime: 1000 + i * 300000 + 300000,
          open: `${100 + i}`,
          high: `${102 + i}`,
          low: `${98 + i}`,
          close: `${101 + i}`,
          volume: `${1000}`,
          quoteVolume: `${100000}`,
          trades: 500,
          takerBuyBaseVolume: `${500}`,
          takerBuyQuoteVolume: `${50000}`,
          ignore: '0'
        }))

        mockApiClient.fetchKlines.mockResolvedValue(mockKlines)

        await manager.backfillSymbol('BTCUSDT')

        const buffer = manager.getBuffer('BTCUSDT')
        const candles = buffer?.getLastN(10)

        expect(candles?.every(c => c.isFinal)).toBe(true)
      })
    })

    describe('backfillAll', () => {
      it('should backfill multiple symbols with batching', async () => {
        const symbols = ['BTC', 'ETH', 'BNB', 'ADA', 'DOT']
        
        mockApiClient.fetchKlines.mockImplementation((symbol: string) => {
          return Promise.resolve([
            {
              openTime: 1000,
              closeTime: 1300000,
              open: '100',
              high: '101',
              low: '99',
              close: '100.5',
              volume: '1000',
              quoteVolume: '100000',
              trades: 100,
              takerBuyBaseVolume: '500',
              takerBuyQuoteVolume: '50000',
              ignore: '0'
            }
          ])
        })

        const result = await manager.backfillAll(symbols, {
          batchSize: 2,
          batchDelay: 100 // Short delay for tests
        })

        expect(result.successful).toHaveLength(5)
        expect(result.failed).toHaveLength(0)
        expect(mockApiClient.fetchKlines).toHaveBeenCalledTimes(5)
      })

      it('should report progress via callback', async () => {
        const symbols = ['BTC', 'ETH', 'BNB']
        const progressUpdates: Array<{ completed: number, total: number }> = []

        mockApiClient.fetchKlines.mockResolvedValue([
          {
            openTime: 1000,
            closeTime: 1300000,
            open: '100',
            high: '101',
            low: '99',
            close: '100.5',
            volume: '1000',
            quoteVolume: '100000',
            trades: 100,
            takerBuyBaseVolume: '500',
            takerBuyQuoteVolume: '50000',
            ignore: '0'
          }
        ])

        await manager.backfillAll(symbols, {
          batchSize: 2,
          batchDelay: 50,
          onProgress: (completed, total) => {
            progressUpdates.push({ completed, total })
          }
        })

        expect(progressUpdates).toHaveLength(2) // 2 batches
        expect(progressUpdates[0]).toEqual({ completed: 2, total: 3 })
        expect(progressUpdates[1]).toEqual({ completed: 3, total: 3 })
      })

      it('should handle partial failures gracefully', async () => {
        const symbols = ['BTC', 'ETH', 'BNB', 'FAIL1', 'ADA', 'FAIL2']

        mockApiClient.fetchKlines.mockImplementation((symbol: string) => {
          if (symbol.startsWith('FAIL')) {
            return Promise.reject(new Error(`Failed to fetch ${symbol}`))
          }
          return Promise.resolve([
            {
              openTime: 1000,
              closeTime: 1300000,
              open: '100',
              high: '101',
              low: '99',
              close: '100.5',
              volume: '1000',
              quoteVolume: '100000',
              trades: 100,
              takerBuyBaseVolume: '500',
              takerBuyQuoteVolume: '50000',
              ignore: '0'
            }
          ])
        })

        const result = await manager.backfillAll(symbols, {
          batchSize: 3,
          batchDelay: 50
        })

        expect(result.successful).toHaveLength(4)
        expect(result.successful).toContain('BTC')
        expect(result.successful).toContain('ETH')
        expect(result.successful).toContain('BNB')
        expect(result.successful).toContain('ADA')
        
        expect(result.failed).toHaveLength(2)
        expect(result.failed).toContain('FAIL1')
        expect(result.failed).toContain('FAIL2')
      })

      it('should respect batch delay', async () => {
        const symbols = ['BTC', 'ETH', 'BNB', 'ADA']
        const timestamps: number[] = []

        mockApiClient.fetchKlines.mockImplementation(() => {
          timestamps.push(Date.now())
          return Promise.resolve([
            {
              openTime: 1000,
              closeTime: 1300000,
              open: '100',
              high: '101',
              low: '99',
              close: '100.5',
              volume: '1000',
              quoteVolume: '100000',
              trades: 100,
              takerBuyBaseVolume: '500',
              takerBuyQuoteVolume: '50000',
              ignore: '0'
            }
          ])
        })

        await manager.backfillAll(symbols, {
          batchSize: 2,
          batchDelay: 200
        })

        // Check that batches are separated by at least the delay time
        // First 2 requests should be close together
        expect(timestamps[1] - timestamps[0]).toBeLessThan(100)
        
        // But batch 2 should be delayed from batch 1
        expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(150)
      })

      it('should handle empty symbol list', async () => {
        const result = await manager.backfillAll([])

        expect(result.successful).toHaveLength(0)
        expect(result.failed).toHaveLength(0)
        expect(mockApiClient.fetchKlines).not.toHaveBeenCalled()
      })
    })

    describe('getBackfillProgress', () => {
      it('should return progress for empty manager', () => {
        const progress = manager.getBackfillProgress()

        expect(progress).toEqual({
          total: 0,
          fullyLoaded: 0,
          partial: 0,
          empty: 0,
          percentage: 0
        })
      })

      it('should track fully loaded symbols', async () => {
        mockApiClient.fetchKlines.mockResolvedValue(
          Array.from({ length: 288 }, (_, i) => ({
            openTime: 1000 + i * 300000,
            closeTime: 1000 + i * 300000 + 300000,
            open: `${100}`,
            high: `${101}`,
            low: `${99}`,
            close: `${100}`,
            volume: `${1000}`,
            quoteVolume: `${100000}`,
            trades: 100,
            takerBuyBaseVolume: `${500}`,
            takerBuyQuoteVolume: `${50000}`,
            ignore: '0'
          }))
        )

        await manager.backfillSymbol('BTCUSDT')
        await manager.backfillSymbol('ETHUSDT')

        const progress = manager.getBackfillProgress()

        expect(progress.total).toBe(2)
        expect(progress.fullyLoaded).toBe(2)
        expect(progress.partial).toBe(0)
        expect(progress.empty).toBe(0)
        expect(progress.percentage).toBe(100)
      })

      it('should track mixed loading states', async () => {
        // Fully loaded
        mockApiClient.fetchKlines.mockResolvedValueOnce(
          Array.from({ length: 288 }, (_, i) => ({
            openTime: 1000 + i * 300000,
            closeTime: 1300000,
            open: '100',
            high: '101',
            low: '99',
            close: '100',
            volume: '1000',
            quoteVolume: '100000',
            trades: 100,
            takerBuyBaseVolume: '500',
            takerBuyQuoteVolume: '50000',
            ignore: '0'
          }))
        )

        await manager.backfillSymbol('BTCUSDT')

        // Partially loaded
        await manager.initialize(['ETHUSDT'])
        for (let i = 0; i < 50; i++) {
          manager.updateCandle('ETHUSDT', createCandle(1000 + i * 300000, 200 + i))
        }

        // Empty
        await manager.initialize(['BNBUSDT'])

        const progress = manager.getBackfillProgress()

        expect(progress.total).toBe(3)
        expect(progress.fullyLoaded).toBe(1)
        expect(progress.partial).toBe(1)
        expect(progress.empty).toBe(1)
        expect(progress.percentage).toBeCloseTo(33.33, 1)
      })
    })
  })
})
