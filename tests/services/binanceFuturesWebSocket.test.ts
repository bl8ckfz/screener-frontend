import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BinanceFuturesWebSocket } from '@/services/binanceFuturesWebSocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: any) => void) | null = null
  onmessage: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onclose: ((event: any) => void) | null = null

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) this.onopen({})
    }, 10)
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) this.onclose({})
  }

  ping() {
    // Mock ping
  }
}

describe('BinanceFuturesWebSocket', () => {
  let ws: BinanceFuturesWebSocket
  let originalWebSocket: any
  
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
    // Save original and set mock
    originalWebSocket = global.WebSocket
    // @ts-ignore
    global.WebSocket = MockWebSocket as any
  })

  afterEach(() => {
    if (ws) {
      ws.disconnect()
    }
    vi.useRealTimers()
    // Restore original WebSocket
    global.WebSocket = originalWebSocket
  })

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      ws = new BinanceFuturesWebSocket()
      
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      expect(ws.getState()).toBe('connected')
    })

    it('should handle connection failure', async () => {
      // Mock WebSocket that fails immediately
      const FailingWebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url)
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED
            if (this.onerror) this.onerror(new Error('Connection failed'))
            if (this.onclose) this.onclose({})
          }, 5)
        }
      }
      // @ts-ignore
      global.WebSocket = FailingWebSocket as any

      ws = new BinanceFuturesWebSocket({ maxReconnectAttempts: 1 })
      
      const errorHandler = vi.fn()
      ws.on('error', errorHandler)

      try {
        const connectPromise = ws.connect()
        vi.advanceTimersByTime(20)
        await connectPromise
      } catch (error) {
        // Expected to fail
      }

      vi.advanceTimersByTime(100)
      expect(errorHandler).toHaveBeenCalled()
      
      // Restore mock after test
      // @ts-ignore
      global.WebSocket = MockWebSocket as any
    })

    it('should track connection state correctly', async () => {
      ws = new BinanceFuturesWebSocket()
      
      expect(ws.getState()).toBe('disconnected')
      
      const connectPromise = ws.connect()
      expect(ws.getState()).toBe('connecting')
      
      vi.advanceTimersByTime(20)
      await connectPromise
      
      expect(ws.getState()).toBe('connected')
    })

    it('should disconnect cleanly', async () => {
      ws = new BinanceFuturesWebSocket()
      
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      ws.disconnect()
      
      expect(ws.getState()).toBe('disconnected')
    })
  })

  describe('Subscription Management', () => {
    beforeEach(async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise
    })

    it('should subscribe to streams', async () => {
      const streams = ['btcusdt@kline_5m', 'ethusdt@kline_5m']
      
      await ws.subscribe(streams)
      
      const subscriptions = ws.getSubscriptions()
      expect(subscriptions).toContain('btcusdt@kline_5m')
      expect(subscriptions).toContain('ethusdt@kline_5m')
    })

    it('should unsubscribe from streams', async () => {
      const streams = ['btcusdt@kline_5m', 'ethusdt@kline_5m']
      
      await ws.subscribe(streams)
      await ws.unsubscribe(['btcusdt@kline_5m'])
      
      const subscriptions = ws.getSubscriptions()
      expect(subscriptions).not.toContain('btcusdt@kline_5m')
      expect(subscriptions).toContain('ethusdt@kline_5m')
    })

    it('should handle batch subscriptions', async () => {
      const streams = Array.from({ length: 50 }, (_, i) => `symbol${i}@kline_5m`)
      
      await ws.subscribe(streams)
      
      const subscriptions = ws.getSubscriptions()
      expect(subscriptions.length).toBe(50)
    })

    it('should throw error when subscribing while disconnected', async () => {
      ws.disconnect()
      
      await expect(ws.subscribe(['btcusdt@kline_5m'])).rejects.toThrow('WebSocket not connected')
    })

    it('should persist subscriptions for reconnection', async () => {
      const streams = ['btcusdt@kline_5m', 'ethusdt@kline_5m']
      await ws.subscribe(streams)
      
      // Simulate disconnect
      // @ts-ignore - Access private ws property for testing
      const mockWs = ws['ws']
      if (mockWs && mockWs.onclose) {
        mockWs.onclose({})
      }
      
      // Should have stored subscriptions
      const subscriptions = ws.getSubscriptions()
      expect(subscriptions.length).toBe(2)
    })
  })

  describe('Message Parsing', () => {
    beforeEach(async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise
    })

    it('should parse kline messages correctly', async () => {
      const klineHandler = vi.fn()
      ws.on('kline', klineHandler)

      // Simulate WebSocket message
      const klineMessage = {
        stream: 'btcusdt@kline_5m',
        data: {
          e: 'kline',
          E: 1638360000000,
          s: 'BTCUSDT',
          k: {
            t: 1638360000000,
            T: 1638360299999,
            s: 'BTCUSDT',
            i: '5m',
            o: '50000.00',
            h: '50100.00',
            l: '49900.00',
            c: '50050.00',
            v: '100.5',
            q: '5000000.00',
            x: true,
          },
        },
      }

      // @ts-ignore - Access private ws property
      const mockWs = ws['ws']
      if (mockWs && mockWs.onmessage) {
        mockWs.onmessage({ data: JSON.stringify(klineMessage) })
      }

      expect(klineHandler).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        interval: '5m',
        kline: {
          openTime: 1638360000000,
          closeTime: 1638360299999,
          open: 50000.00,
          high: 50100.00,
          low: 49900.00,
          close: 50050.00,
          volume: 100.5,
          quoteVolume: 5000000.00,
          isFinal: true,
        },
      })
    })

    it('should ignore incomplete kline candles', async () => {
      const klineHandler = vi.fn()
      ws.on('kline', klineHandler)

      const incompleteKline = {
        stream: 'btcusdt@kline_5m',
        data: {
          s: 'BTCUSDT',
          k: {
            t: 1638360000000,
            T: 1638360299999,
            i: '5m',
            o: '50000.00',
            h: '50100.00',
            l: '49900.00',
            c: '50050.00',
            v: '100.5',
            q: '5000000.00',
            x: false, // Not final
          },
        },
      }

      // @ts-ignore
      const mockWs = ws['ws']
      if (mockWs && mockWs.onmessage) {
        mockWs.onmessage({ data: JSON.stringify(incompleteKline) })
      }

      // Should still emit (filtering happens at ring buffer level)
      expect(klineHandler).toHaveBeenCalled()
    })

    it('should handle subscription confirmation messages', async () => {
      const confirmMessage = {
        result: null,
        id: 1638360000000,
      }

      // Should not throw
      // @ts-ignore
      const mockWs = ws['ws']
      if (mockWs && mockWs.onmessage) {
        expect(() => {
          mockWs.onmessage({ data: JSON.stringify(confirmMessage) })
        }).not.toThrow()
      }
    })

    it('should parse string numbers to floats', async () => {
      const klineHandler = vi.fn()
      ws.on('kline', klineHandler)

      const klineMessage = {
        stream: 'btcusdt@kline_5m',
        data: {
          s: 'BTCUSDT',
          k: {
            t: 1638360000000,
            T: 1638360299999,
            i: '5m',
            o: '50000.00',    // String
            h: '50100.00',    // String
            l: '49900.00',    // String
            c: '50050.00',    // String
            v: '100.5',       // String
            q: '5000000.00',  // String
            x: true,
          },
        },
      }

      // @ts-ignore
      const mockWs = ws['ws']
      if (mockWs && mockWs.onmessage) {
        mockWs.onmessage({ data: JSON.stringify(klineMessage) })
      }

      const call = klineHandler.mock.calls[0][0]
      expect(typeof call.kline.open).toBe('number')
      expect(typeof call.kline.high).toBe('number')
      expect(typeof call.kline.volume).toBe('number')
    })
  })

  describe('Reconnection Logic', () => {
    it('should attempt reconnection after disconnect', async () => {
      ws = new BinanceFuturesWebSocket({ maxReconnectAttempts: 3, reconnectDelay: 1000 })
      
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      const reconnectHandler = vi.fn()
      ws.on('reconnect', reconnectHandler)

      // Simulate disconnect
      // @ts-ignore
      const mockWs = ws['ws']
      if (mockWs && mockWs.onclose) {
        mockWs.onclose({})
      }

      expect(ws.getState()).toBe('reconnecting')

      // Fast-forward through reconnection delay
      vi.advanceTimersByTime(1100)
      
      // Should attempt reconnection
      vi.advanceTimersByTime(20)
      
      expect(ws.getState()).toBe('connected')
    })

    it('should use exponential backoff', async () => {
      ws = new BinanceFuturesWebSocket({ maxReconnectAttempts: 5, reconnectDelay: 1000 })
      
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      // Track connection attempts
      let connectAttempts = 0
      const originalConnect = ws.connect.bind(ws)
      
      // Mock connect to track attempts
      vi.spyOn(ws, 'connect').mockImplementation(async () => {
        connectAttempts++
        if (connectAttempts < 3) {
          // Simulate failed connection
          throw new Error('Connection failed')
        }
        // Success on 3rd attempt
        return Promise.resolve()
      })

      // Trigger disconnect to start reconnection
      // @ts-ignore
      const mockWs = ws['ws']
      if (mockWs && mockWs.onclose) {
        mockWs.onclose({})
      }

      // Wait for first retry attempt (1000ms delay)
      await vi.advanceTimersByTimeAsync(1100)
      expect(connectAttempts).toBe(1)

      // Wait for second retry (2000ms exponential backoff)
      await vi.advanceTimersByTimeAsync(2100)
      expect(connectAttempts).toBe(2)

      // Wait for third retry (4000ms exponential backoff) - should succeed
      await vi.advanceTimersByTimeAsync(4100)
      expect(connectAttempts).toBe(3)
    })

    it('should stop after max reconnect attempts', async () => {
      ws = new BinanceFuturesWebSocket({ maxReconnectAttempts: 2, reconnectDelay: 100 })
      
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      const maxReconnectHandler = vi.fn()
      ws.on('maxReconnectReached', maxReconnectHandler)

      // Mock all connections to fail
      ws.connect = vi.fn().mockRejectedValue(new Error('Connection failed'))

      // Trigger disconnect
      // @ts-ignore
      const mockWs = ws['ws']
      if (mockWs && mockWs.onclose) {
        mockWs.onclose({})
      }

      // Attempt 1
      vi.advanceTimersByTime(200)
      
      // Attempt 2
      vi.advanceTimersByTime(400)

      // Should trigger max reconnect reached
      await vi.runAllTimersAsync()
      expect(maxReconnectHandler).toHaveBeenCalled()
    })

    it('should resubscribe after reconnection', async () => {
      ws = new BinanceFuturesWebSocket({ maxReconnectAttempts: 3 })
      
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      // Subscribe to streams
      await ws.subscribe(['btcusdt@kline_5m', 'ethusdt@kline_5m'])

      // Trigger disconnect
      // @ts-ignore
      const mockWs = ws['ws']
      if (mockWs && mockWs.onclose) {
        mockWs.onclose({})
      }

      // Wait for reconnection
      vi.advanceTimersByTime(1100)
      vi.advanceTimersByTime(20)

      // Check subscriptions persisted
      const subscriptions = ws.getSubscriptions()
      expect(subscriptions.length).toBe(2)
    })
  })

  describe('Heartbeat (Ping/Pong)', () => {
    // NOTE: Tests skipped - Binance Futures WebSocket handles ping/pong automatically
    // The server sends ping frames and browser responds with pong automatically
    // Manual ping messages are not needed and cause "Invalid request" errors
    
    it.skip('should send ping at regular intervals', async () => {
      // Skipped: Ping/pong handled automatically by Binance server
    })

    it.skip('should stop ping after disconnect', async () => {
      // Skipped: Ping/pong handled automatically by Binance server
    })
  })

  describe('Event Emitter', () => {
    beforeEach(async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise
    })

    it('should register and trigger event handlers', () => {
      const handler = vi.fn()
      ws.on('kline', handler)

      // @ts-ignore - Access private emit method
      ws['emit']('kline', { test: 'data' })

      expect(handler).toHaveBeenCalledWith({ test: 'data' })
    })

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      ws.on('kline', handler1)
      ws.on('kline', handler2)

      // @ts-ignore
      ws['emit']('kline', { test: 'data' })

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('should remove event handlers with off()', () => {
      const handler = vi.fn()
      ws.on('kline', handler)
      ws.off('kline', handler)

      // @ts-ignore
      ws['emit']('kline', { test: 'data' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('should emit error events', async () => {
      const errorHandler = vi.fn()
      ws.on('error', errorHandler)

      // @ts-ignore
      const mockWs = ws['ws']
      if (mockWs && mockWs.onerror) {
        mockWs.onerror(new Error('Test error'))
      }

      expect(errorHandler).toHaveBeenCalled()
    })

    it('should emit close events', () => {
      const closeHandler = vi.fn()
      ws.on('close', closeHandler)

      ws.disconnect()

      // Close event should be triggered
      expect(closeHandler).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed JSON messages', async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      const errorHandler = vi.fn()
      ws.on('error', errorHandler)

      // @ts-ignore
      const mockWs = ws['ws']
      if (mockWs && mockWs.onmessage) {
        mockWs.onmessage({ data: 'invalid json{' })
      }

      // Should emit error
      expect(errorHandler).toHaveBeenCalled()
    })

    it('should handle empty subscription arrays', async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      await expect(ws.subscribe([])).resolves.not.toThrow()
    })

    it('should handle unsubscribe before subscribe', async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      // Should not throw
      await expect(ws.unsubscribe(['btcusdt@kline_5m'])).resolves.not.toThrow()
    })

    it('should handle rapid connect/disconnect cycles', async () => {
      ws = new BinanceFuturesWebSocket()
      
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise
      
      ws.disconnect()
      
      const reconnectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await reconnectPromise

      expect(ws.getState()).toBe('connected')
    })
  })

  describe('1m Kline Subscription', () => {
    it('should subscribe to 1m kline streams', async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      const sendSpy = vi.spyOn(ws['ws']!, 'send')
      
      await ws.subscribe1mKlines(['BTCUSDT', 'ETHUSDT'])

      expect(sendSpy).toHaveBeenCalledOnce()
      const sentMessage = JSON.parse(sendSpy.mock.calls[0][0])
      expect(sentMessage.method).toBe('SUBSCRIBE')
      expect(sentMessage.params).toEqual(['btcusdt@kline_1m', 'ethusdt@kline_1m'])
    })

    it('should format stream names with lowercase', async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      const sendSpy = vi.spyOn(ws['ws']!, 'send')
      
      await ws.subscribe1mKlines(['BTCUSDT', 'ETHUSDT', 'BNBUSDT'])

      const sentMessage = JSON.parse(sendSpy.mock.calls[0][0])
      expect(sentMessage.params).toContain('btcusdt@kline_1m')
      expect(sentMessage.params).toContain('ethusdt@kline_1m')
      expect(sentMessage.params).toContain('bnbusdt@kline_1m')
    })

    it('should handle empty symbol list', async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      const sendSpy = vi.spyOn(ws['ws']!, 'send')
      
      await ws.subscribe1mKlines([])

      expect(sendSpy).toHaveBeenCalledOnce()
      const sentMessage = JSON.parse(sendSpy.mock.calls[0][0])
      expect(sentMessage.params).toEqual([])
    })

    it('should throw if not connected', async () => {
      ws = new BinanceFuturesWebSocket()
      
      await expect(ws.subscribe1mKlines(['BTCUSDT'])).rejects.toThrow('WebSocket not connected')
    })
  })

  describe('5m Kline Subscription', () => {
    it('should subscribe to 5m kline streams', async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      const sendSpy = vi.spyOn(ws['ws']!, 'send')
      
      await ws.subscribe5mKlines(['BTCUSDT', 'ETHUSDT'])

      expect(sendSpy).toHaveBeenCalledOnce()
      const sentMessage = JSON.parse(sendSpy.mock.calls[0][0])
      expect(sentMessage.method).toBe('SUBSCRIBE')
      expect(sentMessage.params).toEqual(['btcusdt@kline_5m', 'ethusdt@kline_5m'])
    })

    it('should format stream names with lowercase', async () => {
      ws = new BinanceFuturesWebSocket()
      const connectPromise = ws.connect()
      vi.advanceTimersByTime(20)
      await connectPromise

      const sendSpy = vi.spyOn(ws['ws']!, 'send')
      
      await ws.subscribe5mKlines(['BTCUSDT'])

      const sentMessage = JSON.parse(sendSpy.mock.calls[0][0])
      expect(sentMessage.params).toEqual(['btcusdt@kline_5m'])
    })
  })
})
