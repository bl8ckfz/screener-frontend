# 1-Minute Sliding Windows Implementation Roadmap

## Executive Summary

**Goal**: Migrate from 5-minute to 1-minute kline intervals with efficient sliding window calculations for real-time multi-timeframe metrics.

**Approach**: Use 1m klines from Binance USDT-M Futures API with ring buffers and running sums for O(1) window updates.

**Benefits**:
- 🎯 **5x Faster Updates**: Metrics update every 1 minute vs 5 minutes
- 🎯 **Smoother Data**: 1440 data points per day vs 288
- 🎯 **Efficient Computation**: O(1) window updates using running sums
- 🎯 **Same Windows**: Support 5m, 15m, 1h, 8h, 24h timeframes
- 🎯 **Lower Latency**: Alert detection within 1 minute of market changes
- 🎯 **Better Precision**: More accurate change calculations

**Trade-offs**:
- 📊 **More Data**: 1440 candles × 200 symbols = 288,000 candles (vs 57,600)
- 💾 **Higher Memory**: ~32 MB ring buffers (vs 9.44 MB for 5m)
- 🔧 **More Complex**: Sliding window math vs simple array slicing
- 📡 **More Messages**: 200 WebSocket messages/minute (vs 40/minute)

**Timeline**: 5-7 days (30-40 hours)

---

## Architecture Overview

### Current (5m) vs Proposed (1m)

```
Current: 5m Klines
├─ Ring buffer: 288 candles × 200 symbols = 57,600 candles
├─ Memory: ~9.44 MB
├─ Update frequency: Every 5 minutes
├─ Window calculation: Array slicing (getLastN)
└─ Supported timeframes: 5m, 15m, 1h, 4h, 8h, 12h, 24h

Proposed: 1m Klines with Sliding Windows
├─ Ring buffer: 1440 candles × 200 symbols = 288,000 candles
├─ Memory: ~32 MB
├─ Update frequency: Every 1 minute
├─ Window calculation: Running sums (O(1) updates)
└─ Supported timeframes: 1m, 5m, 15m, 1h, 8h, 24h
```

---

## Data Structures

### 1. Enhanced Candle Structure

```typescript
/**
 * Minimal 1m candle data stored in ring buffer
 * Only essential fields to minimize memory footprint
 */
interface Candle1m {
  openTime: number       // Timestamp (ms)
  close: number          // Close price
  volume: number         // Base asset volume
  quoteVolume: number    // Quote asset volume (USDT)
}

// Memory per candle: 4 × 8 bytes = 32 bytes
// Memory per symbol: 1440 candles × 32 bytes = 46,080 bytes (~46 KB)
// Total memory: 200 symbols × 46 KB = 9,216 KB (~9 MB for candles only)
```

### 2. Running Sums per Symbol

```typescript
/**
 * Running sums for each window size
 * Updated incrementally on each 1m close
 */
interface RunningSums {
  // Base asset volume sums
  sumBase5: number      // Last 5 minutes (5 candles)
  sumBase15: number     // Last 15 minutes (15 candles)
  sumBase60: number     // Last 1 hour (60 candles)
  sumBase480: number    // Last 8 hours (480 candles)
  sumBase1440: number   // Last 24 hours (1440 candles)
  
  // Quote asset volume sums (USDT)
  sumQuote5: number
  sumQuote15: number
  sumQuote60: number
  sumQuote480: number
  sumQuote1440: number
}

// Memory per symbol: 10 × 8 bytes = 80 bytes
// Total memory: 200 symbols × 80 bytes = 16 KB (negligible)
```

### 3. Complete Symbol State

```typescript
/**
 * Per-symbol state for 1m sliding windows
 */
interface Symbol1mState {
  symbol: string
  buffer: Candle1m[]     // Ring buffer (max 1440 candles)
  head: number           // Write position (circular)
  count: number          // Number of filled slots (0-1440)
  runningSums: RunningSums
  lastUpdate: number     // Timestamp of last candle
}

// Total memory per symbol: ~46 KB + 80 bytes = ~46 KB
// Total memory: 200 symbols × 46 KB = ~9.2 MB (acceptable)
```

### 4. Window Metrics Output

```typescript
/**
 * Computed metrics for a specific timeframe window
 */
interface WindowMetrics {
  symbol: string
  windowMinutes: number          // Window size (5, 15, 60, 480, 1440)
  
  // Price changes
  priceChange: number            // Absolute price change
  priceChangePercent: number     // Percentage change
  
  // Volumes
  baseVolume: number             // Base asset volume in window
  quoteVolume: number            // Quote asset volume in window (USDT)
  
  // Window boundaries
  windowStartTime: number        // Oldest candle openTime
  windowEndTime: number          // Newest candle openTime
  startPrice: number             // Oldest candle close
  endPrice: number               // Newest candle close
}
```

---

## Implementation Plan

