/**
 * WebSocket Stream Manager
 * 
 * Orchestrates the complete WebSocket streaming pipeline:
 * - Connects to Binance Futures WebSocket
 * - Manages subscriptions for kline and ticker streams
 * - Updates ring buffers with real-time data
 * - Calculates metrics via ChangeCalculator
 * - Emits events for UI updates
 */

import { BinanceFuturesWebSocket } from './binanceFuturesWebSocket'
import { RingBufferManager } from './ringBufferManager'
import { ChangeCalculator } from './changeCalculator'
import { BinanceFuturesApiClient } from './binanceFuturesApi'
import type { PartialChangeMetrics, WarmupStatus } from '@/types/metrics'
import type { FuturesTickerData } from '@/types/api'

/**
 * Simple browser-compatible EventEmitter
 * Replaces Node.js 'events' module for browser builds
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

interface WebSocketStreamManagerOptions {
  autoReconnect?: boolean
  batchSize?: number
  enableBackfill?: boolean
}

interface StreamStatus {
  connected: boolean
  subscribedStreams: number
  buffersReady: number
  lastKlineUpdate: number
  lastTickerUpdate: number
}

export class WebSocketStreamManager extends SimpleEventEmitter {
  private wsClient: BinanceFuturesWebSocket
  private bufferManager: RingBufferManager
  private changeCalculator: ChangeCalculator
  private apiClient: BinanceFuturesApiClient
  private symbols: string[] = []
  private tickerData: Map<string, FuturesTickerData> = new Map()
  private isRunning: boolean = false
  private lastKlineUpdate: number = 0
  private lastTickerUpdate: number = 0
  private options: Required<WebSocketStreamManagerOptions>

  constructor(options: WebSocketStreamManagerOptions = {}) {
    super()
    
    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      batchSize: options.batchSize ?? 100, // Reduced from 200 to avoid payload size limits
      enableBackfill: options.enableBackfill ?? true,
    }

    // Initialize components
    this.apiClient = new BinanceFuturesApiClient()
    this.bufferManager = new RingBufferManager(this.apiClient)
    this.changeCalculator = new ChangeCalculator(this.bufferManager)
    this.wsClient = new BinanceFuturesWebSocket({
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      pingInterval: 30000,
    })

    this.setupWebSocketHandlers()
  }

  /**
   * Get top N most liquid symbols based on 24h quote volume
   * Must be called BEFORE start() to connect and fetch tickers first
   * 
   * @param limit - Number of top symbols to return (default: 200)
   * @returns Array of symbols sorted by 24h volume (highest first)
   */
  async getTopLiquidSymbols(limit: number = 200): Promise<string[]> {
    // Connect to WebSocket
    console.log('📡 Connecting to Binance Futures WebSocket...')
    await this.wsClient.connect()

    // Subscribe to ticker stream
    console.log('📡 Subscribing to ticker stream...')
    await this.wsClient.subscribe(['!ticker@arr'])

    // Wait for first ticker batch
    console.log('⏳ Waiting for ticker data...')
    await this.waitForFirstTickers()

    // Sort by 24h quote volume (most liquid first)
    const allTickers = Array.from(this.tickerData.values())
    const sortedTickers = allTickers
      .filter(t => t.symbol.endsWith('USDT')) // Only USDT pairs
      .sort((a, b) => b.quoteVolume - a.quoteVolume) // Descending by volume
      .slice(0, limit)

    console.log(`📈 Selected ${sortedTickers.length} most liquid symbols`)
    console.log(`🔝 Top volumes: ${sortedTickers.slice(0, 5).map(t => `${t.symbol}:$${(t.quoteVolume / 1e9).toFixed(1)}B`).join(', ')}`)

    return sortedTickers.map(t => t.symbol)
  }

  /**
   * Initialize and start streaming
   * 
   * Flow:
   * 1. Connect WebSocket (instant) - SKIPPED if already connected via getTopLiquidSymbols
   * 2. Subscribe to ticker stream (market data in <1s) - SKIPPED if already subscribed
   * 3. Emit 'tickersReady' - UI can display data immediately
   * 4. Backfill historical data in background (for change calculations)
   * 5. Subscribe to kline streams (for real-time updates)
   * 
   * This approach provides instant market data while historical metrics load gradually.
   */
  async start(symbols: string[]): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️  Stream already running')
      return
    }

    // Binance limit: max 200 streams per WebSocket connection
    const MAX_STREAMS = 200
    if (symbols.length > MAX_STREAMS) {
      console.warn(`⚠️  Limiting to ${MAX_STREAMS} symbols (requested ${symbols.length}) due to Binance WebSocket limits`)
      symbols = symbols.slice(0, MAX_STREAMS)
    }

    this.symbols = symbols
    console.log(`🚀 Starting WebSocket stream for ${symbols.length} symbols...`)

    try {
      // Step 1: Connect to Binance Futures WebSocket (skip if already connected)
      const isAlreadyConnected = this.wsClient.getState() === 'connected'
      if (!isAlreadyConnected) {
        console.log('📡 Connecting to Binance Futures WebSocket...')
        await this.wsClient.connect()

        // Step 2: Subscribe to ticker stream IMMEDIATELY (get market data in <1s)
        console.log('📡 Subscribing to ticker stream...')
        await this.wsClient.subscribe(['!ticker@arr'])

        // Wait for first ticker batch (typically arrives within 1 second)
        console.log('⏳ Waiting for initial ticker data...')
        await this.waitForFirstTickers()
      } else {
        console.log('✅ Already connected to WebSocket with ticker data')
      }

      // Step 3: Notify UI that tickers are ready (users see data now!)
      console.log(`✅ Ticker data ready (${this.tickerData.size} symbols)`)
      this.emit('tickersReady', {
        symbols: this.tickerData.size,
        timestamp: Date.now(),
      })

      // Step 4: Initialize ring buffers (non-blocking)
      console.log('📦 Initializing ring buffers...')
      await this.bufferManager.initialize(symbols)

      // Step 5: Backfill historical data in background (if enabled)
      if (this.options.enableBackfill) {
        // Don't await - let it run in background
        this.backfillInBackground(symbols)
      }

      // Step 6: Subscribe to kline streams (for real-time updates)
      console.log(`📡 Subscribing to ${symbols.length} kline streams...`)
      await this.subscribeKlineStreams(symbols)

      this.isRunning = true
      console.log('✅ WebSocket streaming started!')
      
      this.emit('started', {
        symbols: symbols.length,
        backfillEnabled: this.options.enableBackfill,
      })

    } catch (error) {
      console.error('❌ Failed to start WebSocket stream:', error)
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Wait for first ticker batch to arrive (typically <1 second)
   */
  private async waitForFirstTickers(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for ticker data'))
      }, 5000) // 5s timeout

      const handler = () => {
        if (this.tickerData.size > 0) {
          clearTimeout(timeout)
          this.wsClient.off('ticker', handler)
          resolve()
        }
      }

      this.wsClient.on('ticker', handler)
    })
  }

  /**
   * Backfill historical data in background (non-blocking)
   */
  private async backfillInBackground(symbols: string[]): Promise<void> {
    console.log('📥 Starting background backfill...')
    const startTime = Date.now()
    
    try {
      const result = await this.bufferManager.backfillAll(symbols, {
        batchSize: 10,
        batchDelay: 1000, // 1s delay = 10 req/s = 600 req/min (safe under limit)
        onProgress: (completed, total) => {
          const progress = Math.round((completed / total) * 100)
          console.log(`📥 Backfill progress: ${completed}/${total} (${progress}%)`)
          this.emit('backfillProgress', { completed, total, progress })
        },
      })
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`✅ Backfill complete: ${result.successful.length}/${symbols.length} symbols in ${duration}s`)
      
      if (result.failed.length > 0) {
        console.warn(`⚠️  Failed to backfill ${result.failed.length} symbols:`, result.failed)
      }

      this.emit('backfillComplete', {
        successful: result.successful.length,
        failed: result.failed.length,
        duration,
      })
    } catch (error) {
      console.error('❌ Background backfill failed:', error)
      this.emit('backfillError', error)
    }
  }



  /**
   * Stop streaming and cleanup
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    console.log('🛑 Stopping WebSocket stream...')
    this.wsClient.disconnect()
    this.isRunning = false
    this.emit('stopped')
  }

  /**
   * Get current metrics for symbol
   */
  getMetrics(symbol: string): PartialChangeMetrics {
    return this.changeCalculator.getAllChanges(symbol)
  }

  /**
   * Get metrics for all symbols
   */
  getAllMetrics(): Map<string, PartialChangeMetrics> {
    return this.changeCalculator.getAllSymbolsChanges()
  }

  /**
   * Get current ticker data for symbol
   */
  getTickerData(symbol: string): FuturesTickerData | undefined {
    return this.tickerData.get(symbol)
  }

  /**
   * Get all ticker data (for coin list)
   */
  getAllTickerData(): FuturesTickerData[] {
    return Array.from(this.tickerData.values())
  }

  /**
   * Get warm-up status for all symbols
   */
  getWarmupStatus(): WarmupStatus {
    const totalSymbols = this.symbols.length
    const warmupStatus: WarmupStatus = {
      totalSymbols,
      timeframes: {
        '5m': { ready: 0, total: totalSymbols },
        '15m': { ready: 0, total: totalSymbols },
        '1h': { ready: 0, total: totalSymbols },
        '4h': { ready: 0, total: totalSymbols },
        '8h': { ready: 0, total: totalSymbols },
        '12h': { ready: 0, total: totalSymbols },
        '1d': { ready: 0, total: totalSymbols },
      },
      overallProgress: 0,
    }

    let totalProgress = 0

    for (const symbol of this.symbols) {
      const progress = this.bufferManager.getWarmupProgress(symbol)
      totalProgress += progress

      if (this.changeCalculator.isReady(symbol, '5m')) warmupStatus.timeframes['5m'].ready++
      if (this.changeCalculator.isReady(symbol, '15m')) warmupStatus.timeframes['15m'].ready++
      if (this.changeCalculator.isReady(symbol, '1h')) warmupStatus.timeframes['1h'].ready++
      if (this.changeCalculator.isReady(symbol, '4h')) warmupStatus.timeframes['4h'].ready++
      if (this.changeCalculator.isReady(symbol, '8h')) warmupStatus.timeframes['8h'].ready++
      if (this.changeCalculator.isReady(symbol, '12h')) warmupStatus.timeframes['12h'].ready++
      if (this.changeCalculator.isReady(symbol, '1d')) warmupStatus.timeframes['1d'].ready++
    }

    warmupStatus.overallProgress = totalSymbols > 0 ? totalProgress / totalSymbols : 0

    return warmupStatus
  }

  /**
   * Get connection status
   */
  getStatus(): StreamStatus {
    const status = this.bufferManager.getStatus()

    return {
      connected: this.wsClient.getState() === 'connected',
      subscribedStreams: this.symbols.length + 1, // kline streams + ticker stream
      buffersReady: status.fullyLoaded,
      lastKlineUpdate: this.lastKlineUpdate,
      lastTickerUpdate: this.lastTickerUpdate,
    }
  }

  /**
   * Subscribe to kline streams in batches
   */
  private async subscribeKlineStreams(symbols: string[]): Promise<void> {
    const streams = symbols.map(s => `${s.toLowerCase()}@kline_5m`)
    const batchSize = this.options.batchSize

    for (let i = 0; i < streams.length; i += batchSize) {
      const batch = streams.slice(i, i + batchSize)
      await this.wsClient.subscribe(batch)

      console.log(`📡 Subscribed to ${Math.min(i + batchSize, streams.length)}/${streams.length} kline streams`)

      // Small delay between batches to avoid overwhelming the server
      if (i + batchSize < streams.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    // Handle kline updates
    this.wsClient.on('kline', (data: any) => {
      this.handleKlineUpdate(data)
    })

    // Handle ticker updates
    this.wsClient.on('ticker', (tickers: FuturesTickerData[]) => {
      this.handleTickerBatch(tickers)
    })

    // Handle errors
    this.wsClient.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error)
      this.emit('error', error)
    })

    // Handle reconnection
    this.wsClient.on('reconnect', () => {
      console.log('✅ WebSocket reconnected')
      this.emit('reconnected')
    })

    // Handle connection close
    this.wsClient.on('close', () => {
      console.warn('⚠️  WebSocket connection closed')
      this.emit('disconnected')
    })

    // Handle max reconnect attempts reached
    this.wsClient.on('maxReconnectReached', () => {
      console.error('❌ Max reconnection attempts reached')
      this.isRunning = false
      this.emit('maxReconnectReached')
    })
  }

  /**
   * Handle kline update from WebSocket
   */
  private handleKlineUpdate(data: any): void {
    const { symbol, kline } = data

    // Only process completed candles (isFinal === true)
    if (!kline.isFinal) {
      return
    }

    try {
      // Update ring buffer
      this.bufferManager.updateCandle(symbol, {
        openTime: kline.openTime,
        closeTime: kline.closeTime,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        quoteVolume: kline.quoteVolume,
        isFinal: kline.isFinal,
      })

      // Calculate updated metrics
      const metrics = this.changeCalculator.getAllChanges(symbol)

      // Update timestamp
      this.lastKlineUpdate = Date.now()

      // Emit update event for UI/alerts
      this.emit('metricsUpdate', {
        symbol,
        metrics,
        timestamp: this.lastKlineUpdate,
      })

    } catch (error) {
      console.error(`❌ Failed to process kline update for ${symbol}:`, error)
      this.emit('error', error)
    }
  }

  /**
   * Handle ticker batch update from WebSocket
   */
  private handleTickerBatch(tickers: FuturesTickerData[]): void {
    try {
      // Update internal map with latest ticker data
      for (const ticker of tickers) {
        this.tickerData.set(ticker.symbol, ticker)
      }

      // Update timestamp
      this.lastTickerUpdate = Date.now()

      // Emit batch update for coin list and market summary
      this.emit('tickerUpdate', {
        tickers: Array.from(this.tickerData.values()),
        timestamp: this.lastTickerUpdate,
      })

    } catch (error) {
      console.error('❌ Failed to process ticker batch:', error)
      this.emit('error', error)
    }
  }
}
