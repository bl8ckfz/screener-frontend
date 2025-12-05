/**
 * Tests for Binance Futures WebSocket Ticker Stream Support
 * 
 * Tests the !ticker@arr stream parsing, data storage, and convenience methods
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BinanceFuturesWebSocket } from '@/services/binanceFuturesWebSocket'
import type { FuturesTickerData } from '@/types/api'

// Mock WebSocket implementation
class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3

  readyState = MockWebSocket.CLOSED
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((error: any) => void) | null = null
  onclose: ((event: any) => void) | null = null

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.()
    }, 10)
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code: 1000, reason: 'Normal closure' })
  }
}

describe('BinanceFuturesWebSocket - Ticker Stream', () => {
  let ws: BinanceFuturesWebSocket
  let originalWebSocket: any

  beforeEach(() => {
    // Save original WebSocket and replace with mock
    originalWebSocket = global.WebSocket
    global.WebSocket = MockWebSocket as any
    
    // Create new WebSocket client
    ws = new BinanceFuturesWebSocket()
  })

  afterEach(() => {
    // Cleanup
    ws.disconnect()
    global.WebSocket = originalWebSocket
  })

  describe('Ticker Subscription', () => {
    it('should subscribe to ticker stream using subscribeTicker()', async () => {
      await ws.connect()
      await ws.subscribeTicker()
      
      const subscriptions = ws.getSubscriptions()
      expect(subscriptions).toContain('!ticker@arr')
    })

    it('should handle ticker subscription manually', async () => {
      await ws.connect()
      await ws.subscribe(['!ticker@arr'])
      
      const subscriptions = ws.getSubscriptions()
      expect(subscriptions).toContain('!ticker@arr')
    })

    it('should unsubscribe from ticker stream', async () => {
      await ws.connect()
      await ws.subscribeTicker()
      await ws.unsubscribe(['!ticker@arr'])
      
      const subscriptions = ws.getSubscriptions()
      expect(subscriptions).not.toContain('!ticker@arr')
    })
  })

  describe('Ticker Data Parsing', () => {
    it('should parse ticker array and emit ticker event', async () => {
      await ws.connect()
      
      const tickerData = vi.fn()
      ws.on('ticker', tickerData)

      // Simulate receiving ticker data
      const mockTickerMessage = {
        stream: '!ticker@arr',
        data: [
          {
            s: 'BTCUSDT',
            E: 1701878400000,
            c: '43250.50',
            o: '42000.00',
            h: '43500.00',
            l: '41800.00',
            v: '15234.5',
            q: '650000000',
            p: '1250.50',
            P: '2.98',
            Q: '0.5',
            w: '42500.25',
            r: '0.0001',
            i: '43240.00',
            m: '43245.00',
            n: '125000000'
          },
          {
            s: 'ETHUSDT',
            E: 1701878400000,
            c: '2250.75',
            o: '2200.00',
            h: '2280.00',
            l: '2190.00',
            v: '85432.3',
            q: '192000000',
            p: '50.75',
            P: '2.31',
            Q: '1.2',
            w: '2225.50',
            r: '0.00015',
            i: '2249.50',
            m: '2250.25',
            n: '45000000'
          }
        ]
      }

      // Trigger message handler
      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })

      // Verify ticker event was emitted with parsed data
      expect(tickerData).toHaveBeenCalledTimes(1)
      const emittedTickers = tickerData.mock.calls[0][0] as FuturesTickerData[]
      
      expect(emittedTickers).toHaveLength(2)
      expect(emittedTickers[0]).toMatchObject({
        symbol: 'BTCUSDT',
        eventTime: 1701878400000,
        close: 43250.50,
        open: 42000.00,
        high: 43500.00,
        low: 41800.00,
        volume: 15234.5,
        quoteVolume: 650000000,
        priceChange: 1250.50,
        priceChangePercent: 2.98,
        lastQty: 0.5,
        weightedAvgPrice: 42500.25,
        fundingRate: 0.0001,
        indexPrice: 43240.00,
        markPrice: 43245.00,
        openInterest: 125000000
      })
    })

    it('should convert all string numbers to floats', async () => {
      await ws.connect()
      
      const tickerData = vi.fn()
      ws.on('ticker', tickerData)

      const mockTickerMessage = {
        stream: '!ticker@arr',
        data: [
          {
            s: 'BTCUSDT',
            E: 1701878400000,
            c: '43250.50',
            o: '42000.00',
            h: '43500.00',
            l: '41800.00',
            v: '15234.5',
            q: '650000000',
            p: '1250.50',
            P: '2.98',
            Q: '0.5',
            w: '42500.25',
            r: '0.0001',
            i: '43240.00',
            m: '43245.00',
            n: '125000000'
          }
        ]
      }

      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })

      const emittedTickers = tickerData.mock.calls[0][0] as FuturesTickerData[]
      const ticker = emittedTickers[0]

      // Verify all numeric fields are actually numbers, not strings
      expect(typeof ticker.close).toBe('number')
      expect(typeof ticker.open).toBe('number')
      expect(typeof ticker.high).toBe('number')
      expect(typeof ticker.low).toBe('number')
      expect(typeof ticker.volume).toBe('number')
      expect(typeof ticker.quoteVolume).toBe('number')
      expect(typeof ticker.priceChange).toBe('number')
      expect(typeof ticker.priceChangePercent).toBe('number')
      expect(typeof ticker.lastQty).toBe('number')
      expect(typeof ticker.weightedAvgPrice).toBe('number')
      expect(typeof ticker.fundingRate).toBe('number')
      expect(typeof ticker.indexPrice).toBe('number')
      expect(typeof ticker.markPrice).toBe('number')
      expect(typeof ticker.openInterest).toBe('number')
    })

    it('should handle missing optional fields with defaults', async () => {
      await ws.connect()
      
      const tickerData = vi.fn()
      ws.on('ticker', tickerData)

      // Simulate ticker with missing futures-specific fields
      const mockTickerMessage = {
        stream: '!ticker@arr',
        data: [
          {
            s: 'BTCUSDT',
            E: 1701878400000,
            c: '43250.50',
            o: '42000.00',
            h: '43500.00',
            l: '41800.00',
            v: '15234.5',
            q: '650000000',
            p: '1250.50',
            P: '2.98',
            Q: '0.5',
            w: '42500.25'
            // Missing: r, i, m, n
          }
        ]
      }

      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })

      const emittedTickers = tickerData.mock.calls[0][0] as FuturesTickerData[]
      const ticker = emittedTickers[0]

      // Verify default values for missing fields
      expect(ticker.fundingRate).toBe(0)
      expect(ticker.indexPrice).toBe(0)
      expect(ticker.markPrice).toBe(43250.50) // Falls back to close price
      expect(ticker.openInterest).toBe(0)
    })
  })

  describe('Ticker Data Storage', () => {
    it('should store ticker data in internal map', async () => {
      await ws.connect()

      const mockTickerMessage = {
        stream: '!ticker@arr',
        data: [
          {
            s: 'BTCUSDT',
            E: 1701878400000,
            c: '43250.50',
            o: '42000.00',
            h: '43500.00',
            l: '41800.00',
            v: '15234.5',
            q: '650000000',
            p: '1250.50',
            P: '2.98',
            Q: '0.5',
            w: '42500.25',
            r: '0.0001',
            i: '43240.00',
            m: '43245.00',
            n: '125000000'
          }
        ]
      }

      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })

      // Verify data is stored
      const ticker = ws.getTickerData('BTCUSDT')
      expect(ticker).toBeDefined()
      expect(ticker?.symbol).toBe('BTCUSDT')
      expect(ticker?.close).toBe(43250.50)
    })

    it('should retrieve ticker data by symbol', async () => {
      await ws.connect()

      const mockTickerMessage = {
        stream: '!ticker@arr',
        data: [
          { s: 'BTCUSDT', E: 1701878400000, c: '43250.50', o: '42000.00', h: '43500.00', l: '41800.00', v: '15234.5', q: '650000000', p: '1250.50', P: '2.98', Q: '0.5', w: '42500.25' },
          { s: 'ETHUSDT', E: 1701878400000, c: '2250.75', o: '2200.00', h: '2280.00', l: '2190.00', v: '85432.3', q: '192000000', p: '50.75', P: '2.31', Q: '1.2', w: '2225.50' }
        ]
      }

      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })

      const btcTicker = ws.getTickerData('BTCUSDT')
      const ethTicker = ws.getTickerData('ETHUSDT')
      const nonExistent = ws.getTickerData('XYZUSDT')

      expect(btcTicker?.symbol).toBe('BTCUSDT')
      expect(ethTicker?.symbol).toBe('ETHUSDT')
      expect(nonExistent).toBeUndefined()
    })

    it('should retrieve all ticker data', async () => {
      await ws.connect()

      const mockTickerMessage = {
        stream: '!ticker@arr',
        data: [
          { s: 'BTCUSDT', E: 1701878400000, c: '43250.50', o: '42000.00', h: '43500.00', l: '41800.00', v: '15234.5', q: '650000000', p: '1250.50', P: '2.98', Q: '0.5', w: '42500.25' },
          { s: 'ETHUSDT', E: 1701878400000, c: '2250.75', o: '2200.00', h: '2280.00', l: '2190.00', v: '85432.3', q: '192000000', p: '50.75', P: '2.31', Q: '1.2', w: '2225.50' },
          { s: 'BNBUSDT', E: 1701878400000, c: '320.50', o: '315.00', h: '325.00', l: '314.00', v: '45234.2', q: '14500000', p: '5.50', P: '1.75', Q: '2.5', w: '318.75' }
        ]
      }

      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })

      const allTickers = ws.getAllTickerData()
      expect(allTickers).toHaveLength(3)
      
      const symbols = allTickers.map(t => t.symbol)
      expect(symbols).toContain('BTCUSDT')
      expect(symbols).toContain('ETHUSDT')
      expect(symbols).toContain('BNBUSDT')
    })

    it('should update existing ticker data on new message', async () => {
      await ws.connect()

      // First message
      const firstMessage = {
        stream: '!ticker@arr',
        data: [
          { s: 'BTCUSDT', E: 1701878400000, c: '43250.50', o: '42000.00', h: '43500.00', l: '41800.00', v: '15234.5', q: '650000000', p: '1250.50', P: '2.98', Q: '0.5', w: '42500.25' }
        ]
      }

      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(firstMessage) })

      let ticker = ws.getTickerData('BTCUSDT')
      expect(ticker?.close).toBe(43250.50)

      // Second message with updated price
      const secondMessage = {
        stream: '!ticker@arr',
        data: [
          { s: 'BTCUSDT', E: 1701878500000, c: '43500.00', o: '42000.00', h: '43600.00', l: '41800.00', v: '15500.0', q: '660000000', p: '1500.00', P: '3.57', Q: '0.6', w: '42600.50' }
        ]
      }

      mockWs.onmessage?.({ data: JSON.stringify(secondMessage) })

      ticker = ws.getTickerData('BTCUSDT')
      expect(ticker?.close).toBe(43500.00)
      expect(ticker?.eventTime).toBe(1701878500000)
    })

    it('should clear ticker data', async () => {
      await ws.connect()

      const mockTickerMessage = {
        stream: '!ticker@arr',
        data: [
          { s: 'BTCUSDT', E: 1701878400000, c: '43250.50', o: '42000.00', h: '43500.00', l: '41800.00', v: '15234.5', q: '650000000', p: '1250.50', P: '2.98', Q: '0.5', w: '42500.25' }
        ]
      }

      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })

      expect(ws.getAllTickerData()).toHaveLength(1)

      ws.clearTickerData()

      expect(ws.getAllTickerData()).toHaveLength(0)
      expect(ws.getTickerData('BTCUSDT')).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty ticker array', async () => {
      await ws.connect()
      
      const tickerData = vi.fn()
      ws.on('ticker', tickerData)

      const mockTickerMessage = {
        stream: '!ticker@arr',
        data: []
      }

      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })

      expect(tickerData).toHaveBeenCalledWith([])
      expect(ws.getAllTickerData()).toHaveLength(0)
    })

    it('should handle large ticker batch (~590 symbols)', async () => {
      await ws.connect()
      
      const tickerData = vi.fn()
      ws.on('ticker', tickerData)

      // Generate 590 mock tickers
      const largeBatch = Array.from({ length: 590 }, (_, i) => ({
        s: `SYM${i}USDT`,
        E: 1701878400000,
        c: `${1000 + i}.50`,
        o: `${1000 + i - 10}.00`,
        h: `${1000 + i + 5}.00`,
        l: `${1000 + i - 15}.00`,
        v: '1000.0',
        q: '1000000',
        p: '10.50',
        P: '1.05',
        Q: '0.5',
        w: `${1000 + i}.25`
      }))

      const mockTickerMessage = {
        stream: '!ticker@arr',
        data: largeBatch
      }

      const mockWs = (ws as any).ws as MockWebSocket
      mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })

      expect(tickerData).toHaveBeenCalledTimes(1)
      const emittedTickers = tickerData.mock.calls[0][0] as FuturesTickerData[]
      expect(emittedTickers).toHaveLength(590)
      expect(ws.getAllTickerData()).toHaveLength(590)
    })

    it('should handle ticker updates at ~1s intervals', async () => {
      await ws.connect()
      
      const tickerData = vi.fn()
      ws.on('ticker', tickerData)

      const mockWs = (ws as any).ws as MockWebSocket

      // Simulate 5 ticker updates (simulating ~1s intervals)
      for (let i = 0; i < 5; i++) {
        const mockTickerMessage = {
          stream: '!ticker@arr',
          data: [
            { s: 'BTCUSDT', E: 1701878400000 + (i * 1000), c: `${43250 + i}.50`, o: '42000.00', h: '43500.00', l: '41800.00', v: '15234.5', q: '650000000', p: '1250.50', P: '2.98', Q: '0.5', w: '42500.25' }
          ]
        }
        
        mockWs.onmessage?.({ data: JSON.stringify(mockTickerMessage) })
      }

      expect(tickerData).toHaveBeenCalledTimes(5)
      
      const latestTicker = ws.getTickerData('BTCUSDT')
      expect(latestTicker?.close).toBe(43254.50)
      expect(latestTicker?.eventTime).toBe(1701878404000)
    })
  })
})