### Phase 1: Core Data Structures (Day 1-2, 8-12 hours)

#### Task 1.1: Create Candle1m Ring Buffer Class
**File**: `src/utils/candle1mRingBuffer.ts`

```typescript
/**
 * Circular buffer for 1m candles with O(1) append/access
 * More efficient than KlineRingBuffer for 1m data
 */
export class Candle1mRingBuffer {
  private buffer: Candle1m[]
  private head: number = 0
  private count: number = 0
  private readonly capacity = 1440  // 24 hours of 1m candles
  
  constructor(public readonly symbol: string) {
    this.buffer = new Array(this.capacity)
  }
  
  /**
   * Add new 1m candle (overwrites oldest if full)
   */
  push(candle: Candle1m): Candle1m | null {
    const evicted = this.count === this.capacity ? this.buffer[this.head] : null
    this.buffer[this.head] = candle
    this.head = (this.head + 1) % this.capacity
    if (this.count < this.capacity) this.count++
    return evicted
  }
  
  /**
   * Get candle at index i (0 = oldest, count-1 = newest)
   */
  get(i: number): Candle1m | null {
    if (i < 0 || i >= this.count) return null
    const pos = (this.head - this.count + i + this.capacity) % this.capacity
    return this.buffer[pos]
  }
  
  /**
   * Get newest candle
   */
  getNewest(): Candle1m | null {
    return this.count > 0 ? this.get(this.count - 1) : null
  }
  
  /**
   * Get oldest candle in window (n candles back)
   */
  getOldest(n: number): Candle1m | null {
    if (n > this.count) return null
    return this.get(this.count - n)
  }
  
  /**
   * Check if buffer has enough data for window
   */
  hasWindow(n: number): boolean {
    return this.count >= n
  }
  
  /**
   * Get current fill percentage
   */
  getFillPercentage(): number {
    return (this.count / this.capacity) * 100
  }
}
```

**Tests**: `tests/utils/candle1mRingBuffer.test.ts`
- ✅ Circular wrapping
- ✅ Eviction returns oldest
- ✅ Index access correctness
- ✅ Window availability checks

---

#### Task 1.2: Create Sliding Window Calculator
**File**: `src/services/slidingWindowCalculator.ts`

```typescript
/**
 * Efficient sliding window calculator using running sums
 * Updates in O(1) time per candle
 */
export class SlidingWindowCalculator {
  private runningSums: Map<string, RunningSums> = new Map()
  
  // Window sizes in minutes (mapped to number of 1m candles)
  private readonly WINDOWS = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '8h': 480,
    '1d': 1440,
  } as const
  
  /**
   * Initialize running sums for a symbol
   */
  initializeSymbol(symbol: string): void {
    this.runningSums.set(symbol, {
      sumBase5: 0,
      sumBase15: 0,
      sumBase60: 0,
      sumBase480: 0,
      sumBase1440: 0,
      sumQuote5: 0,
      sumQuote15: 0,
      sumQuote60: 0,
      sumQuote480: 0,
      sumQuote1440: 0,
    })
  }
  
  /**
   * Update running sums when new candle arrives
   * 
   * @param symbol - Symbol to update
   * @param newCandle - New candle entering the window
   * @param buffer - Ring buffer to check for evicted candles
   */
  updateSums(
    symbol: string,
    newCandle: Candle1m,
    buffer: Candle1mRingBuffer
  ): void {
    const sums = this.runningSums.get(symbol)
    if (!sums) return
    
    // For each window size, update running sums
    const windows = [
      { size: 5, baseKey: 'sumBase5', quoteKey: 'sumQuote5' },
      { size: 15, baseKey: 'sumBase15', quoteKey: 'sumQuote15' },
      { size: 60, baseKey: 'sumBase60', quoteKey: 'sumQuote60' },
      { size: 480, baseKey: 'sumBase480', quoteKey: 'sumQuote480' },
      { size: 1440, baseKey: 'sumBase1440', quoteKey: 'sumQuote1440' },
    ] as const
    
    for (const window of windows) {
      // Add new candle
      sums[window.baseKey] += newCandle.volume
      sums[window.quoteKey] += newCandle.quoteVolume
      
      // Subtract evicted candle if window is full
      if (buffer.hasWindow(window.size)) {
        const evicted = buffer.getOldest(window.size + 1) // Candle leaving window
        if (evicted) {
          sums[window.baseKey] -= evicted.volume
          sums[window.quoteKey] -= evicted.quoteVolume
        }
      }
    }
  }
  
  /**
   * Calculate metrics for a specific window
   * 
   * @param symbol - Symbol to calculate
   * @param windowMinutes - Window size (5, 15, 60, 480, 1440)
   * @param buffer - Ring buffer with candle data
   * @returns Window metrics or null if insufficient data
   */
  getWindowMetrics(
    symbol: string,
    windowMinutes: 5 | 15 | 60 | 480 | 1440,
    buffer: Candle1mRingBuffer
  ): WindowMetrics | null {
    const n = windowMinutes // Number of candles needed
    
    if (!buffer.hasWindow(n)) {
      return null // Insufficient data
    }
    
    const sums = this.runningSums.get(symbol)
    if (!sums) return null
    
    // Get boundary candles
    const newest = buffer.getNewest()
    const oldest = buffer.getOldest(n)
    
    if (!newest || !oldest) return null
    
    // Calculate price change
    const startPrice = oldest.close
    const endPrice = newest.close
    const priceChange = endPrice - startPrice
    const priceChangePercent = (priceChange / startPrice) * 100
    
    // Get volumes from running sums
    const sumKeys = {
      5: { base: 'sumBase5', quote: 'sumQuote5' },
      15: { base: 'sumBase15', quote: 'sumQuote15' },
      60: { base: 'sumBase60', quote: 'sumQuote60' },
      480: { base: 'sumBase480', quote: 'sumQuote480' },
      1440: { base: 'sumBase1440', quote: 'sumQuote1440' },
    } as const
    
    const keys = sumKeys[windowMinutes]
    
    return {
      symbol,
      windowMinutes,
      priceChange,
      priceChangePercent,
      baseVolume: sums[keys.base],
      quoteVolume: sums[keys.quote],
      windowStartTime: oldest.openTime,
      windowEndTime: newest.openTime,
      startPrice,
      endPrice,
    }
  }
  
  /**
   * Get metrics for all timeframes at once
   */
  getAllWindowMetrics(
    symbol: string,
    buffer: Candle1mRingBuffer
  ): Map<number, WindowMetrics> {
    const results = new Map<number, WindowMetrics>()
    const windows = [5, 15, 60, 480, 1440] as const
    
    for (const windowMinutes of windows) {
      const metrics = this.getWindowMetrics(symbol, windowMinutes, buffer)
      if (metrics) {
        results.set(windowMinutes, metrics)
      }
    }
    
    return results
  }
}
```

