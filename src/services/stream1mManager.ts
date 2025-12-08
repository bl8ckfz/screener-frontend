/**
 * Stream1mManager - Orchestrates 1m candle streaming with sliding windows
 * 
 * Architecture:
 * - Manages Candle1mRingBuffer instances per symbol (1440 capacity)
 * - Uses SlidingWindowCalculator for O(1) metric updates
 * - Backfills via BinanceFuturesApiClient (REST)
 * - Streams via BinanceFuturesWebSocket (WebSocket)
 * 
 * Flow:
 * 1. start() → Backfill 1440 1m candles via API
 * 2. Initialize ring buffers and running sums
 * 3. Subscribe to 1m kline WebSocket streams
 * 4. On new candle → Update buffer + sums → Emit metrics
 */

import { Candle1mRingBuffer } from '@/utils/candle1mRingBuffer'
import { SlidingWindowCalculator } from '@/utils/slidingWindowCalculator'
import { BinanceFuturesApiClient } from './binanceFuturesApi'
import { BinanceFuturesWebSocket } from './binanceFuturesWebSocket'
import type { Candle1m, WindowMetrics } from '@/types/api'

/**
 * Browser-compatible EventEmitter
 */
class SimpleEventEmitter {
  private handlers = new Map<string, Function[]>()

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler)
  }

  off(event: string, handler: Function): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(...args))
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
    }
  }
}

/**
 * Events emitted by Stream1mManager:
 * 
 * - 'started' → { symbols: number } - Streaming started successfully
 * - 'backfillProgress' → { completed: number, total: number, progress: number }
 * - 'metrics' → { symbol: string, metrics: AllTimeframeMetrics, timestamp: number }
 * - 'candle' → { symbol: string, candle: Candle1m, timestamp: number }
 * - 'error' → Error object
 * - 'stopped' → void
 */

export interface AllTimeframeMetrics {
  m5: WindowMetrics
  m15: WindowMetrics
  h1: WindowMetrics
  h8: WindowMetrics
  h24: WindowMetrics
}

export interface StartOptions {
  batchSize?: number // Backfill batch size (default: 10)
  batchDelay?: number // Delay between batches in ms (default: 1000)
  onProgress?: (completed: number, total: number) => void
}

/**
 * Manages 1m kline streaming with sliding window calculations
 */
export class Stream1mManager extends SimpleEventEmitter {
  private buffers: Map<string, Candle1mRingBuffer> = new Map()
  private calculator: SlidingWindowCalculator
  private wsClient: BinanceFuturesWebSocket
  private apiClient: BinanceFuturesApiClient
  private symbols: string[] = []
  private isRunning: boolean = false
  private initialTickers: any[] = [] // Store initial ticker data for immediate display

  constructor() {
    super()
    this.calculator = new SlidingWindowCalculator()
    this.wsClient = new BinanceFuturesWebSocket()
    this.apiClient = new BinanceFuturesApiClient()

    this.setupWebSocketHandlers()
  }

  /**
   * Parse REST API ticker data to match WebSocket format (convert strings to numbers)
   */
  private parseRestTicker(ticker: any): any {
    return {
      symbol: ticker.symbol,
      priceChange: parseFloat(ticker.priceChange || '0'),
      priceChangePercent: parseFloat(ticker.priceChangePercent || '0'),
      weightedAvgPrice: parseFloat(ticker.weightedAvgPrice || '0'),
      lastPrice: parseFloat(ticker.lastPrice || '0'),
      lastQty: parseFloat(ticker.lastQty || '0'),
      openPrice: parseFloat(ticker.openPrice || '0'),
      highPrice: parseFloat(ticker.highPrice || '0'),
      lowPrice: parseFloat(ticker.lowPrice || '0'),
      volume: parseFloat(ticker.volume || '0'),
      quoteVolume: parseFloat(ticker.quoteVolume || '0'),
      openTime: ticker.openTime,
      closeTime: ticker.closeTime,
      firstId: ticker.firstId,
      lastId: ticker.lastId,
      count: ticker.count,
    }
  }

