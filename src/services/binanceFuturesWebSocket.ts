/**
 * Binance Futures WebSocket Client
 * 
 * Connects to wss://fstream.binance.com/stream for real-time market data
 * Supports kline streams and ticker streams with automatic reconnection
 */

import type { FuturesTickerData } from '@/types/api'

// WebSocket URL for Binance Futures combined streams
const WS_BASE_URL = 'wss://fstream.binance.com/stream'

// Default configuration
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10
const DEFAULT_RECONNECT_DELAY = 1000 // Base delay in ms
const DEFAULT_PING_INTERVAL = 30000 // 30 seconds

/**
 * WebSocket connection states
 */
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

/**
 * Kline data structure from WebSocket
 */
export interface KlineData {
  symbol: string
  interval: string
  kline: {
    openTime: number
    closeTime: number
    open: number
    high: number
    low: number
    close: number
    volume: number
    quoteVolume: number
    isFinal: boolean
  }
}

/**
 * WebSocket client options
 */
export interface WebSocketOptions {
  maxReconnectAttempts?: number
  reconnectDelay?: number
  pingInterval?: number
}

/**
 * Event handler function type
 */
type EventHandler = (...args: any[]) => void

/**
 * Binance Futures WebSocket Client
 */
export class BinanceFuturesWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number
  private reconnectDelay: number
  private pingInterval: number
  private pingTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private subscriptions: Set<string> = new Set()
  private eventHandlers: Map<string, EventHandler[]> = new Map()
  private connectionState: ConnectionState = 'disconnected'
  private tickerData: Map<string, FuturesTickerData> = new Map()

  constructor(options: WebSocketOptions = {}) {
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS
    this.reconnectDelay = options.reconnectDelay ?? DEFAULT_RECONNECT_DELAY
    this.pingInterval = options.pingInterval ?? DEFAULT_PING_INTERVAL
  }

  /**
   * Connect to Binance Futures WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.connectionState = 'connecting'
        console.log('🔌 Connecting to Binance Futures WebSocket...')

        // Create WebSocket connection
        this.ws = new WebSocket(WS_BASE_URL)

        // Connection opened
        this.ws.onopen = () => {
          console.log('✅ WebSocket connected')
          this.connectionState = 'connected'
          this.reconnectAttempts = 0
          this.startPingInterval()
          this.emit('connect')
          resolve()
        }

        // Message received
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error)
            this.emit('error', error)
          }
        }

        // Error occurred
        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          this.emit('error', error)
          reject(error)
        }

        // Connection closed
        this.ws.onclose = (event) => {
          console.warn('⚠️  WebSocket closed', { code: event.code, reason: event.reason })
          this.connectionState = 'disconnected'
          this.stopPingInterval()
          this.emit('close', event)
          this.handleReconnect()
        }
      } catch (error) {
        this.connectionState = 'disconnected'
        reject(error)
      }
    })
  }

  /**
   * Subscribe to streams
   * @param streams - Array of stream names (e.g., ["btcusdt@kline_5m", "!ticker@arr"])
   */
  async subscribe(streams: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }

    // Binance requires specific format for combined streams
    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now()
    }

    this.ws.send(JSON.stringify(subscribeMessage))

    // Store subscriptions for reconnection
    streams.forEach(stream => this.subscriptions.add(stream))

    console.log(`📡 Subscribed to ${streams.length} stream(s)`)
  }

  /**
   * Unsubscribe from streams
   * @param streams - Array of stream names to unsubscribe from
   */
  async unsubscribe(streams: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }

    const unsubscribeMessage = {
      method: 'UNSUBSCRIBE',
      params: streams,
      id: Date.now()
    }

    this.ws.send(JSON.stringify(unsubscribeMessage))

    // Remove from stored subscriptions
    streams.forEach(stream => this.subscriptions.delete(stream))

    console.log(`🔕 Unsubscribed from ${streams.length} stream(s)`)
  }

  /**
   * Subscribe to all market tickers stream (!ticker@arr)
   * Provides 24h statistics for all futures symbols
   */
  async subscribeTicker(): Promise<void> {
    await this.subscribe(['!ticker@arr'])
  }

  /**
   * Register event handler
   * @param event - Event name ('kline', 'ticker', 'error', 'close', 'reconnect', 'connect')
   * @param handler - Event handler function
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  /**
   * Unregister event handler
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...')
    
    this.stopPingInterval()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.connectionState = 'disconnected'
    this.subscriptions.clear()
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions)
  }

  /**
   * Get ticker data for a specific symbol
   * @param symbol - Trading symbol (e.g., "BTCUSDT")
   */
  getTickerData(symbol: string): FuturesTickerData | undefined {
    return this.tickerData.get(symbol)
  }

  /**
   * Get all ticker data
   */
  getAllTickerData(): FuturesTickerData[] {
    return Array.from(this.tickerData.values())
  }

  /**
   * Clear all stored ticker data
   */
  clearTickerData(): void {
    this.tickerData.clear()
  }

  /**
   * Emit event to registered handlers
   */
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args)
        } catch (error) {
          console.error(`❌ Error in ${event} handler:`, error)
        }
      })
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: any): void {
    // Handle subscription responses
    if (data.result === null && data.id) {
      console.log(`✅ Subscription confirmed: ID ${data.id}`)
      return
    }

    // Handle stream data
    if (data.stream && data.data) {
      const streamName = data.stream
      const eventData = data.data

      // Parse kline data
      if (streamName.includes('@kline_')) {
        const klineData: KlineData = {
          symbol: eventData.s,
          interval: eventData.k.i,
          kline: {
            openTime: eventData.k.t,
            closeTime: eventData.k.T,
            open: parseFloat(eventData.k.o),
            high: parseFloat(eventData.k.h),
            low: parseFloat(eventData.k.l),
            close: parseFloat(eventData.k.c),
            volume: parseFloat(eventData.k.v),
            quoteVolume: parseFloat(eventData.k.q),
            isFinal: eventData.k.x
          }
        }
        this.emit('kline', klineData)
      }

      // Parse ticker array data (!ticker@arr stream)
      if (streamName === '!ticker@arr') {
        // eventData is an array of ticker objects
        const tickers: FuturesTickerData[] = (eventData as any[]).map((ticker: any) => ({
          symbol: ticker.s,
          eventTime: ticker.E,
          close: parseFloat(ticker.c),
          open: parseFloat(ticker.o),
          high: parseFloat(ticker.h),
          low: parseFloat(ticker.l),
          volume: parseFloat(ticker.v),
          quoteVolume: parseFloat(ticker.q),
          priceChange: parseFloat(ticker.p),
          priceChangePercent: parseFloat(ticker.P),
          lastQty: parseFloat(ticker.Q),
          weightedAvgPrice: parseFloat(ticker.w),
          fundingRate: parseFloat(ticker.r || '0'),
          indexPrice: parseFloat(ticker.i || '0'),
          markPrice: parseFloat(ticker.m || ticker.c), // Fallback to close if mark price not available
          openInterest: parseFloat(ticker.n || '0')
        }))

        // Store ticker data in map for quick access
        tickers.forEach(ticker => {
          this.tickerData.set(ticker.symbol, ticker)
        })

        // Emit ticker event with array of all tickers
        this.emit('ticker', tickers)
      }
    }
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnect(): Promise<void> {
    // Check if max attempts reached
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached`)
      this.emit('maxReconnectReached')
      return
    }

    this.reconnectAttempts++
    this.connectionState = 'reconnecting'

    // Calculate exponential backoff delay
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    )

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect()

        // Resubscribe to all previous streams in batches
        if (this.subscriptions.size > 0) {
          const streams = Array.from(this.subscriptions)
          // Clear subscriptions temporarily to avoid duplication
          this.subscriptions.clear()
          
          // Subscribe in batches of 100 to avoid "Payload too long" error
          const BATCH_SIZE = 100
          for (let i = 0; i < streams.length; i += BATCH_SIZE) {
            const batch = streams.slice(i, i + BATCH_SIZE)
            await this.subscribe(batch)
            
            // Small delay between batches
            if (i + BATCH_SIZE < streams.length) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
        }

        this.emit('reconnect')
        console.log('✅ Reconnected successfully')
      } catch (error) {
        console.error('❌ Reconnection failed:', error)
        this.handleReconnect()
      }
    }, delay)
  }

  /**
   * Start ping/pong heartbeat
   */
  private startPingInterval(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // WebSocket ping (browser will handle pong automatically)
        try {
          this.ws.send(JSON.stringify({ method: 'ping' }))
        } catch (error) {
          console.error('❌ Failed to send ping:', error)
        }
      }
    }, this.pingInterval)
  }

  /**
   * Stop ping/pong heartbeat
   */
  private stopPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}