**Tests**: `tests/services/slidingWindowCalculator.test.ts`
- ✅ Running sum updates
- ✅ Window eviction handling
- ✅ Price change calculations
- ✅ Volume aggregations
- ✅ Edge cases (insufficient data, empty buffers)

---

### Phase 2: API Integration (Day 2-3, 8-10 hours)

#### Task 2.1: Extend Binance Futures API Client
**File**: `src/services/binanceFuturesApi.ts`

Add methods for 1m klines:

```typescript
export class BinanceFuturesApiClient {
  // ... existing code ...
  
  /**
   * Fetch 1m klines for backfill (1 day = 1440 candles)
   * 
   * @param symbol - Binance futures symbol (e.g., 'BTCUSDT')
   * @param limit - Number of candles (default: 1440 for 24h)
   * @returns Array of 1m candles
   */
  async fetch1mKlines(
    symbol: string,
    limit: number = 1440
  ): Promise<Candle1m[]> {
    const url = `${this.baseUrl}/fapi/v1/klines`
    const params = {
      symbol,
      interval: '1m',
      limit: Math.min(limit, 1500), // Binance max per request
    }
    
    try {
      const response = await this.fetchWithRetry(url, params)
      
      return response.map((kline: any[]) => ({
        openTime: kline[0],
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        quoteVolume: parseFloat(kline[7]),
      }))
    } catch (error) {
      console.error(`Failed to fetch 1m klines for ${symbol}:`, error)
      throw error
    }
  }
  
  /**
   * Backfill 1m candles for multiple symbols (batched)
   * 
   * @param symbols - Array of symbols to backfill
   * @param options - Backfill options
   * @returns Backfill results
   */
  async backfill1mCandles(
    symbols: string[],
    options: {
      batchSize?: number
      batchDelay?: number
      onProgress?: (completed: number, total: number) => void
    } = {}
  ): Promise<{
    successful: string[]
    failed: string[]
    data: Map<string, Candle1m[]>
  }> {
    const batchSize = options.batchSize ?? 10
    const batchDelay = options.batchDelay ?? 1000
    
    const results = {
      successful: [] as string[],
      failed: [] as string[],
      data: new Map<string, Candle1m[]>(),
    }
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (symbol) => {
        try {
          const candles = await this.fetch1mKlines(symbol)
          results.data.set(symbol, candles)
          results.successful.push(symbol)
        } catch (error) {
          console.error(`Failed to backfill ${symbol}:`, error)
          results.failed.push(symbol)
        }
      })
      
      await Promise.all(batchPromises)
      
      if (options.onProgress) {
        options.onProgress(Math.min(i + batchSize, symbols.length), symbols.length)
      }
      
      // Rate limiting delay
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelay))
      }
    }
    
    return results
  }
}
```

---