  /**
   * Set initial ticker data for immediate display (before WebSocket connection)
   * Parses string values to numbers to match WebSocket format
   */
  setInitialTickers(tickers: any[]): void {
    // Parse all tickers to convert strings to numbers
    this.initialTickers = tickers.map(t => this.parseRestTicker(t))
    console.log(`📊 Stored ${this.initialTickers.length} initial tickers for immediate display`)
    
    // Emit event to trigger UI update
    this.emit('tickersReady', { count: this.initialTickers.length })
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    // Handle kline messages (1m closed candles)
    this.wsClient.on('kline', (data: any) => {
      try {
        // Validate data structure
        if (!data || !data.k) {
          return
        }

        const kline = data.k

        // Only process closed candles
        if (!kline.x) {
          return
        }

        const symbol = kline.s
        const candle: Candle1m = {
          openTime: kline.t,
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
          quoteVolume: parseFloat(kline.q),
        }

        this.handle1mKline(symbol, candle)
      } catch (error) {
        console.error('❌ Error in kline handler:', error)
      }
    })

    // Handle WebSocket errors
    this.wsClient.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error)
      this.emit('error', error)
    })

    // Handle reconnections
    this.wsClient.on('reconnect', () => {
      console.log('🔄 WebSocket reconnecting...')
    })

    this.wsClient.on('connect', () => {
      console.log('✅ WebSocket connected')
      
      // Resubscribe after reconnection
      if (this.isRunning && this.symbols.length > 0) {
        console.log('📡 Resubscribing to 1m kline streams...')
        this.wsClient.subscribe1mKlines(this.symbols).catch(error => {
          console.error('❌ Failed to resubscribe:', error)
        })
      }
    })

    // Handle ticker updates (for lastUpdate timestamp)
    this.wsClient.on('ticker', () => {
      // Emit ticker update event to keep UI fresh
      this.emit('tickerUpdate', { timestamp: Date.now() })
    })
  }

  /**
   * Start 1m streaming for given symbols
   * 
   * Steps:
   * 1. Backfill 1440 1m candles via API
   * 2. Initialize ring buffers and running sums
   * 3. Subscribe to 1m kline WebSocket streams
   * 4. Emit 'started' event
   * 
   * @param symbols - Array of Binance futures symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
   * @param options - Start options (batch size, delay, progress callback)
   */
  async start(symbols: string[], options: StartOptions = {}): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️  Stream already running')
      return
    }

    this.symbols = symbols
    console.log(`🚀 Starting 1m stream for ${symbols.length} symbols...`)

    try {
      // Step 1: Backfill historical 1m data
      console.log('📥 Backfilling 1m candles (1440 per symbol)...')
      const startTime = Date.now()

      const backfillResult = await this.apiClient.backfill1mCandles(symbols, {
        batchSize: options.batchSize || 10,
        batchDelay: options.batchDelay || 1000,
        onProgress: (completed, total) => {
          const progress = Math.round((completed / total) * 100)
          console.log(`📥 Backfill progress: ${completed}/${total} (${progress}%)`)
          this.emit('backfillProgress', { completed, total, progress })
          
          if (options.onProgress) {
            options.onProgress(completed, total)
          }
        },
      })

      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(
        `✅ Backfill complete: ${backfillResult.successful.length}/${symbols.length} in ${duration}s`
      )

      // Handle backfill failures
      if (backfillResult.failed.length > 0) {
        console.warn(`⚠️  Failed to backfill ${backfillResult.failed.length} symbols:`)
        backfillResult.failed.forEach(f => {
          console.warn(`  - ${f.symbol}: ${f.error}`)
        })
        console.warn(`📊 Success rate: ${backfillResult.successful.length}/${symbols.length} (${Math.round(backfillResult.successful.length / symbols.length * 100)}%)`)
      }

      // Step 2: Initialize buffers and running sums
      console.log('📦 Initializing ring buffers and running sums...')
      for (const symbol of backfillResult.successful) {
        const candles = backfillResult.data.get(symbol)
        if (!candles) {
          console.warn(`⚠️  No candles data for ${symbol}`)
          continue
        }

        const buffer = new Candle1mRingBuffer(symbol)

        // Initialize calculator
        this.calculator.initializeSymbol(symbol)

        // Fill buffer with historical candles
        for (const candle of candles) {
          const evicted = buffer.push(candle)
          this.calculator.addCandle(symbol, candle)
          
          // Handle evictions (shouldn't happen on initial fill)
          if (evicted) {
            this.calculator.removeCandle(symbol, evicted)
          }
        }

        this.buffers.set(symbol, buffer)
        console.log(`✅ ${symbol}: ${buffer.getFillPercentage().toFixed(0)}% filled`)
      }

      // Step 3: Connect WebSocket
      console.log('📡 Connecting to Binance Futures WebSocket...')
      await this.wsClient.connect()

      // Step 4: Subscribe to ticker stream (for live prices/volumes)
      console.log('📡 Subscribing to ticker stream...')
      await this.wsClient.subscribeTicker()

      // Update tracked symbols to only successful ones
      this.symbols = backfillResult.successful
      
      // Step 5: Subscribe to 1m kline streams
      console.log(`📡 Subscribing to ${backfillResult.successful.length} 1m kline streams...`)
      await this.wsClient.subscribe1mKlines(backfillResult.successful)

      this.isRunning = true
      console.log('✅ 1m streaming started!')
      console.log(`📊 Tracking ${this.symbols.length} symbols, ${this.buffers.size} buffers initialized`)

      this.emit('started', { symbols: backfillResult.successful.length })
    } catch (error) {
      console.error('❌ Failed to start 1m stream:', error)
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Handle incoming 1m kline from WebSocket
   * 
   * Flow:
   * 1. Push candle to ring buffer (may evict oldest)
   * 2. Update running sums (add new, subtract evicted)
   * 3. Calculate all timeframe metrics
   * 4. Emit 'candle' and 'metrics' events
   */
  private handle1mKline(symbol: string, candle: Candle1m): void {
    const buffer = this.buffers.get(symbol)

    if (!buffer) {
      console.warn(`⚠️  Received candle for untracked symbol: ${symbol}`)
      return
    }

    // Push to ring buffer (may evict oldest)
    const evicted = buffer.push(candle)

    // Update running sums
    this.calculator.addCandle(symbol, candle)
    if (evicted) {
      this.calculator.removeCandle(symbol, evicted)
    }

    // Emit candle event
    this.emit('candle', { symbol, candle, timestamp: Date.now() })

    // Calculate and emit metrics for all timeframes
    const metrics = this.getAllMetrics(symbol)
    if (metrics) {
      this.emit('metrics', { symbol, metrics, timestamp: Date.now() })
    }
  }

  /**
   * Get metrics for a specific symbol and window
   * 
   * @param symbol - Binance futures symbol
   * @param window - Window size in minutes (5, 15, 60, 480, 1440)
   * @returns Window metrics or null if not available
   */
  getMetrics(symbol: string, window: 5 | 15 | 60 | 480 | 1440): WindowMetrics | null {
    const buffer = this.buffers.get(symbol)
    if (!buffer) {
      return null
    }

    // Map window minutes to WindowSize enum
    const windowMap: Record<number, '5m' | '15m' | '1h' | '8h' | '1d'> = {
      5: '5m',
      15: '15m',
      60: '1h',
      480: '8h',
      1440: '1d',
    }

    return this.calculator.getMetrics(symbol, buffer, windowMap[window])
  }

  /**
   * Get metrics for all timeframes
   * 
   * @param symbol - Binance futures symbol
   * @returns All timeframe metrics or null if not available
   */
  getAllMetrics(symbol: string): AllTimeframeMetrics | null {
    const buffer = this.buffers.get(symbol)
    if (!buffer) {
      return null
    }

    const metricsMap = this.calculator.getAllMetrics(symbol, buffer)
    
    // Check if all required metrics are available
    const m5 = metricsMap.get('5m')
    const m15 = metricsMap.get('15m')
    const h1 = metricsMap.get('1h')
    const h8 = metricsMap.get('8h')
    const h24 = metricsMap.get('1d')
    
    if (!m5 || !m15 || !h1 || !h8 || !h24) {
      return null
    }

    return {
      m5,
      m15,
      h1,
      h8,
      h24,
    }
  }

  /**
   * Get current ring buffer for a symbol
   * 
   * @param symbol - Binance futures symbol
   * @returns Ring buffer or undefined if not found
   */
  getBuffer(symbol: string): Candle1mRingBuffer | undefined {
    return this.buffers.get(symbol)
  }

  /**
   * Get all tracked symbols
   */
  getSymbols(): string[] {
    return [...this.symbols]
  }

  /**
   * Get ticker data for a specific symbol
   * 
   * @param symbol - Binance futures symbol
   * @returns Ticker data or undefined if not available
   */
  getTickerData(symbol: string) {
    return this.wsClient.getTickerData(symbol)
  }

  /**
   * Get all ticker data from WebSocket stream
   * Filtered to only tracked symbols
   * 
   * Returns initial REST API data if WebSocket hasn't populated yet
   * 
   * @returns Array of ticker data for tracked symbols only
   */
  getAllTickerData() {
    const allTickers = this.wsClient.getAllTickerData()
    
    // If WebSocket hasn't received ticker data yet, use initial REST data
    if (allTickers.length === 0 && this.initialTickers.length > 0) {
      console.log(`📊 Using ${this.initialTickers.length} initial tickers (WebSocket not ready)`)
      return this.initialTickers
    }
    
    // Filter to only tracked symbols to avoid showing coins we don't have metrics for
    const trackedSymbols = new Set(this.symbols)
    const filtered = allTickers.filter(ticker => trackedSymbols.has(ticker.symbol))
    
    // Once WebSocket has data, clear initial tickers to save memory
    if (filtered.length > 0 && this.initialTickers.length > 0) {
      console.log(`✅ WebSocket ticker data available, clearing initial REST data`)
      this.initialTickers = []
    }
    
    // Debug: Log if mismatch
    if (filtered.length !== this.symbols.length && import.meta.env.DEV) {
      console.warn(`⚠️  Ticker data mismatch: ${filtered.length} tickers vs ${this.symbols.length} tracked symbols`)
      const missingSymbols = this.symbols.filter(s => !filtered.some(t => t.symbol === s))
      if (missingSymbols.length > 0) {
        console.warn(`Missing ticker data for: ${missingSymbols.join(', ')}`)
      }
    }
    
    return filtered
  }

  /**
   * Check if manager is running
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Stop 1m streaming
   * 
   * Steps:
   * 1. Disconnect WebSocket
   * 2. Clear buffers and running sums
   * 3. Emit 'stopped' event
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('⚠️  Stream not running')
      return
    }

    console.log('🛑 Stopping 1m stream...')

    try {
      // Disconnect WebSocket
      await this.wsClient.disconnect()

      // Clear buffers and running sums
      this.buffers.clear()
      this.calculator.clearAll()
      this.symbols = []
      this.isRunning = false

      console.log('✅ 1m stream stopped')
      this.emit('stopped')
    } catch (error) {
      console.error('❌ Failed to stop 1m stream:', error)
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Cleanup and remove all listeners
   */
  destroy(): void {
    this.stop().catch(error => {
      console.error('Failed to stop during destroy:', error)
    })
    this.removeAllListeners()
  }
}
