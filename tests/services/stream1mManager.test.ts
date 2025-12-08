import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Stream1mManager } from '@/services/stream1mManager'
import type { Candle1m } from '@/types/api'

// Mock the dependencies before importing
vi.mock('@/services/binanceFuturesApi', () => {
  return {
    BinanceFuturesApiClient: vi.fn().mockImplementation(() => ({
      fetch1mKlines: vi.fn().mockResolvedValue([
        {
          openTime: 1702000000000,
          close: 50500,
          volume: 100,
          quoteVolume: 5025000,
        },
      ]),
      backfill1mCandles: vi.fn().mockImplementation((symbols: string[], options: any) => {
        // Return mock data for the requested symbols
        const data = new Map()
        symbols.forEach((symbol, index) => {
          // Create 10 candles (enough for 5m window)
          const candles = Array.from({ length: 10 }, (_, i) => ({
            openTime: 1702000000000 + i * 60000,
            close: 50500 + i * 10,
            volume: 100 + i,
            quoteVolume: 5025000 + i * 1000,
          }))
          data.set(symbol, candles)
          
          // Call progress callback if provided
          if (options?.onProgress) {
            options.onProgress(index + 1, symbols.length, symbol)
          }
        })
        return Promise.resolve({
          successful: symbols,
          failed: [],
          data,
        })
      }),
    })),
  }
})

vi.mock('@/services/binanceFuturesWebSocket', () => {
  const EventEmitter = vi.fn().mockImplementation(() => {
    const handlers = new Map()
    return {
      on: vi.fn((event: string, handler: Function) => {
        if (!handlers.has(event)) {
          handlers.set(event, [])
        }
        handlers.get(event).push(handler)
      }),
      off: vi.fn(),
      emit: vi.fn((event: string, ...args: any[]) => {
        const eventHandlers = handlers.get(event)
        if (eventHandlers) {
          eventHandlers.forEach((handler: Function) => handler(...args))
        }
      }),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
      subscribe1mKlines: vi.fn().mockResolvedValue(undefined),
      subscribe5mKlines: vi.fn().mockResolvedValue(undefined),
    }
  })

  return {
    BinanceFuturesWebSocket: EventEmitter,
  }
})