#### Task 2.2: Update WebSocket Client for 1m Streams
**File**: `src/services/binanceFuturesWebSocket.ts`

Update kline handler to support 1m interval:

```typescript
export class BinanceFuturesWebSocket {
  // ... existing code ...
  
  /**
   * Subscribe to 1m kline streams for symbols
   * 
   * @param symbols - Array of symbols to subscribe
   */
  async subscribe1mKlines(symbols: string[]): Promise<void> {
    const streams = symbols.map(s => `${s.toLowerCase()}@kline_1m`)
    await this.subscribe(streams)
  }
  
  /**
   * Parse 1m kline from WebSocket message
   */
  private parse1mKline(data: any): { symbol: string; candle: Candle1m } | null {
    const kline = data.k
    
    // Only process closed candles
    if (!kline.x) {
      return null
    }
    
    return {
      symbol: kline.s,
      candle: {
        openTime: kline.t,
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v),
        quoteVolume: parseFloat(kline.q),
      },
    }
  }
}
```

---

### Phase 3: Stream Manager Update (Day 3-4, 8-10 hours)

#### Task 3.1: Create 1m Stream Manager
**File**: `src/services/stream1mManager.ts`

```typescript
/**
 * Manages 1m kline streams with sliding window calculations
 * Orchestrates ring buffers, running sums, and metric calculations
 */
export class Stream1mManager extends SimpleEventEmitter {
  private buffers: Map<string, Candle1mRingBuffer> = new Map()
  private calculator: SlidingWindowCalculator
  private wsClient: BinanceFuturesWebSocket
  private apiClient: BinanceFuturesApiClient
  private symbols: string[] = []
  private isRunning: boolean = false
  
  constructor() {
    super()
    this.calculator = new SlidingWindowCalculator()
    this.wsClient = new BinanceFuturesWebSocket()
    this.apiClient = new BinanceFuturesApiClient()
    
    this.setupWebSocketHandlers()
  }
  
  /**
   * Initialize and start 1m streaming
   * 
   * Flow:
   * 1. Backfill 1440 candles per symbol (REST)
   * 2. Initialize ring buffers and running sums
   * 3. Subscribe to 1m kline WebSocket streams
   * 4. Process closed candles and update windows
   */
  async start(symbols: string[]): Promise<void> {
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
        batchSize: 10,
        batchDelay: 1000,
        onProgress: (completed, total) => {
          const progress = Math.round((completed / total) * 100)
          console.log(`📥 Backfill progress: ${completed}/${total} (${progress}%)`)
          this.emit('backfillProgress', { completed, total, progress })
        },
      })
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`✅ Backfill complete: ${backfillResult.successful.length}/${symbols.length} in ${duration}s`)
      
      // Step 2: Initialize buffers and running sums
      console.log('📦 Initializing ring buffers and running sums...')
      for (const symbol of backfillResult.successful) {
        const buffer = new Candle1mRingBuffer(symbol)
        const candles = backfillResult.data.get(symbol)!
        
        // Initialize calculator
        this.calculator.initializeSymbol(symbol)
        
        // Fill buffer with historical candles
        for (const candle of candles) {
          buffer.push(candle)
          this.calculator.updateSums(symbol, candle, buffer)
        }
        
        this.buffers.set(symbol, buffer)
        console.log(`✅ ${symbol}: ${buffer.getFillPercentage().toFixed(0)}% filled`)
      }
      
      // Step 3: Connect WebSocket
      console.log('📡 Connecting to Binance Futures WebSocket...')
      await this.wsClient.connect()
      
      // Step 4: Subscribe to 1m kline streams
      console.log(`📡 Subscribing to ${symbols.length} 1m kline streams...`)
      await this.wsClient.subscribe1mKlines(backfillResult.successful)
      
      this.isRunning = true
      console.log('✅ 1m streaming started!')
      
      this.emit('started', { symbols: symbols.length })
      
    } catch (error) {
      console.error('❌ Failed to start 1m stream:', error)
      this.emit('error', error)
      throw error
    }
  }
  
  /**
   * Handle incoming 1m kline from WebSocket
   */
  private handle1mKline(symbol: string, candle: Candle1m): void {
    const buffer = this.buffers.get(symbol)
    if (!buffer) return
    
    // Append candle to ring buffer
    buffer.push(candle)
    
    // Update running sums
    this.calculator.updateSums(symbol, candle, buffer)
    
    // Calculate all window metrics
    const allMetrics = this.calculator.getAllWindowMetrics(symbol, buffer)
    
    // Emit update event (for UI and alerts)
    this.emit('metricsUpdate', {
      symbol,
      timestamp: candle.openTime,
      metrics: allMetrics,
    })
    
    // Evaluate alerts (async, non-blocking)
    this.evaluateAlerts(symbol, allMetrics)
  }
  
  /**
   * Evaluate alerts for symbol (async, non-blocking)
   * Called on every 1m close
   */
  private evaluateAlerts(
    symbol: string,
    metrics: Map<number, WindowMetrics>
  ): void {
    // Enqueue alert evaluation (returns immediately, doesn't block WebSocket)
    this.alertQueue.enqueue(symbol, metrics)
  }
  
  /**
   * Alert queue for non-blocking evaluation
   */
  private alertQueue = new AlertQueue()
  
  /**
   * Get metrics for specific symbol and window
   */
  getMetrics(symbol: string, windowMinutes: 5 | 15 | 60 | 480 | 1440): WindowMetrics | null {
    const buffer = this.buffers.get(symbol)
    if (!buffer) return null
    
    return this.calculator.getWindowMetrics(symbol, windowMinutes, buffer)
  }
  
  /**
   * Get all metrics for symbol
   */
  getAllMetrics(symbol: string): Map<number, WindowMetrics> | null {
    const buffer = this.buffers.get(symbol)
    if (!buffer) return null
    
    return this.calculator.getAllWindowMetrics(symbol, buffer)
  }
  
  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    this.wsClient.on('kline', (data: any) => {
      const parsed = this.wsClient['parse1mKline'](data)
      if (parsed) {
        this.handle1mKline(parsed.symbol, parsed.candle)
      }
    })
    
    this.wsClient.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error)
      this.emit('error', error)
    })
  }
  
  /**
   * Stop streaming and cleanup
   */
  stop(): void {
    if (!this.isRunning) return
    
    console.log('🛑 Stopping 1m stream...')
    this.wsClient.disconnect()
    this.isRunning = false
    this.emit('stopped')
  }
}
```

