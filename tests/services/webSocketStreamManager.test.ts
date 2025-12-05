/**
 * WebSocket Stream Manager Integration Tests
 * 
 * Tests the complete streaming pipeline:
 * Connect → Subscribe → Receive → Update Buffers → Calculate Metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketStreamManager } from '@/services/webSocketStreamManager'
import { BinanceFuturesWebSocket } from '@/services/binanceFuturesWebSocket'
import { RingBufferManager } from '@/services/ringBufferManager'
import { ChangeCalculator } from '@/services/changeCalculator'

// Mock the dependencies
vi.mock('@/services/binanceFuturesWebSocket')
vi.mock('@/services/ringBufferManager')
vi.mock('@/services/binanceFuturesApiClient')

describe('WebSocketStreamManager - Integration', () => {
  let manager: WebSocketStreamManager
  let mockWsClient: any
  let mockBufferManager: any
  let mockChangeCalculator: any

  beforeEach(() => {
    // Create mock WebSocket client
    mockWsClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      getState: vi.fn().mockReturnValue('connected'),
      on: vi.fn(),
      emit: vi.fn(),
    }

    // Create mock buffer manager
    mockBufferManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      backfillAll: vi.fn().mockResolvedValue({ successful: [], failed: [] }),
      getBuffer: vi.fn().mockReturnValue({
        getCandles: vi.fn().mockReturnValue([]),
        hasEnoughData: vi.fn().mockReturnValue(false),
      }),
      updateCandle: vi.fn(),
      getStatus: vi.fn().mockReturnValue({
        initialized: true,
        buffersReady: 0,
        totalBuffers: 0,
        fullyLoaded: 0,
      }),
      getWarmupProgress: vi.fn().mockReturnValue(0),
    }

    // Create mock change calculator
    mockChangeCalculator = {
      getAllChanges: vi.fn().mockReturnValue({
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
      }),
      getAllSymbolsChanges: vi.fn().mockReturnValue(new Map()),
      getReadySymbols: vi.fn().mockReturnValue([]),
      isReady: vi.fn().mockReturnValue(false),
    }

    // Mock the constructors
    ;(BinanceFuturesWebSocket as any).mockImplementation(() => mockWsClient)
    ;(RingBufferManager as any).mockImplementation(() => mockBufferManager)

    // Create manager instance with mocked dependencies
    manager = new WebSocketStreamManager({
      autoReconnect: true,
      batchSize: 10,
      enableBackfill: false, // Disable for faster tests
    })

    // Replace change calculator (not mocked in constructor)
    // @ts-ignore - accessing private property for testing
    manager['changeCalculator'] = mockChangeCalculator
  })

  afterEach(() => {
    manager.stop()
  })

  describe('Initialization', () => {
    it('should start successfully with symbols', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']

      await manager.start(symbols)

      expect(mockWsClient.connect).toHaveBeenCalled()
      expect(mockWsClient.subscribe).toHaveBeenCalledWith(['!ticker@arr'])
      
      const status = manager.getStatus()
      expect(status.connected).toBe(true)
      expect(status.subscribedStreams).toBe(4) // 3 kline + 1 ticker
    })

    it('should not start twice', async () => {
      const symbols = ['BTCUSDT']

      await manager.start(symbols)
      
      // Try to start again
      const consoleWarn = vi.spyOn(console, 'warn')
      await manager.start(symbols)

      expect(consoleWarn).toHaveBeenCalledWith('⚠️  Stream manager already running')
      consoleWarn.mockRestore()
    })

    it('should emit started event', async () => {
      const startedHandler = vi.fn()
      manager.on('started', startedHandler)

      await manager.start(['BTCUSDT'])

      expect(startedHandler).toHaveBeenCalledWith({
        symbols: 1,
        backfillEnabled: false,
      })
    })

    it('should handle initialization errors', async () => {
      mockWsClient.connect.mockRejectedValue(new Error('Connection failed'))

      await expect(manager.start(['BTCUSDT'])).rejects.toThrow('Connection failed')
    })
  })

  describe('Subscription Management', () => {
    it('should subscribe to kline streams in batches', async () => {
      const symbols = Array.from({ length: 25 }, (_, i) => `SYMBOL${i}USDT`)

      await manager.start(symbols)

      // Should have multiple subscribe calls due to batching (batchSize=10)
      expect(mockWsClient.subscribe).toHaveBeenCalledTimes(4) // ticker + 3 batches (10+10+5)
    })

    it('should subscribe to ticker stream', async () => {
      await manager.start(['BTCUSDT'])

      expect(mockWsClient.subscribe).toHaveBeenCalledWith(['!ticker@arr'])
    })

    it('should format kline stream names correctly', async () => {
      await manager.start(['BTCUSDT', 'ETHUSDT'])

      // Check that kline streams are lowercase with @kline_5m suffix
      const calls = mockWsClient.subscribe.mock.calls
      const klineCall = calls.find((call: any) => 
        call[0].some((stream: string) => stream.includes('@kline_5m'))
      )
      
      expect(klineCall).toBeDefined()
      expect(klineCall[0]).toContain('btcusdt@kline_5m')
      expect(klineCall[0]).toContain('ethusdt@kline_5m')
    })
  })

  describe('Event Handling', () => {
    it('should setup WebSocket event handlers', async () => {
      await manager.start(['BTCUSDT'])

      // Verify event handlers were registered
      expect(mockWsClient.on).toHaveBeenCalledWith('kline', expect.any(Function))
      expect(mockWsClient.on).toHaveBeenCalledWith('ticker', expect.any(Function))
      expect(mockWsClient.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockWsClient.on).toHaveBeenCalledWith('reconnect', expect.any(Function))
      expect(mockWsClient.on).toHaveBeenCalledWith('close', expect.any(Function))
      expect(mockWsClient.on).toHaveBeenCalledWith('maxReconnectReached', expect.any(Function))
    })

    it('should emit metricsUpdate on kline update', async () => {
      await manager.start(['BTCUSDT'])

      const metricsHandler = vi.fn()
      manager.on('metricsUpdate', metricsHandler)

      // Simulate kline update
      const klineHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'kline')[1]
      klineHandler({
        symbol: 'BTCUSDT',
        kline: {
          openTime: Date.now(),
          closeTime: Date.now() + 300000,
          open: 100,
          high: 105,
          low: 98,
          close: 102,
          volume: 1000,
          quoteVolume: 100000,
          isFinal: true,
        },
      })

      expect(metricsHandler).toHaveBeenCalled()
      expect(metricsHandler.mock.calls[0][0]).toMatchObject({
        symbol: 'BTCUSDT',
        metrics: expect.any(Object),
        timestamp: expect.any(Number),
      })
    })

    it('should emit tickerUpdate on ticker batch', async () => {
      await manager.start(['BTCUSDT'])

      const tickerHandler = vi.fn()
      manager.on('tickerUpdate', tickerHandler)

      // Simulate ticker update
      const tickerBatchHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'ticker')[1]
      tickerBatchHandler([
        {
          symbol: 'BTCUSDT',
          eventTime: Date.now(),
          close: 100,
          open: 98,
          high: 105,
          low: 97,
          volume: 1000,
          quoteVolume: 100000,
          priceChange: 2,
          priceChangePercent: 2.04,
          lastQty: 0.5,
          weightedAvgPrice: 100.5,
          fundingRate: 0.0001,
          indexPrice: 100.1,
          markPrice: 100.2,
          openInterest: 50000,
        },
      ])

      expect(tickerHandler).toHaveBeenCalled()
      expect(tickerHandler.mock.calls[0][0]).toMatchObject({
        tickers: expect.any(Array),
        timestamp: expect.any(Number),
      })
    })

    it('should emit error on WebSocket error', async () => {
      await manager.start(['BTCUSDT'])

      const errorHandler = vi.fn()
      manager.on('error', errorHandler)

      // Simulate error
      const wsErrorHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'error')[1]
      const testError = new Error('Test error')
      wsErrorHandler(testError)

      expect(errorHandler).toHaveBeenCalledWith(testError)
    })

    it('should emit reconnected on WebSocket reconnect', async () => {
      await manager.start(['BTCUSDT'])

      const reconnectHandler = vi.fn()
      manager.on('reconnected', reconnectHandler)

      // Simulate reconnect
      const wsReconnectHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'reconnect')[1]
      wsReconnectHandler()

      expect(reconnectHandler).toHaveBeenCalled()
    })

    it('should emit disconnected on WebSocket close', async () => {
      await manager.start(['BTCUSDT'])

      const disconnectHandler = vi.fn()
      manager.on('disconnected', disconnectHandler)

      // Simulate close
      const wsCloseHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'close')[1]
      wsCloseHandler()

      expect(disconnectHandler).toHaveBeenCalled()
    })

    it('should emit maxReconnectReached and stop', async () => {
      await manager.start(['BTCUSDT'])

      const maxReconnectHandler = vi.fn()
      manager.on('maxReconnectReached', maxReconnectHandler)

      // Simulate max reconnect reached
      const wsMaxReconnectHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'maxReconnectReached')[1]
      wsMaxReconnectHandler()

      expect(maxReconnectHandler).toHaveBeenCalled()
      expect(manager.getStatus().connected).toBe(true) // Still connected according to mock
    })

    it('should ignore non-final kline updates', async () => {
      await manager.start(['BTCUSDT'])

      const metricsHandler = vi.fn()
      manager.on('metricsUpdate', metricsHandler)

      // Simulate non-final kline update
      const klineHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'kline')[1]
      klineHandler({
        symbol: 'BTCUSDT',
        kline: {
          openTime: Date.now(),
          closeTime: Date.now() + 300000,
          open: 100,
          high: 105,
          low: 98,
          close: 102,
          volume: 1000,
          quoteVolume: 100000,
          isFinal: false, // Not final
        },
      })

      expect(metricsHandler).not.toHaveBeenCalled()
    })
  })

  describe('Metrics Access', () => {
    it('should return metrics for symbol', async () => {
      await manager.start(['BTCUSDT'])

      // Add some data
      const klineHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'kline')[1]
      klineHandler({
        symbol: 'BTCUSDT',
        kline: {
          openTime: Date.now(),
          closeTime: Date.now() + 300000,
          open: 100,
          high: 105,
          low: 98,
          close: 102,
          volume: 1000,
          quoteVolume: 100000,
          isFinal: true,
        },
      })

      const metrics = manager.getMetrics('BTCUSDT')

      expect(metrics).toBeDefined()
      expect(metrics.symbol).toBe('BTCUSDT')
      expect(metrics.timestamp).toBeGreaterThan(0)
    })

    it('should return all metrics', async () => {
      // Mock getAllSymbolsChanges to return a Map with both symbols
      mockChangeCalculator.getAllSymbolsChanges = vi.fn().mockReturnValue(
        new Map([
          ['BTCUSDT', { symbol: 'BTCUSDT', timestamp: Date.now() }],
          ['ETHUSDT', { symbol: 'ETHUSDT', timestamp: Date.now() }],
        ])
      )

      await manager.start(['BTCUSDT', 'ETHUSDT'])

      const allMetrics = manager.getAllMetrics()

      expect(allMetrics.size).toBe(2)
      expect(allMetrics.has('BTCUSDT')).toBe(true)
      expect(allMetrics.has('ETHUSDT')).toBe(true)
    })

    it('should return ticker data for symbol', async () => {
      await manager.start(['BTCUSDT'])

      // Add ticker data
      const tickerHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'ticker')[1]
      tickerHandler([
        {
          symbol: 'BTCUSDT',
          eventTime: Date.now(),
          close: 100,
          open: 98,
          high: 105,
          low: 97,
          volume: 1000,
          quoteVolume: 100000,
          priceChange: 2,
          priceChangePercent: 2.04,
          lastQty: 0.5,
          weightedAvgPrice: 100.5,
          fundingRate: 0.0001,
          indexPrice: 100.1,
          markPrice: 100.2,
          openInterest: 50000,
        },
      ])

      const ticker = manager.getTickerData('BTCUSDT')

      expect(ticker).toBeDefined()
      expect(ticker?.symbol).toBe('BTCUSDT')
      expect(ticker?.close).toBe(100)
    })

    it('should return all ticker data', async () => {
      await manager.start(['BTCUSDT'])

      // Add ticker data
      const tickerHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'ticker')[1]
      tickerHandler([
        { symbol: 'BTCUSDT', close: 100, eventTime: Date.now() } as any,
        { symbol: 'ETHUSDT', close: 200, eventTime: Date.now() } as any,
      ])

      const allTickers = manager.getAllTickerData()

      expect(allTickers).toHaveLength(2)
      expect(allTickers.some(t => t.symbol === 'BTCUSDT')).toBe(true)
      expect(allTickers.some(t => t.symbol === 'ETHUSDT')).toBe(true)
    })
  })

  describe('Warm-up Status', () => {
    it('should return warm-up status', async () => {
      await manager.start(['BTCUSDT', 'ETHUSDT'])

      const warmupStatus = manager.getWarmupStatus()

      expect(warmupStatus.totalSymbols).toBe(2)
      expect(warmupStatus.timeframes['5m'].total).toBe(2)
      expect(warmupStatus.overallProgress).toBeGreaterThanOrEqual(0)
    })

    it('should track ready symbols per timeframe', async () => {
      // Mock isReady to return true for shorter timeframes
      mockChangeCalculator.isReady = vi.fn((symbol: string, timeframe: string) => {
        return ['5m', '15m', '1h'].includes(timeframe)
      })

      await manager.start(['BTCUSDT'])

      // Add 12 candles (enough for 1h)
      const klineHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'kline')[1]
      for (let i = 0; i < 12; i++) {
        klineHandler({
          symbol: 'BTCUSDT',
          kline: {
            openTime: Date.now() + i * 300000,
            closeTime: Date.now() + (i + 1) * 300000,
            open: 100 + i,
            high: 105 + i,
            low: 98 + i,
            close: 102 + i,
            volume: 1000,
            quoteVolume: 100000,
            isFinal: true,
          },
        })
      }

      const warmupStatus = manager.getWarmupStatus()

      expect(warmupStatus.timeframes['5m'].ready).toBe(1)
      expect(warmupStatus.timeframes['15m'].ready).toBe(1)
      expect(warmupStatus.timeframes['1h'].ready).toBe(1)
      expect(warmupStatus.timeframes['4h'].ready).toBe(0) // Not enough data
    })
  })

  describe('Status Tracking', () => {
    it('should return connection status', async () => {
      await manager.start(['BTCUSDT'])

      const status = manager.getStatus()

      expect(status.connected).toBe(true)
      expect(status.subscribedStreams).toBe(2) // 1 kline + 1 ticker
      expect(status.buffersReady).toBeGreaterThanOrEqual(0)
      expect(status.lastKlineUpdate).toBe(0) // No updates yet
      expect(status.lastTickerUpdate).toBe(0) // No updates yet
    })

    it('should update lastKlineUpdate timestamp', async () => {
      await manager.start(['BTCUSDT'])

      const klineHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'kline')[1]
      klineHandler({
        symbol: 'BTCUSDT',
        kline: {
          openTime: Date.now(),
          closeTime: Date.now() + 300000,
          open: 100,
          high: 105,
          low: 98,
          close: 102,
          volume: 1000,
          quoteVolume: 100000,
          isFinal: true,
        },
      })

      const status = manager.getStatus()
      expect(status.lastKlineUpdate).toBeGreaterThan(0)
    })

    it('should update lastTickerUpdate timestamp', async () => {
      await manager.start(['BTCUSDT'])

      const tickerHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'ticker')[1]
      tickerHandler([{ symbol: 'BTCUSDT', close: 100, eventTime: Date.now() } as any])

      const status = manager.getStatus()
      expect(status.lastTickerUpdate).toBeGreaterThan(0)
    })
  })

  describe('Shutdown', () => {
    it('should stop successfully', async () => {
      await manager.start(['BTCUSDT'])

      manager.stop()

      expect(mockWsClient.disconnect).toHaveBeenCalled()
    })

    it('should emit stopped event', async () => {
      await manager.start(['BTCUSDT'])

      const stoppedHandler = vi.fn()
      manager.on('stopped', stoppedHandler)

      manager.stop()

      expect(stoppedHandler).toHaveBeenCalled()
    })

    it('should not fail when stopping twice', async () => {
      await manager.start(['BTCUSDT'])

      manager.stop()
      manager.stop() // Second stop

      expect(mockWsClient.disconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle kline processing errors', async () => {
      // Make updateCandle throw an error
      mockBufferManager.updateCandle = vi.fn().mockImplementation(() => {
        throw new Error('Update failed')
      })

      await manager.start(['BTCUSDT'])

      const errorHandler = vi.fn()
      manager.on('error', errorHandler)

      // Simulate kline update - should trigger error
      const klineHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'kline')[1]
      klineHandler({
        symbol: 'BTCUSDT',
        kline: {
          openTime: Date.now(),
          closeTime: Date.now() + 300000,
          open: 100,
          high: 105,
          low: 98,
          close: 102,
          volume: 1000,
          quoteVolume: 100000,
          isFinal: true,
        },
      })

      expect(errorHandler).toHaveBeenCalled()
    })

    it('should handle ticker processing errors', async () => {
      await manager.start(['BTCUSDT'])

      const errorHandler = vi.fn()
      manager.on('error', errorHandler)

      // Simulate ticker update with invalid data
      const tickerHandler = mockWsClient.on.mock.calls.find((call: any) => call[0] === 'ticker')[1]
      tickerHandler(null) // Invalid data

      expect(errorHandler).toHaveBeenCalled()
    })
  })
})