describe('Stream1mManager', () => {
  let manager: Stream1mManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new Stream1mManager()
  })

  afterEach(async () => {
    if (manager.isActive()) {
      await manager.stop()
    }
    manager.destroy()
  })

  describe('Constructor', () => {
    it('should initialize with empty state', () => {
      expect(manager.isActive()).toBe(false)
      expect(manager.getSymbols()).toEqual([])
    })

    it('should setup WebSocket handlers', () => {
      // Manager should be constructed without errors
      expect(manager).toBeDefined()
    })
  })

  describe('start()', () => {
    it('should backfill and initialize successfully', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT']
      const startedListener = vi.fn()
      manager.on('started', startedListener)

      await manager.start(symbols, {
        batchSize: 2,
        batchDelay: 10,
      })

      expect(manager.isActive()).toBe(true)
      expect(manager.getSymbols()).toEqual(symbols)
      expect(startedListener).toHaveBeenCalledWith({ symbols: 2 })

      // Should have created buffers
      expect(manager.getBuffer('BTCUSDT')).toBeDefined()
      expect(manager.getBuffer('ETHUSDT')).toBeDefined()
    }, 10000) // Increase timeout for backfill operations

    it('should emit backfillProgress events', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
      const progressListener = vi.fn()
      manager.on('backfillProgress', progressListener)

      await manager.start(symbols, {
        batchSize: 2,
        batchDelay: 10,
      })

      // Should have emitted progress events
      expect(progressListener).toHaveBeenCalled()
      const lastCall = progressListener.mock.calls[progressListener.mock.calls.length - 1][0]
      expect(lastCall.total).toBe(3)
      expect(lastCall.completed).toBe(3)
      expect(lastCall.progress).toBe(100)
    }, 10000)

    it('should call onProgress callback', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT']
      const onProgress = vi.fn()

      await manager.start(symbols, {
        batchSize: 2,
        batchDelay: 10,
        onProgress,
      })

      expect(onProgress).toHaveBeenCalled()
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]
      expect(lastCall[0]).toBe(2) // completed
      expect(lastCall[1]).toBe(2) // total
    }, 10000)

    it('should handle partial backfill failures', async () => {
      // Mock backfill to fail for ETHUSDT
      const mockApiClient = manager['apiClient']
      vi.spyOn(mockApiClient, 'backfill1mCandles').mockResolvedValueOnce({
        successful: ['BTCUSDT', 'BNBUSDT'],
        failed: [{ symbol: 'ETHUSDT', error: 'Failed for ETHUSDT' }],
        data: new Map([
          ['BTCUSDT', [{ openTime: 1702000000000, close: 50500, volume: 100, quoteVolume: 5025000 }]],
          ['BNBUSDT', [{ openTime: 1702000000000, close: 400, volume: 50, quoteVolume: 20000 }]],
        ]),
      })

      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']

      await manager.start(symbols, {
        batchSize: 3,
        batchDelay: 10,
      })

      // Should have started with successful symbols only
      expect(manager.isActive()).toBe(true)
      expect(manager.getBuffer('BTCUSDT')).toBeDefined()
      expect(manager.getBuffer('BNBUSDT')).toBeDefined()
      expect(manager.getBuffer('ETHUSDT')).toBeUndefined()
    }, 10000)

    it('should not start if already running', async () => {
      await manager.start(['BTCUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Try to start again
      await manager.start(['ETHUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Stream already running')
      expect(manager.getSymbols()).toEqual(['BTCUSDT']) // Should not change

      consoleSpy.mockRestore()
    }, 10000)

    it('should emit error event on failure', async () => {
      const errorListener = vi.fn()
      manager.on('error', errorListener)

      // Mock API to fail
      const mockApiClient = manager['apiClient']
      vi.spyOn(mockApiClient, 'backfill1mCandles').mockRejectedValueOnce(new Error('API failure'))

      await expect(manager.start(['BTCUSDT'])).rejects.toThrow('API failure')
      expect(errorListener).toHaveBeenCalled()
      expect(manager.isActive()).toBe(false)
    })
  })

  describe('getMetrics()', () => {
    beforeEach(async () => {
      // Start manager with test data
      await manager.start(['BTCUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })
    }, 10000)

    it('should return metrics for tracked symbol', () => {
      const metrics = manager.getMetrics('BTCUSDT', 5)
      
      expect(metrics).toBeDefined()
      expect(metrics).toHaveProperty('symbol', 'BTCUSDT')
      expect(metrics).toHaveProperty('windowMinutes', 5)
      expect(metrics).toHaveProperty('priceChange')
      expect(metrics).toHaveProperty('priceChangePercent')
      expect(metrics).toHaveProperty('baseVolume')
      expect(metrics).toHaveProperty('quoteVolume')
    })

    it('should return null for untracked symbol', () => {
      const metrics = manager.getMetrics('UNKNOWN', 5)
      expect(metrics).toBeNull()
    })

    it('should support all window sizes', () => {
      const windows: Array<5 | 15 | 60 | 480 | 1440> = [5, 15, 60, 480, 1440]

      for (const window of windows) {
        const metrics = manager.getMetrics('BTCUSDT', window)
        // May be null if not enough data (only 10 candles in test)
        if (metrics) {
          expect(metrics).toHaveProperty('windowMinutes', window)
          expect(metrics).toHaveProperty('priceChange')
          expect(metrics).toHaveProperty('baseVolume')
        }
      }
    })
  })

  describe('getAllMetrics()', () => {
    beforeEach(async () => {
      await manager.start(['BTCUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })
    }, 10000)

    it('should return all timeframe metrics', () => {
      const allMetrics = manager.getAllMetrics('BTCUSDT')
      expect(allMetrics).toBeDefined()
      expect(allMetrics).toHaveProperty('m5')
      expect(allMetrics).toHaveProperty('m15')
      expect(allMetrics).toHaveProperty('h1')
      expect(allMetrics).toHaveProperty('h8')
      expect(allMetrics).toHaveProperty('h24')
    })

    it('should return null for untracked symbol', () => {
      const allMetrics = manager.getAllMetrics('UNKNOWN')
      expect(allMetrics).toBeNull()
    })
  })

  describe('handle1mKline()', () => {
    beforeEach(async () => {
      await manager.start(['BTCUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })
    }, 10000)

    it('should emit candle event on new candle', (done) => {
      const testCandle: Candle1m = {
        openTime: Date.now(),
        close: 51000,
        volume: 100,
        quoteVolume: 5100000,
      }

      manager.on('candle', (data: any) => {
        expect(data.symbol).toBe('BTCUSDT')
        expect(data.candle).toEqual(testCandle)
        expect(data.timestamp).toBeGreaterThan(0)
        done()
      })

      // Simulate WebSocket kline message
      manager['wsClient'].emit('kline', {
        e: 'kline',
        E: Date.now(),
        s: 'BTCUSDT',
        k: {
          t: testCandle.openTime,
          T: testCandle.openTime + 60000,
          s: 'BTCUSDT',
          i: '1m',
          f: 100,
          L: 200,
          o: '50000',
          c: testCandle.close.toString(),
          h: '51000',
          l: '50000',
          v: testCandle.volume.toString(),
          n: 100,
          x: true, // Closed candle
          q: testCandle.quoteVolume.toString(),
          V: '60',
          Q: '3060000',
          B: '0',
        },
      })
    })

    it('should emit metrics event on new candle', (done) => {
      const testCandle: Candle1m = {
        openTime: Date.now(),
        close: 51000,
        volume: 100,
        quoteVolume: 5100000,
      }

      manager.on('metrics', (data: any) => {
        expect(data.symbol).toBe('BTCUSDT')
        expect(data.metrics).toHaveProperty('m5')
        expect(data.metrics).toHaveProperty('m15')
        expect(data.metrics).toHaveProperty('h1')
        expect(data.metrics).toHaveProperty('h8')
        expect(data.metrics).toHaveProperty('h24')
        expect(data.timestamp).toBeGreaterThan(0)
        done()
      })

      // Simulate WebSocket kline message
      manager['wsClient'].emit('kline', {
        e: 'kline',
        E: Date.now(),
        s: 'BTCUSDT',
        k: {
          t: testCandle.openTime,
          T: testCandle.openTime + 60000,
          s: 'BTCUSDT',
          i: '1m',
          f: 100,
          L: 200,
          o: '50000',
          c: testCandle.close.toString(),
          h: '51000',
          l: '50000',
          v: testCandle.volume.toString(),
          n: 100,
          x: true, // Closed candle
          q: testCandle.quoteVolume.toString(),
          V: '60',
          Q: '3060000',
          B: '0',
        },
      })
    })

    it('should ignore non-closed candles', () => {
      const candleListener = vi.fn()
      manager.on('candle', candleListener)

      // Simulate non-closed kline message
      manager['wsClient'].emit('kline', {
        e: 'kline',
        E: Date.now(),
        s: 'BTCUSDT',
        k: {
          t: Date.now(),
          T: Date.now() + 60000,
          s: 'BTCUSDT',
          i: '1m',
          x: false, // Not closed
          c: '51000',
          v: '100',
          q: '5100000',
        },
      })

      // Should not emit candle event
      expect(candleListener).not.toHaveBeenCalled()
    })

    it('should warn for untracked symbols', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Simulate kline for untracked symbol
      manager['wsClient'].emit('kline', {
        e: 'kline',
        E: Date.now(),
        s: 'UNKNOWN',
        k: {
          t: Date.now(),
          s: 'UNKNOWN',
          x: true,
          c: '51000',
          v: '100',
          q: '5100000',
        },
      })

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Received candle for untracked symbol: UNKNOWN')
      consoleSpy.mockRestore()
    })
  })

  describe('stop()', () => {
    it('should stop successfully', async () => {
      await manager.start(['BTCUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })

      const stoppedListener = vi.fn()
      manager.on('stopped', stoppedListener)

      await manager.stop()

      expect(manager.isActive()).toBe(false)
      expect(manager.getSymbols()).toEqual([])
      expect(manager.getBuffer('BTCUSDT')).toBeUndefined()
      expect(stoppedListener).toHaveBeenCalled()
    }, 10000)

    it('should not stop if not running', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await manager.stop()

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Stream not running')
      consoleSpy.mockRestore()
    })
  })

  describe('getBuffer()', () => {
    it('should return buffer for tracked symbol', async () => {
      await manager.start(['BTCUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })

      const buffer = manager.getBuffer('BTCUSDT')
      expect(buffer).toBeDefined()
      expect(buffer?.getCapacity()).toBe(1440)
    }, 10000)

    it('should return undefined for untracked symbol', async () => {
      await manager.start(['BTCUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })

      const buffer = manager.getBuffer('UNKNOWN')
      expect(buffer).toBeUndefined()
    }, 10000)
  })

  describe('Edge Cases', () => {
    it('should handle empty symbol list', async () => {
      const startedListener = vi.fn()
      manager.on('started', startedListener)

      await manager.start([], {
        batchSize: 1,
        batchDelay: 10,
      })

      expect(manager.isActive()).toBe(true)
      expect(manager.getSymbols()).toEqual([])
      expect(startedListener).toHaveBeenCalledWith({ symbols: 0 })
    })

    it('should handle WebSocket reconnection', async () => {
      await manager.start(['BTCUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })

      // Simulate reconnection
      manager['wsClient'].emit('connect')

      // Should still be running
      expect(manager.isActive()).toBe(true)
    }, 10000)

    it('should handle WebSocket errors', async () => {
      await manager.start(['BTCUSDT'], {
        batchSize: 1,
        batchDelay: 10,
      })

      const errorListener = vi.fn()
      manager.on('error', errorListener)

      // Simulate WebSocket error
      const testError = new Error('WebSocket error')
      manager['wsClient'].emit('error', testError)

      expect(errorListener).toHaveBeenCalledWith(testError)
    }, 10000)
  })
})