---

### Phase 4: Integration & Migration (Day 4-5, 6-8 hours)

#### Task 4.1: Replace Futures Metrics Service
**File**: `src/services/futuresMetricsService.ts`

Complete replacement - no backward compatibility:

```typescript
export class FuturesMetricsService {
  private stream1mManager: Stream1mManager
  private coinGeckoClient: CoinGeckoApiClient
  
  constructor(coinGeckoClient?: CoinGeckoApiClient) {
    this.stream1mManager = new Stream1mManager()
    this.coinGeckoClient = coinGeckoClient || new CoinGeckoApiClient()
    console.log('🎯 Using 1m streaming (replaced 5m system)')
  }
  
  async initialize(symbols?: string[]): Promise<void> {
    // Direct delegation to 1m manager
    return this.stream1mManager.start(symbols!)
  }
  
  onMetricsUpdate(handler: (data: any) => void): () => void {
    return this.stream1mManager.on('metricsUpdate', handler)
  }
  
  // All methods delegate directly to stream1mManager
  // No conditional logic or feature flags
}
```

**Migration steps**:
1. Delete `webSocketStreamManager.ts` and related 5m files
2. Delete `ringBufferManager.ts` (replaced by `candle1mRingBuffer.ts`)
3. Delete `changeCalculator.ts` (replaced by `slidingWindowCalculator.ts`)
4. Update all imports to use new 1m classes

#### Task 4.2: Update useFuturesStreaming Hook
**File**: `src/hooks/useFuturesStreaming.ts`

Add compatibility layer for 1m metrics:

```typescript
export function useFuturesStreaming() {
  // Existing state...
  
  // Convert 1m WindowMetrics to existing FuturesMetrics format
  const convertWindowMetrics = useCallback((
    metricsMap: Map<number, WindowMetrics>
  ): PartialChangeMetrics => {
    const m5 = metricsMap.get(5)
    const m15 = metricsMap.get(15)
    const m60 = metricsMap.get(60)
    const m480 = metricsMap.get(480)
    const m1440 = metricsMap.get(1440)
    
    return {
      symbol: m5?.symbol || '',
      timestamp: m5?.windowEndTime || Date.now(),
      change_5m: m5?.priceChangePercent ?? null,
      change_15m: m15?.priceChangePercent ?? null,
      change_1h: m60?.priceChangePercent ?? null,
      change_8h: m480?.priceChangePercent ?? null,
      change_1d: m1440?.priceChangePercent ?? null,
      quoteVolume_5m: m5?.quoteVolume ?? null,
      quoteVolume_15m: m15?.quoteVolume ?? null,
      quoteVolume_1h: m60?.quoteVolume ?? null,
      quoteVolume_8h: m480?.quoteVolume ?? null,
      quoteVolume_1d: m1440?.quoteVolume ?? null,
      // ... other fields
    }
  }, [])
  
  // Rest of hook remains compatible...
}
```

---

### Phase 5: Alert Integration (Day 5-6, 4-6 hours)

#### Task 5.1: Update Alert Engine for 1m Metrics
**File**: `src/services/alertEngine.ts`

```typescript
export class AlertEngine {
  // ... existing code ...
  
  /**
   * Evaluate alerts using 1m window metrics
   * Called on each 1m close (non-blocking)
   */
  evaluateAlertsFrom1m(
    symbol: string,
    metrics: Map<number, WindowMetrics>
  ): void {
    // Convert to existing format
    const futuresMetrics = this.convertWindowMetrics(symbol, metrics)
    
    // Use existing alert evaluation logic
    this.evaluateAlerts(symbol, futuresMetrics)
  }
  
  private convertWindowMetrics(
    symbol: string,
    metricsMap: Map<number, WindowMetrics>
  ): FuturesMetrics {
    // Same conversion as in hook
    // ... implementation ...
  }
}
```

#### Task 5.2: Async Alert Queue
**File**: `src/services/alertQueue.ts`

```typescript
/**
 * Non-blocking alert evaluation queue
 * Prevents I/O from blocking WebSocket message processing
 */
export class AlertQueue {
  private queue: Array<{ symbol: string; metrics: Map<number, WindowMetrics> }> = []
  private processing: boolean = false
  
  /**
   * Enqueue alert evaluation (non-blocking)
   */
  enqueue(symbol: string, metrics: Map<number, WindowMetrics>): void {
    this.queue.push({ symbol, metrics })
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue()
    }
  }
  
  /**
   * Process queued alerts asynchronously
   */
  private async processQueue(): Promise<void> {
    this.processing = true
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      
      try {
        // Evaluate alerts (potentially async with I/O)
        await this.evaluateAlerts(item.symbol, item.metrics)
      } catch (error) {
        console.error(`Alert evaluation failed for ${item.symbol}:`, error)
      }
    }
    
    this.processing = false
  }
  
  private async evaluateAlerts(
    symbol: string,
    metrics: Map<number, WindowMetrics>
  ): Promise<void> {
    // Integration with AlertEngine
    // ... implementation ...
  }
}
```

---

### Phase 6: Testing & Optimization (Day 6-7, 6-8 hours)

#### Task 6.1: Unit Tests

**Files**:
- `tests/utils/candle1mRingBuffer.test.ts`
- `tests/services/slidingWindowCalculator.test.ts`
- `tests/services/stream1mManager.test.ts`

**Coverage targets**:
- ✅ Ring buffer operations
- ✅ Sliding window calculations
- ✅ Running sum accuracy
- ✅ Edge cases (empty buffers, single candle, etc.)
- ✅ Performance benchmarks

#### Task 6.2: Integration Tests

**File**: `tests/integration/stream1mPipeline.test.ts`

```typescript
describe('1m Streaming Pipeline', () => {
  it('should backfill and start streaming', async () => {
    // Test full initialization flow
  })
  
  it('should update metrics on each 1m close', async () => {
    // Test WebSocket message processing
  })
  
  it('should maintain running sum accuracy', async () => {
    // Compare running sums vs manual calculation
  })
  
  it('should handle symbol with partial data', async () => {
    // Test warm-up scenarios
  })
})
```

#### Task 6.3: Performance Benchmarks

**Metrics to measure**:
- ✅ Memory usage (target: <50 MB for 200 symbols)
- ✅ Update latency (target: <5ms per candle)
- ✅ Running sum accuracy (compare with array slicing)
- ✅ Backfill speed (target: <90s for 200 symbols)

---

## Memory & Performance Analysis

### Memory Footprint

```
Per symbol:
├─ Ring buffer: 1440 candles × 32 bytes = 46,080 bytes (~46 KB)
├─ Running sums: 10 numbers × 8 bytes = 80 bytes
└─ Total per symbol: ~46 KB

Total for 200 symbols:
├─ Buffers: 200 × 46 KB = 9,200 KB (~9 MB)
├─ Running sums: 200 × 80 bytes = 16 KB
├─ Overhead (objects, maps): ~2 MB
└─ Total memory: ~11-12 MB (acceptable)

Comparison with 5m:
├─ 5m system: ~9.44 MB
├─ 1m system: ~11-12 MB
└─ Increase: ~20% (acceptable for 5x update frequency)
```

### Computational Complexity

```
5m System (Array Slicing):
├─ Per update: O(n) where n = window size
├─ Example: 1h window = iterate 12 candles = 12 operations
└─ Total per symbol: O(n) × 5 windows = ~100 operations

1m System (Running Sums):
├─ Per update: O(1) regardless of window size
├─ Operations: Add new + subtract old = 2 operations per window
├─ Total per symbol: 2 × 10 windows = 20 operations
└─ Speedup: 5x faster per update

WebSocket Message Rate:
├─ 5m: 200 symbols / 5 minutes = 40 messages/minute
├─ 1m: 200 symbols / 1 minute = 200 messages/minute
└─ Increase: 5x more messages (still manageable)
```

### Backfill Comparison

```
5m Backfill:
├─ Per symbol: 288 candles
├─ Total: 200 × 288 = 57,600 API calls
└─ Duration: ~60 seconds

1m Backfill:
├─ Per symbol: 1440 candles (5x more)
├─ Total: 200 × 1440 = 288,000 API calls
├─ But: Same number of HTTP requests (200)
└─ Duration: ~60-90 seconds (similar, just more data per request)
```

---

## Git Tag & Emergency Rollback

### Create Stable Checkpoint

```bash
# Before starting migration, tag current stable version
git tag -a v5m-stable -m "Stable 5m streaming before 1m migration"
git push origin v5m-stable

# Proceed with migration on main branch
# No feature flags - complete replacement
```

### Emergency Rollback (if needed)

```bash
# If critical issues discovered post-deployment
git revert <commit-hash>  # Revert to v5m-stable
npm install
npm run build
# Deploy reverted version
```

### Migration Path (No Backward Compatibility)

```
Phase 1: Pre-Migration (Day 0)
├─ Create git tag: v5m-stable (emergency rollback point)
├─ Backup production data if needed
└─ Notify users of upcoming upgrade

Phase 2: Implementation (Days 1-7)
├─ Remove 5m system entirely
├─ Implement 1m system as replacement
├─ No feature flag - direct replacement
└─ Test thoroughly in development

Phase 3: Deployment (Day 7)
├─ Deploy to production (single cutover)
├─ Monitor metrics closely for 48h
├─ Alert on memory/performance anomalies
└─ If critical issues: git revert to v5m-stable

Phase 4: Stabilization (Days 8-14)
├─ Monitor user feedback
├─ Fix any discovered issues
└─ Remove all 5m-related code once stable
```

---

## API Surface

### Public Methods

```typescript
// Get metrics for specific window
getMetrics(symbol: string, windowMinutes: 5 | 15 | 60 | 480 | 1440): WindowMetrics | null

// Get all window metrics for symbol
getAllMetrics(symbol: string): Map<number, WindowMetrics> | null

// Get current fill status
getWarmupStatus(): {
  totalSymbols: number
  fullyLoaded: number
  percentComplete: number
}

// Subscribe to updates
onMetricsUpdate(handler: (data: {
  symbol: string
  timestamp: number
  metrics: Map<number, WindowMetrics>
}) => void): () => void
```

---

## Migration Checklist

### Pre-Migration
- [ ] All unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Memory usage acceptable (<50 MB)
- [ ] Documentation updated
- [ ] Create git tag: `v5m-stable`
- [ ] Backup production data (optional)

### Migration Day
- [ ] Delete old 5m system files completely
- [ ] Deploy 1m system to production (single cutover)
- [ ] Monitor error rates closely (first 2 hours critical)
- [ ] Monitor memory usage (<50 MB target)
- [ ] Monitor alert latency (<60s target)
- [ ] Verify all 200 symbols streaming correctly

### Post-Migration (48h)
- [ ] Monitor WebSocket stability (reconnections, message rate)
- [ ] Verify running sum accuracy (spot check vs manual)
- [ ] Check for memory leaks (24h uptime test)
- [ ] User feedback on faster updates
- [ ] If critical issues: revert to v5m-stable immediately
- [ ] If stable: consider tag successful, continue monitoring

---

## Open Questions & Decisions

### Q1: Should we keep 5m system as fallback?
**Decision**: ✅ No backward compatibility - create git tag only
**Rationale**: Clean migration, simpler codebase. Tag `v5m-stable` before migration for emergency rollback if needed.

### Q2: How to handle symbols with <1440 candles?
**Decision**: ✅ Match existing backfill behavior - return null for unavailable windows
**Rationale**: Consistent UX with current system, gradual warm-up displayed in UI

### Q3: Should running sums use Kahan summation for precision?
**Decision**: ✅ Standard floating point sufficient, but careful with precision
**Rationale**: Crypto volumes are large enough that standard float64 precision (~15 digits) is adequate. Monitor for drift but don't over-engineer.

**Implementation notes**:
- Use `number` type (64-bit float) for all sums
- Avoid mixing very large and very small numbers in same operation
- Test precision with real data: compare running sums vs array sum after 1440 updates
- If drift >0.01% detected in testing, implement Kahan summation at that point
- Expected precision: volume sums accurate to ~$0.01 even for $1B+ windows

### Q4: Handle WebSocket disconnections during backfill?
**Decision**: Store last processed timestamp, resume from there
**Rationale**: Prevents data gaps on reconnection

### Q5: Alert evaluation frequency?
**Decision**: ✅ Every 1m close, non-blocking with async queue
**Rationale**: Faster alerts (60s vs 300s latency) without impacting stream processing performance. Queue ensures I/O doesn't block WebSocket message handler.

---

## Success Metrics

### Performance
- ✅ Update latency: <5ms per candle
- ✅ Memory usage: <50 MB for 200 symbols
- ✅ Backfill time: <90 seconds
- ✅ Zero data gaps over 24h period

### Accuracy
- ✅ Running sum accuracy: Within 0.01% of array slicing
- ✅ Price change calculations: Exact match with 5m system
- ✅ Volume aggregations: No drift over 24h period

### User Experience
- ✅ Alert latency: Average <60 seconds (vs <300s with 5m)
- ✅ UI update frequency: Every 60 seconds (vs 300s)
- ✅ No visible performance degradation

---

## Appendix: Math Validation

### Running Sum Correctness

```
Given window size W and ring buffer B of size N:

At time t:
- sumW(t) = Σ(i=t-W+1 to t) volume[i]

At time t+1 (new candle arrives):
- sumW(t+1) = Σ(i=t-W+2 to t+1) volume[i]
- sumW(t+1) = sumW(t) - volume[t-W+1] + volume[t+1]
- This is O(1) vs O(W) for recomputing sum

Proof of correctness:
- Σ(i=t-W+2 to t+1) = Σ(i=t-W+1 to t) - volume[t-W+1] + volume[t+1]
- Both sides evaluate to same result
- No accumulation error if using same precision throughout
```

### Price Change Formula

```
Given:
- P_start = oldest.close (price at window start)
- P_end = newest.close (price at window end)

Price change:
- Absolute: ΔP = P_end - P_start
- Percent: ΔP% = (ΔP / P_start) × 100

Example:
- P_start = 50000
- P_end = 51000
- ΔP = 1000
- ΔP% = (1000 / 50000) × 100 = 2%
```

---

## Timeline Summary

| Phase | Duration | Tasks | Deliverables |
|-------|----------|-------|--------------|
| 1. Data Structures | 1-2 days | Ring buffer, calculator | Core classes with tests |
| 2. API Integration | 1 day | REST + WebSocket | 1m data fetching |
| 3. Stream Manager | 1-2 days | Orchestration | Complete pipeline |
| 4. Integration | 1 day | Service updates | Feature flag ready |
| 5. Alerts | 1 day | Alert engine update | Async queue |
| 6. Testing | 1-2 days | Unit + integration | >80% coverage |
| **Total** | **5-7 days** | **~40 hours** | **Production-ready** |

---

## Implementation Status

### ✅ Completed Phases

#### Phase 1-3: Core Infrastructure (COMPLETE)
- ✅ Candle1mRingBuffer with circular buffer (1440 capacity)
- ✅ SlidingWindowCalculator with O(1) running sums
- ✅ Stream1mManager orchestration layer
- ✅ BinanceFuturesWebSocket with ticker + kline support
- ✅ All unit tests passing (24/24 for stream1mManager)

#### Phase 4: Integration & Migration (COMPLETE)
- ✅ Migrated futuresMetricsService to Stream1mManager
- ✅ Added WindowMetrics → PartialChangeMetrics conversion
- ✅ Updated useFuturesStreaming hook for 1m metrics
- ✅ TypeScript type checking passes
- ✅ Made MAX_SYMBOLS configurable (set to 50)

#### Phase 5: Alert Integration (COMPLETE)
- ✅ Alert engine works through conversion layer
- ✅ Legacy UI compatibility maintained

#### Recent Improvements (December 8, 2025)
- ✅ **Volume-based Symbol Selection**: `fetchAllFuturesSymbols()` now sorts 531 USDT perpetual futures by 24hr quote volume
- ✅ **Ticker Stream Integration**: Added ticker stream subscription for live price updates
- ✅ **Filtered Ticker Data**: `getAllTickerData()` only returns tracked symbols (not all 223)
- ✅ **UI Status Updates**: Ticker events keep UI showing "Live" status
- ✅ **Top 50 Tracking**: Now tracking the 50 most liquid pairs instead of first 50 alphabetically

### 🚧 Remaining Work

#### Delete Old 5m System
- ⏳ Remove `webSocketStreamManager.ts`
- ⏳ Remove `ringBufferManager.ts`
- ⏳ Remove `changeCalculator.ts`
- ⏳ Update imports and dependencies

#### Integration Testing
- ⏳ Fix integration tests expecting old 5m API
- ⏳ End-to-end validation of 1m → alerts → UI flow

#### Documentation
- ⏳ Update main ROADMAP.md with 1m system status
- ⏳ Document volume-based symbol selection approach

---

## Next Steps

1. ✅ ~~Create git tag~~: Tag created before migration started
2. ✅ ~~Create feature branch~~: Working directly on main with incremental commits
3. ✅ ~~Start Phase 1~~: Core data structures complete
4. 🚧 **Delete old 5m files**: Ready to remove after validation
5. 🚧 **Test thoroughly**: Integration tests need updating
6. ✅ ~~Single deployment~~: Incremental deployment via git push

---

*Last Updated: December 8, 2025*
