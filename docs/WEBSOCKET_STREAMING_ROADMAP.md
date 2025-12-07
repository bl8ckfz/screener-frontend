# WebSocket Streaming Implementation Roadmap

## Executive Summary

**Goal**: Replace REST API polling with WebSocket streaming for real-time futures data updates.

**Approach**: Connect to Binance USDT-M futures WebSocket, subscribe to 5m kline streams for all symbols (~590), maintain 24-hour ring buffers, and compute multi-timeframe metrics in real-time.

**Benefits**:
- 🎯 **Real-time Updates**: Sub-second latency vs 5-minute polling cycles
- 🎯 **Zero API Requests**: No REST calls ever (100% reduction from start)
- 🎯 **Zero Rate Limits**: WebSocket has no request limits
- 🎯 **Lower Bandwidth**: Only changed data transmitted
- 🎯 **Better UX**: Instant alert detection and UI updates
- 🎯 **Simple Startup**: No backfill needed, just connect and go
- 🎯 **Gradual Availability**: Features unlock as data accumulates naturally
- 🎯 **No Refresh Intervals**: Market data streams automatically
- 🎯 **Live Coin List**: Real-time symbol additions/removals via ticker stream
- 🎯 **Funding Rates**: Real-time funding rate updates included
- 🎯 **Mark Price**: Index price and mark price in ticker data

**Timeline**: 12 days (60 hours)

---

## Current Architecture vs Proposed

### Current: REST API Polling
```
Every 5 minutes (Futures Data):
  ├─ Fetch 5m klines for 590 symbols  → 590 API requests
  ├─ Fetch 15m klines for 590 symbols → 590 API requests
  ├─ Fetch 1h klines for 590 symbols  → 590 API requests
  ├─ Fetch 8h klines for 590 symbols  → 590 API requests
  └─ Fetch 1d klines for 590 symbols  → 590 API requests
  
Every auto-refresh (Spot Market Data):
  └─ Fetch 24hr ticker for all symbols → 1 API request (large payload)
  ────────────────────────────────────────────────────
  Total: 2,950+ API requests every 5 minutes
  Latency: 5+ minutes between updates
  Rate Limit Pressure: High
  Refresh Intervals: Manual or timed polling
```

### Proposed: WebSocket Streaming with Instant Market Data + Background Backfill
```
Initial Setup (instant - <2 seconds):
  ├─ Connect to wss://fstream.binance.com/stream (Futures)
  ├─ Subscribe to !ticker@arr (All market tickers - ~500 symbols)
  ├─ Receive first ticker batch (<1 second)
  ├─ Sort by 24h quote volume (most liquid first)
  ├─ Select top 200 most liquid USDT pairs
  └─ UI displays market data immediately ✅ USERS SEE DATA NOW!

Symbol Selection (smart):
  ├─ All tickers received: ~500 USDT-M futures symbols
  ├─ Sort by 24h quote volume (descending)
  ├─ Top 200 symbols selected (e.g., BTC, ETH, BNB, SOL, etc.)
  ├─ Typical top symbol: $50B+ daily volume
  └─ Ensures most active, liquid markets only

Background Backfill (non-blocking):
  ├─ Fetch 288 candles (24h) for top 200 symbols only
  ├─ Progress updates shown to user (0-100%)
  ├─ Subscribe to 200×5m kline streams (for real-time updates)
  └─ Complete in ~60 seconds (users already engaged)

Feature Availability (immediate):
  ├─ Live prices ✅ (instant from ticker)
  ├─ 24h stats ✅ (instant from ticker)
  ├─ Funding rates ✅ (instant from ticker)
  ├─ Top 200 liquid markets ✅ (instant from ticker sorting)
  ├─ Price changes ✅ (available after backfill completes)
  ├─ Volume metrics ✅ (available after backfill completes)
  └─ Historical charts ✅ (available after backfill completes)

Real-time Streaming (continuous):
  ├─ Kline updates (pushed every 5 minutes)
  └─ Ticker updates (pushed every ~1 second)
  ────────────────────────────────────────────────────
  Total: ~200 API requests at startup (backfill only, one-time)
  Then: 0 API requests forever (100% reduction in ongoing requests)
  Latency: <1 second from market update
  Rate Limit Pressure: Minimal (startup only)
  Auto-refresh: Not needed - live data always flowing
  First Paint: <2 seconds (instant market data)
  Symbol Selection: Smart (top 200 by volume, no manual curation needed)
  
Benefits: Instant UI + Top Liquidity + Progressive Enhancement + Zero ongoing API requests
```

---

## Architecture Design

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  WebSocket Data Pipeline                    │
└─────────────────────────────────────────────────────────────┘

1. WebSocket Connection Layer
   ├─ BinanceFuturesWebSocket (connection manager)
   ├─ Reconnection logic with exponential backoff
   └─ Health monitoring (ping/pong)

2. Stream Subscription Manager
   ├─ Subscribe to 590 symbols×5m kline streams
   ├─ Batch subscriptions (20 at a time)
   └─ Handle subscription confirmations

3. Ring Buffer Storage
   ├─ KlineRingBuffer (per symbol, 288 candles)
   ├─ Circular array for memory efficiency
   └─ Thread-safe updates

4. Metrics Calculator
   ├─ Multi-timeframe change calculator
   ├─ Rolling window aggregations
   └─ getChange(symbol, timeframe) API

5. Integration Layer
   ├─ Update existing FuturesMetricsService
   ├─ Maintain backward compatibility
   └─ Feature flag for gradual rollout
```

---

## Data Structures

### 1. Ring Buffer Design

**Purpose**: Store 24 hours of 5m candles (288 candles) per symbol efficiently.

```typescript
/**
 * Single 5m candle stored in ring buffer
 */
interface Kline5m {
  openTime: number      // Timestamp (ms)
  open: number          // Open price
  high: number          // High price
  low: number           // Low price
  close: number         // Close price
  volume: number        // Base asset volume
  quoteVolume: number   // Quote asset volume (USDT)
}

/**
 * Ring buffer for one symbol's 5m candles
 */
class KlineRingBuffer {
  private buffer: Kline5m[]     // Fixed size: 288
  private head: number          // Write position
  private count: number         // Number of filled slots
  private readonly capacity = 288  // 24 hours of 5m candles
  
  constructor(symbol: string)
  
  /**
   * Add new 5m candle (overwrites oldest if full)
   */
  push(candle: Kline5m): void
  
  /**
   * Get last N candles (for window calculations)
   * @param n - Number of candles (1, 3, 12, 96, 288)
   * @returns Array of candles, oldest first
   */
  getLastN(n: number): Kline5m[]
  
  /**
   * Check if buffer has enough data for timeframe
   */
  hasEnoughData(n: number): boolean
  
  /**
   * Get current fill percentage
   */
  getFillPercentage(): number
}
```

**Memory Calculation**:
- 1 candle = 7 numbers × 8 bytes = 56 bytes
- 288 candles × 56 bytes = 16 KB per symbol
- 590 symbols × 16 KB = **9.44 MB total** (very efficient!)

---

### 2. Change Metrics Structure

```typescript
/**
 * Multi-timeframe change metrics for one symbol
 * During warm-up phase, values are null until enough data is accumulated
 */
interface PartialChangeMetrics {
  symbol: string
  timestamp: number
  
  // 5m window (last 1 candle) - available after 5 minutes
  change_5m: number | null
  baseVolume_5m: number | null      // Base asset volume (BTC, ETH, etc.)
  quoteVolume_5m: number | null     // Quote asset volume (USDT)
  
  // 15m window (last 3 candles) - available after 15 minutes
  change_15m: number | null
  baseVolume_15m: number | null
  quoteVolume_15m: number | null
  
  // 1h window (last 12 candles) - available after 1 hour
  change_1h: number | null
  baseVolume_1h: number | null
  quoteVolume_1h: number | null
  
  // 4h window (last 48 candles) - available after 4 hours
  change_4h: number | null
  baseVolume_4h: number | null
  quoteVolume_4h: number | null
  
  // 8h window (last 96 candles) - available after 8 hours
  change_8h: number | null
  baseVolume_8h: number | null
  quoteVolume_8h: number | null
  
  // 12h window (last 144 candles) - available after 12 hours
  change_12h: number | null
  baseVolume_12h: number | null
  quoteVolume_12h: number | null
  
  // 1d window (last 288 candles) - available after 24 hours
  change_1d: number | null
  baseVolume_1d: number | null
  quoteVolume_1d: number | null
}

/**
 * Warm-up status for all symbols and timeframes
 */
interface WarmupStatus {
  totalSymbols: number
  timeframes: {
    '5m': { ready: number; total: number }
    '15m': { ready: number; total: number }
    '1h': { ready: number; total: number }
    '4h': { ready: number; total: number }
    '8h': { ready: number; total: number }
    '12h': { ready: number; total: number }
    '1d': { ready: number; total: number }
  }
  overallProgress: number  // 0-100%
}

/**
 * Single timeframe change result
 */
interface TimeframeChange {
  priceChange: number          // Absolute change
  priceChangePercent: number   // Percentage change
  baseVolume: number           // Sum of base volumes
  quoteVolume: number          // Sum of quote volumes
  windowStart: number          // Oldest candle time
  windowEnd: number            // Newest candle time
  candleCount: number          // Number of candles in window
}

/**
 * Futures ticker data from !ticker@arr stream
 * Used for coin list and current market data
 */
interface FuturesTickerData {
  symbol: string               // Symbol (e.g., "BTCUSDT")
  eventTime: number            // Event time
  close: number                // Last price
  open: number                 // Open price (24h ago)
  high: number                 // High price (24h)
  low: number                  // Low price (24h)
  volume: number               // Base asset volume (24h)
  quoteVolume: number          // Quote asset volume (24h)
  priceChange: number          // Price change (24h)
  priceChangePercent: number   // Price change % (24h)
  lastQty: number              // Last traded quantity
  
  // Futures-specific fields
  weightedAvgPrice: number     // Weighted average price
  fundingRate: number          // Current funding rate
  indexPrice: number           // Index price
  markPrice: number            // Mark price
  openInterest: number         // Open interest
}
```

---

## Implementation Plan

### Phase 1: WebSocket Connection Layer (Days 1-2)

#### 1.1 Create WebSocket Client
**New File**: `src/services/binanceFuturesWebSocket.ts`

**Interface**:
```typescript
class BinanceFuturesWebSocket {
  private ws: WebSocket | null
  private reconnectAttempts: number
  private subscriptions: Set<string>
  private eventHandlers: Map<string, Function[]>
  
  constructor(options?: {
    maxReconnectAttempts?: number
    reconnectDelay?: number
    pingInterval?: number
  })
  
  /**
   * Connect to Binance Futures WebSocket
   */
  async connect(): Promise<void>
  
  /**
   * Subscribe to kline streams
   * @param streams - Array of stream names (e.g., ["btcusdt@kline_5m"])
   */
  async subscribe(streams: string[]): Promise<void>
  
  /**
   * Unsubscribe from streams
   */
  async unsubscribe(streams: string[]): Promise<void>
  
  /**
   * Register event handler
   * @param event - 'kline', 'error', 'close', 'reconnect'
   */
  on(event: string, handler: Function): void
  
  /**
   * Disconnect and cleanup
   */
  disconnect(): void
  
  /**
   * Get connection state
   */
  getState(): 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
}
```

**Key Implementation Details**:

```typescript
// WebSocket URL for combined streams
const WS_BASE_URL = 'wss://fstream.binance.com/stream'

async connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Use combined stream endpoint
      this.ws = new WebSocket(WS_BASE_URL)
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected')
        this.reconnectAttempts = 0
        this.startPingInterval()
        resolve()
      }
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      }
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        this.emit('error', error)
      }
      
      this.ws.onclose = () => {
        console.warn('⚠️  WebSocket closed')
        this.stopPingInterval()
        this.handleReconnect()
      }
    } catch (error) {
      reject(error)
    }
  })
}

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
  streams.forEach(s => this.subscriptions.add(s))
  
  console.log(`📡 Subscribed to ${streams.length} streams`)
}

private handleMessage(data: any): void {
  // Handle subscription responses
  if (data.result === null && data.id) {
    console.log(`✅ Subscription confirmed: ID ${data.id}`)
    return
  }
  
  // Handle stream data
  if (data.stream && data.data) {
    const streamName = data.stream  // e.g., "btcusdt@kline_5m"
    const eventData = data.data
    
    // Parse kline data
    if (streamName.includes('@kline_')) {
      this.emit('kline', {
        symbol: eventData.s,      // BTCUSDT
        interval: eventData.k.i,  // 5m
        kline: {
          openTime: eventData.k.t,
          closeTime: eventData.k.T,
          open: parseFloat(eventData.k.o),
          high: parseFloat(eventData.k.h),
          low: parseFloat(eventData.k.l),
          close: parseFloat(eventData.k.c),
          volume: parseFloat(eventData.k.v),
          quoteVolume: parseFloat(eventData.k.q),
          isFinal: eventData.k.x  // true when candle closes
        }
      })
    }
  }
}

private async handleReconnect(): Promise<void> {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    console.error('❌ Max reconnection attempts reached')
    this.emit('maxReconnectReached')
    return
  }
  
  this.reconnectAttempts++
  const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
  
  console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`)
  
  await new Promise(resolve => setTimeout(resolve, delay))
  
  try {
    await this.connect()
    
    // Resubscribe to all previous streams
    if (this.subscriptions.size > 0) {
      await this.subscribe(Array.from(this.subscriptions))
    }
    
    this.emit('reconnect')
  } catch (error) {
    console.error('❌ Reconnection failed:', error)
    this.handleReconnect()
  }
}

private startPingInterval(): void {
  this.pingTimer = setInterval(() => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.ping()
    }
  }, 30000)  // Ping every 30 seconds
}
```

**Tasks**:
- [ ] Create `src/services/binanceFuturesWebSocket.ts`
- [ ] Implement connection management
- [ ] Implement subscription handling
- [ ] Implement reconnection logic with exponential backoff
- [ ] Implement ping/pong heartbeat
- [ ] Add event emitter for kline/error/reconnect events
- [ ] Write unit tests (15+ test cases):
  - Connection success/failure
  - Subscribe/unsubscribe
  - Message parsing (kline format)
  - Reconnection after disconnect
  - Exponential backoff
  - Max reconnect attempts
  - Ping/pong heartbeat

**Success Criteria**:
- ✅ Connects to Binance Futures WebSocket
- ✅ Handles subscription confirmations
- ✅ Parses kline messages correctly
- ✅ Reconnects automatically after disconnect
- ✅ Unit tests pass with 90%+ coverage

---

#### 1.2 Add Ticker Stream Support
**Update File**: `src/services/binanceFuturesWebSocket.ts`

**Add ticker parsing to existing client**:
```typescript
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
      this.emit('kline', {
        symbol: eventData.s,
        interval: eventData.k.i,
        kline: { /* ... existing kline parsing ... */ }
      })
    }
    
    // Parse ticker array data (NEW)
    if (streamName === '!ticker@arr') {
      const tickers: FuturesTickerData[] = eventData.map((ticker: any) => ({
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
        fundingRate: parseFloat(ticker.r),
        indexPrice: parseFloat(ticker.i),
        markPrice: parseFloat(ticker.p),
        openInterest: parseFloat(ticker.o),
      }))
      
      // Emit batch update (all ~590 symbols at once)
      this.emit('ticker', tickers)
    }
  }
}
```

**Tasks**:
- [ ] Add ticker stream parsing to `BinanceFuturesWebSocket`
- [ ] Add `subscribeTicker()` method for !ticker@arr
- [ ] Parse futures ticker format (includes funding rate, mark price)
- [ ] Write unit tests for ticker parsing (10+ test cases)

**Success Criteria**:
- ✅ Subscribes to !ticker@arr successfully
- ✅ Parses array of ~590 tickers correctly
- ✅ Emits ticker updates every ~1 second
- ✅ Includes futures-specific fields (funding rate, mark price)

---

### Phase 2: Ring Buffer Implementation (Days 3-4)

#### 2.1 Create Ring Buffer Data Structure
**New File**: `src/utils/klineRingBuffer.ts`

**Implementation**:
```typescript
export class KlineRingBuffer {
  private buffer: Kline5m[]
  private head: number = 0        // Next write position
  private count: number = 0       // Number of filled slots
  private readonly capacity = 288 // 24h of 5m candles
  public readonly symbol: string
  
  constructor(symbol: string) {
    this.symbol = symbol
    this.buffer = new Array(this.capacity)
  }
  
  push(candle: Kline5m): void {
    // Validate candle has required fields
    if (!candle.openTime || !candle.close) {
      throw new Error(`Invalid candle for ${this.symbol}`)
    }
    
    // Write to current head position
    this.buffer[this.head] = candle
    
    // Move head forward (wrap around)
    this.head = (this.head + 1) % this.capacity
    
    // Increment count (max at capacity)
    if (this.count < this.capacity) {
      this.count++
    }
  }
  
  getLastN(n: number): Kline5m[] {
    if (n > this.count) {
      throw new Error(`Not enough data: requested ${n}, have ${this.count}`)
    }
    
    const result: Kline5m[] = []
    
    // Calculate start position
    // If head=10, count=288, n=12:
    // start = (10 - 12 + 288) % 288 = 286
    let start = (this.head - n + this.capacity) % this.capacity
    
    // Read n candles from start
    for (let i = 0; i < n; i++) {
      const index = (start + i) % this.capacity
      result.push(this.buffer[index])
    }
    
    return result
  }
  
  hasEnoughData(n: number): boolean {
    return this.count >= n
  }
  
  getFillPercentage(): number {
    return (this.count / this.capacity) * 100
  }
  
  getOldestCandle(): Kline5m | null {
    if (this.count === 0) return null
    
    // If buffer is full, oldest is at head position
    // If buffer is not full, oldest is at index 0
    const oldestIndex = this.count === this.capacity ? this.head : 0
    return this.buffer[oldestIndex]
  }
  
  getNewestCandle(): Kline5m | null {
    if (this.count === 0) return null
    
    // Newest is always at (head - 1)
    const newestIndex = (this.head - 1 + this.capacity) % this.capacity
    return this.buffer[newestIndex]
  }
  
  clear(): void {
    this.head = 0
    this.count = 0
  }
}
```

**Tasks**:
- [ ] Create `src/utils/klineRingBuffer.ts`
- [ ] Implement circular buffer logic
- [ ] Implement `push()` with wraparound
- [ ] Implement `getLastN()` with boundary handling
- [ ] Add helper methods (hasEnoughData, getFillPercentage)
- [ ] Write unit tests (20+ test cases):
  - Push single candle
  - Push 288 candles (full buffer)
  - Push 300 candles (overwrites oldest)
  - Get last N candles (various N: 1, 3, 12, 96, 288)
  - Get candles when buffer not full
  - Boundary conditions (empty buffer, N > count)
  - Oldest/newest candle retrieval
  - Clear buffer

**Success Criteria**:
- ✅ Correctly maintains 288-candle circular buffer
- ✅ `getLastN()` returns candles in correct order (oldest first)
- ✅ Memory usage stays constant at 16KB per symbol
- ✅ Unit tests pass with 95%+ coverage

---

#### 2.2 Create Ring Buffer Manager
**New File**: `src/services/ringBufferManager.ts`

**Interface**:
```typescript
class RingBufferManager {
  private buffers: Map<string, KlineRingBuffer>  // symbol → buffer
  
  /**
   * Initialize buffers for all symbols
   */
  async initialize(symbols: string[]): Promise<void>
  
  /**
   * Update buffer with new candle (from WebSocket)
   */
  updateCandle(symbol: string, candle: Kline5m): void
  
  /**
   * Check warm-up status for symbol and timeframe
   * Returns true if buffer has enough candles for that timeframe
   */
  isReady(symbol: string, timeframe: '5m' | '15m' | '1h' | '8h' | '1d'): boolean
  
  /**
   * Get warm-up progress (0-100%) for symbol
   */
  getWarmupProgress(symbol: string): number
  
  /**
   * Get ring buffer for symbol
   */
  getBuffer(symbol: string): KlineRingBuffer | undefined
  
  /**
   * Get all symbols with buffers
   */
  getSymbols(): string[]
  
  /**
   * Get overall fill status
   */
  getStatus(): {
    totalSymbols: number
    fullyLoaded: number
    loading: number
    averageFill: number
  }
}
```

**Key Implementation**:
```typescript
// Timeframe requirements (number of candles needed)
const TIMEFRAME_REQUIREMENTS: Record<string, number> = {
  '5m': 1,
  '15m': 3,
  '1h': 12,
  '4h': 48,
  '8h': 96,
  '12h': 144,
  '1d': 288,
}

isReady(symbol: string, timeframe: '5m' | '15m' | '1h' | '8h' | '1d'): boolean {
  const buffer = this.getBuffer(symbol)
  if (!buffer) return false
  
  const required = TIMEFRAME_REQUIREMENTS[timeframe]
  return buffer.hasEnoughData(required)
}

getWarmupProgress(symbol: string): number {
  const buffer = this.getBuffer(symbol)
  if (!buffer) return 0
  
  // Progress is based on 288 candles (24h) = 100%
  return buffer.getFillPercentage()
}

getWarmupStatus(): WarmupStatus {
  const status: WarmupStatus = {
    totalSymbols: this.buffers.size,
    timeframes: {
      '5m': { ready: 0, total: this.buffers.size },
      '15m': { ready: 0, total: this.buffers.size },
      '1h': { ready: 0, total: this.buffers.size },
      '8h': { ready: 0, total: this.buffers.size },
      '1d': { ready: 0, total: this.buffers.size },
    },
    overallProgress: 0,
  }
  
  let totalProgress = 0
  
  for (const [symbol] of this.buffers) {
    totalProgress += this.getWarmupProgress(symbol)
    
    if (this.isReady(symbol, '5m')) status.timeframes['5m'].ready++
    if (this.isReady(symbol, '15m')) status.timeframes['15m'].ready++
    if (this.isReady(symbol, '1h')) status.timeframes['1h'].ready++
    if (this.isReady(symbol, '4h')) status.timeframes['4h'].ready++
    if (this.isReady(symbol, '8h')) status.timeframes['8h'].ready++
    if (this.isReady(symbol, '12h')) status.timeframes['12h'].ready++
    if (this.isReady(symbol, '1d')) status.timeframes['1d'].ready++
  }
  
  status.overallProgress = totalProgress / this.buffers.size
  
  return status
}

async initialize(symbols: string[]): Promise<void> {
  // Create buffers for all symbols
  for (const symbol of symbols) {
    this.buffers.set(symbol, new KlineRingBuffer(symbol))
  }
  
  console.log(`📦 Initialized ${symbols.length} ring buffers (${(symbols.length * 16 / 1024).toFixed(2)} MB)`)
}
```

**Tasks**:
- [ ] Create `src/services/ringBufferManager.ts`
- [ ] Implement buffer initialization for all symbols
- [ ] Implement warm-up status tracking
- [ ] Implement ready state checking per timeframe
- [ ] Implement real-time updates from WebSocket
- [ ] Add status monitoring
- [ ] Write unit tests (12+ test cases)

**Success Criteria**:
- ✅ Manages 590 ring buffers efficiently
- ✅ Tracks warm-up progress per symbol and timeframe
- ✅ Updates buffers in real-time from WebSocket
- ✅ Memory usage ~10MB total

---

### Phase 3: Metrics Calculator (Days 5-6)

#### 3.1 Create Change Calculator
**New File**: `src/services/changeCalculator.ts`

**Interface**:
```typescript
class ChangeCalculator {
  private bufferManager: RingBufferManager
  
  constructor(bufferManager: RingBufferManager)
  
  /**
   * Calculate change metrics for specific timeframe
   */
  getChange(symbol: string, timeframe: '5m' | '15m' | '1h' | '8h' | '1d'): TimeframeChange | null
  
  /**
   * Calculate all timeframe changes for symbol
   * Returns null for timeframes that aren't warmed up yet
   */
  getAllChanges(symbol: string): PartialChangeMetrics
  
  /**
   * Calculate changes for all symbols (for screener)
   */
  getAllSymbolsChanges(): Map<string, ChangeMetrics>
}
```

**Key Implementation**:
```typescript
// Timeframe to candle count mapping
const TIMEFRAME_CANDLES: Record<string, number> = {
  '5m': 1,     // Last 1 candle
  '15m': 3,    // Last 3 candles
  '1h': 12,    // Last 12 candles
  '4h': 48,    // Last 48 candles
  '8h': 96,    // Last 96 candles
  '12h': 144,  // Last 144 candles
  '1d': 288,   // Last 288 candles
}

getChange(symbol: string, timeframe: '5m' | '15m' | '1h' | '8h' | '1d'): TimeframeChange | null {
  const buffer = this.bufferManager.getBuffer(symbol)
  if (!buffer) {
    return null
  }
  
  const candleCount = TIMEFRAME_CANDLES[timeframe]
  
  // Return null if not enough data yet (still warming up)
  if (!buffer.hasEnoughData(candleCount)) {
    return null
  }
  
  // Get last N candles
  const candles = buffer.getLastN(candleCount)
  
  // Calculate price change
  const startPrice = candles[0].close           // Oldest candle's close
  const endPrice = candles[candleCount - 1].close  // Newest candle's close
  const priceChange = endPrice - startPrice
  const priceChangePercent = (priceChange / startPrice) * 100
  
  // Calculate volumes (sum over window)
  let baseVolume = 0
  let quoteVolume = 0
  
  for (const candle of candles) {
    baseVolume += candle.volume
    quoteVolume += candle.quoteVolume
  }
  
  return {
    priceChange,
    priceChangePercent,
    baseVolume,
    quoteVolume,
    windowStart: candles[0].openTime,
    windowEnd: candles[candleCount - 1].openTime,
    candleCount,
  }
}

getAllChanges(symbol: string): PartialChangeMetrics {
  const change_5m = this.getChange(symbol, '5m')
  const change_15m = this.getChange(symbol, '15m')
  const change_1h = this.getChange(symbol, '1h')
  const change_4h = this.getChange(symbol, '4h')
  const change_8h = this.getChange(symbol, '8h')
  const change_12h = this.getChange(symbol, '12h')
  const change_1d = this.getChange(symbol, '1d')
  
  return {
    symbol,
    timestamp: Date.now(),
    
    // All fields are nullable during warm-up phase
    change_5m: change_5m?.priceChangePercent ?? null,
    baseVolume_5m: change_5m?.baseVolume ?? null,
    quoteVolume_5m: change_5m?.quoteVolume ?? null,
    
    change_15m: change_15m?.priceChangePercent ?? null,
    baseVolume_15m: change_15m?.baseVolume ?? null,
    quoteVolume_15m: change_15m?.quoteVolume ?? null,
    
    change_1h: change_1h?.priceChangePercent ?? null,
    baseVolume_1h: change_1h?.baseVolume ?? null,
    quoteVolume_1h: change_1h?.quoteVolume ?? null,
    
    change_4h: change_4h?.priceChangePercent ?? null,
    baseVolume_4h: change_4h?.baseVolume ?? null,
    quoteVolume_4h: change_4h?.quoteVolume ?? null,
    
    change_8h: change_8h?.priceChangePercent ?? null,
    baseVolume_8h: change_8h?.baseVolume ?? null,
    quoteVolume_8h: change_8h?.quoteVolume ?? null,
    
    change_12h: change_12h?.priceChangePercent ?? null,
    baseVolume_12h: change_12h?.baseVolume ?? null,
    quoteVolume_12h: change_12h?.quoteVolume ?? null,
    
    change_1d: change_1d?.priceChangePercent ?? null,
    baseVolume_1d: change_1d?.baseVolume ?? null,
    quoteVolume_1d: change_1d?.quoteVolume ?? null,
  }
}
```

**Tasks**:
- [ ] Create `src/services/changeCalculator.ts`
- [ ] Implement `getChange()` for single timeframe
- [ ] Implement `getAllChanges()` for all timeframes
- [ ] Implement `getAllSymbolsChanges()` for screener
- [ ] Add error handling for missing data
- [ ] Write unit tests (30+ test cases):
  - Calculate 5m change (1 candle)
  - Calculate 15m change (3 candles)
  - Calculate 1h change (12 candles)
  - Calculate 4h change (48 candles)
  - Calculate 8h change (96 candles)
  - Calculate 12h change (144 candles)
  - Calculate 1d change (288 candles)
  - Verify price change formula
  - Verify volume summation
  - Edge cases (insufficient data, missing buffer)

**Success Criteria**:
- ✅ Correctly calculates price changes for all timeframes
- ✅ Correctly sums volumes over windows
- ✅ Performance: <1ms per symbol
- ✅ Unit tests pass with 95%+ coverage

---

### Phase 4: WebSocket Integration (Days 7-8)

#### 4.1 Create WebSocket Stream Manager
**New File**: `src/services/webSocketStreamManager.ts`

**Interface**:
```typescript
class WebSocketStreamManager {
  private wsClient: BinanceFuturesWebSocket
  private bufferManager: RingBufferManager
  private changeCalculator: ChangeCalculator
  private symbols: string[]
  private tickerData: Map<string, FuturesTickerData>
  private isRunning: boolean
  
  constructor(options?: {
    autoReconnect?: boolean
    batchSize?: number
  })
  
  /**
   * Initialize and start streaming
   */
  async start(symbols: string[]): Promise<void>
  
  /**
   * Stop streaming
   */
  stop(): void
  
  /**
   * Get current metrics for symbol
   */
  getMetrics(symbol: string): ChangeMetrics
  
  /**
   * Get metrics for all symbols
   */
  getAllMetrics(): Map<string, ChangeMetrics>
  
  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean
    subscribedStreams: number
    buffersReady: number
    lastUpdate: number
  }
}
```

**Key Implementation**:
```typescript
async start(symbols: string[]): Promise<void> {
  this.symbols = symbols
  console.log(`🚀 Starting WebSocket stream for ${symbols.length} symbols...`)
  
  // Step 1: Initialize ring buffers
  await this.bufferManager.initialize(symbols)
  
  // Step 2: Connect to Futures WebSocket
  console.log('📡 Connecting to Futures WebSocket...')
  await this.wsClient.connect()
  
  // Step 3: Subscribe to ticker stream (for live market data)
  console.log('📡 Subscribing to ticker stream...')
  await this.wsClient.subscribe(['!ticker@arr'])
  
  // Set up ticker event handler
  this.wsClient.on('ticker', (tickers: FuturesTickerData[]) => {
    this.handleTickerBatch(tickers)
  })
  
  console.log('✅ Futures market data streaming (live coin list + 24h stats + funding rates)')
  
  // Step 4: Start with empty buffers - data accumulates naturally
  // Warm-up timeline:
  //   5min  → 5m changes available
  //   15min → 15m changes available
  //   1h    → 1h changes available
  //   8h    → 8h changes available
  //   24h   → 1d changes available (fully warmed up)
  console.log('🔥 Warm-up phase started - data will accumulate over 24 hours')
  console.log('   5 min   → 5m metrics ready')
  console.log('   15 min  → 15m metrics ready')
  console.log('   1 hour  → 1h metrics ready')
  console.log('   4 hours → 4h metrics ready')
  console.log('   8 hours → 8h metrics ready')
  console.log('   12 hours → 12h metrics ready')
  console.log('   24 hours → All metrics ready')   batch.map(symbol => this.bufferManager.backfill(symbol, this.apiClient))
    )
    console.log(`✅ Backfilled ${Math.min(i + batchSize, symbols.length)}/${symbols.length} symbols`)
  }
  
  // Step 4: Subscribe to kline streams
  console.log('📡 Subscribing to WebSocket streams...')
  const streams = symbols.map(s => `${s.toLowerCase()}@kline_5m`)
  
  // Binance limits: subscribe in batches of 200
  const subscriptionBatchSize = 200
  for (let i = 0; i < streams.length; i += subscriptionBatchSize) {
    const batch = streams.slice(i, i + subscriptionBatchSize)
    await this.wsClient.subscribe(batch)
    
    // Small delay between batches
    if (i + subscriptionBatchSize < streams.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  // Step 5: Set up event handlers
  this.wsClient.on('kline', (data) => {
    this.handleKlineUpdate(data)
  })
  
  this.wsClient.on('error', (error) => {
    console.error('❌ WebSocket error:', error)
  })
  
  this.wsClient.on('reconnect', () => {
    console.log('✅ WebSocket reconnected')
  })
  
  this.isRunning = true
  console.log('✅ WebSocket streaming started!')
}

private handleKlineUpdate(data: any): void {
  const { symbol, kline } = data
  
  // Only process completed candles (isFinal === true)
  if (!kline.isFinal) {
    return
  }
  
  // Update ring buffer
  this.bufferManager.updateCandle(symbol, {
    openTime: kline.openTime,
    open: kline.open,
    high: kline.high,
    low: kline.low,
    close: kline.close,
    volume: kline.volume,
    quoteVolume: kline.quoteVolume,
  })
  
  // Emit update event for UI/alerts
  this.emit('metricsUpdate', {
    symbol,
    metrics: this.changeCalculator.getAllChanges(symbol),
  })
}

private handleTickerBatch(tickers: FuturesTickerData[]): void {
  // Update internal map with latest ticker data
  for (const ticker of tickers) {
    this.tickerData.set(ticker.symbol, ticker)
  }
  
  // Emit batch update for coin list and market summary
  // UI can use this for:
  // 1. Real-time coin list (no need to fetch from API)
  // 2. 24h price changes, volumes, high/low
  // 3. Current price, funding rate, mark price
  // 4. Market summary statistics
  this.emit('tickerUpdate', {
    tickers: Array.from(this.tickerData.values()),
    timestamp: Date.now(),
  })
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
```

**Tasks**:
- [ ] Create `src/services/webSocketStreamManager.ts`
- [ ] Implement startup sequence (buffers → connect → backfill → subscribe)
- [ ] Implement kline update handler
- [ ] Implement batch subscription (200 streams at a time)
- [ ] Add event emitters for metrics updates
- [ ] Write integration tests (10+ test cases)

**Success Criteria**:
- ✅ Successfully connects and subscribes to 590 streams
- ✅ Starts receiving data immediately (no backfill)
- ✅ Processes real-time kline updates
- ✅ Emits metrics updates for UI
- ✅ Tracks and exposes warm-up progress

---

### Phase 5: Service Integration (Days 9-10)

#### 5.1 Update FuturesMetricsService
**Modified File**: `src/services/futuresMetricsService.ts`

**Changes**:
1. Add WebSocket mode alongside REST mode
2. Use feature flag to toggle between modes
3. Maintain backward compatibility

**Implementation**:
```typescript
export class FuturesMetricsService {
  private futuresClient: BinanceFuturesApiClient
  private coinGeckoClient: CoinGeckoApiClient
  private wsStreamManager: WebSocketStreamManager | null = null
  private useWebSocket: boolean
  
  constructor(
    futuresClient?: BinanceFuturesApiClient,
    coinGeckoClient?: CoinGeckoApiClient,
    options?: { useWebSocket?: boolean }
  ) {
    this.futuresClient = futuresClient || new BinanceFuturesApiClient()
    this.coinGeckoClient = coinGeckoClient || new CoinGeckoApiClient()
    this.useWebSocket = options?.useWebSocket ?? false
    
    if (this.useWebSocket) {
      this.wsStreamManager = new WebSocketStreamManager()
    }
  }
  
  async initialize(symbols: string[]): Promise<void> {
    if (this.useWebSocket && this.wsStreamManager) {
      // Start streaming immediately - no backfill needed
      await this.wsStreamManager.start(symbols)
    }
  }
  
  /**
   * Get warm-up status (for UI indicators)
   */
  getWarmupStatus(): WarmupStatus {
    if (this.wsStreamManager) {
      return this.wsStreamManager.getWarmupStatus()
    }
    return null
  }
  
  async fetchSymbolMetrics(symbol: string): Promise<FuturesMetrics> {
    let priceChanges, volumes
    
    if (this.useWebSocket && this.wsStreamManager) {
      // Get from WebSocket stream (may have null values during warm-up)
      const metrics = this.wsStreamManager.getMetrics(symbol)
      priceChanges = {
        change_5m: metrics.change_5m ?? 0,      // Default to 0 if warming up
        change_15m: metrics.change_15m ?? 0,
        change_1h: metrics.change_1h ?? 0,
        change_4h: metrics.change_4h ?? 0,
        change_8h: metrics.change_8h ?? 0,
        change_12h: metrics.change_12h ?? 0,
        change_1d: metrics.change_1d ?? 0,
      }
      volumes = {
        baseVolume_5m: metrics.baseVolume_5m ?? 0,
        quoteVolume_5m: metrics.quoteVolume_5m ?? 0,
        baseVolume_15m: metrics.baseVolume_15m ?? 0,
        quoteVolume_15m: metrics.quoteVolume_15m ?? 0,
        baseVolume_1h: metrics.baseVolume_1h ?? 0,
        quoteVolume_1h: metrics.quoteVolume_1h ?? 0,
        baseVolume_4h: metrics.baseVolume_4h ?? 0,
        quoteVolume_4h: metrics.quoteVolume_4h ?? 0,
        baseVolume_8h: metrics.baseVolume_8h ?? 0,
        quoteVolume_8h: metrics.quoteVolume_8h ?? 0,
        baseVolume_12h: metrics.baseVolume_12h ?? 0,
        quoteVolume_12h: metrics.quoteVolume_12h ?? 0,
        baseVolume_1d: metrics.baseVolume_1d ?? 0,
        quoteVolume_1d: metrics.quoteVolume_1d ?? 0,
      }
    } else {
      // Fallback to REST API (old behavior)
      const klineData = await this.fetchKlineData(symbol)
      priceChanges = this.calculatePriceChanges(klineData)
      volumes = this.extractVolumes(klineData)
    }
    
    // Market cap fetch remains the same
    const marketCap = await this.coinGeckoClient.fetchMarketCap(symbol)
    
    // Build and return metrics (same structure)
    return {
      symbol,
      timestamp: Date.now(),
      ...priceChanges,
      ...volumes,
      marketCap,
      coinGeckoId: this.getCoinGeckoId(symbol),
      ...this.evaluateFilters({ ...priceChanges, ...volumes, marketCap }),
    }
  }
}
```

**Tasks**:
- [ ] Add WebSocket mode to `FuturesMetricsService`
- [ ] Implement feature flag toggle
- [ ] Add initialization method
- [ ] Update `fetchSymbolMetrics()` to use WebSocket data
- [ ] Integrate ticker data for coin list and 24h stats
- [ ] Add funding rate display to UI
- [ ] Remove `RefreshControl` component (no longer needed)
- [ ] Update `MarketSummary` to use live ticker data
- [ ] Keep REST fallback for compatibility
- [ ] Update unit tests

**Success Criteria**:
- ✅ WebSocket mode returns same data structure as REST mode
- ✅ Feature flag works correctly
- ✅ All existing tests pass

---

#### 5.2 Update React Hook
**Modified File**: `src/hooks/useMarketData.ts`

**Changes**:
1. Initialize WebSocket on mount
2. Subscribe to metrics updates
3. Update UI in real-time

**Implementation**:
```typescript
export function useMarketData() {
  const [isInitializing, setIsInitializing] = useState(true)
  const [metricsMap, setMetricsMap] = useState<Map<string, FuturesMetrics>>(new Map())
  
  const [warmupStatus, setWarmupStatus] = useState<WarmupStatus | null>(null)
  
  useEffect(() => {
    const init = async () => {
      // Get all symbols
      const symbols = await futuresMetricsService.getAllFuturesSymbols()
      
      // Initialize WebSocket streaming (instant, no backfill)
      await futuresMetricsService.initialize(symbols)
      
      setIsInitializing(false)
      
      // Subscribe to real-time updates
      wsStreamManager.on('metricsUpdate', ({ symbol, metrics }) => {
        setMetricsMap(prev => new Map(prev).set(symbol, metrics))
      })
      
      // Track warm-up progress
      const warmupInterval = setInterval(() => {
        const status = futuresMetricsService.getWarmupStatus()
        setWarmupStatus(status)
        
        // Stop tracking once fully warmed up
        if (status?.overallProgress >= 100) {
          clearInterval(warmupInterval)
        }
      }, 5000)  // Update every 5 seconds
    }
    
    init()
    
    return () => {
      wsStreamManager.stop()
    }
  }, [])
  
  return {
    data: Array.from(metricsMap.values()),
    isLoading: isInitializing,
    error: null,
    warmupStatus,  // Expose warm-up status for UI indicators
  }
}
```

**Tasks**:
- [ ] Update `useMarketData` hook
- [ ] Add WebSocket initialization
- [ ] Add real-time update subscription
- [ ] Update UI components to handle real-time data
- [ ] Test with live data

---

#### 5.3 Remove Refresh Controls & Intervals
**Modified Components**: Multiple UI components

**Changes**:
```typescript
// BEFORE: Manual refresh with intervals
<RefreshControl 
  onRefresh={refetchData} 
  isRefreshing={isLoading}
  lastUpdate={lastUpdateTime}
/>

// AFTER: Live status indicator
<LiveStatusBadge 
  connected={wsConnected}
  lastUpdate={lastSpotUpdate}
  warmupProgress={warmupStatus}
/>
```

**Files to Update**:
1. **Remove**: `src/components/controls/RefreshControl.tsx` (no longer needed)
2. **Update**: `src/components/market/MarketSummary.tsx` - use live ticker data
3. **Update**: `src/components/coin/CoinTable.tsx` - remove refresh button, add funding rate column
4. **Update**: `src/hooks/useMarketData.ts` - remove polling interval
5. **Add**: `src/components/ui/LiveStatusBadge.tsx` - show connection status

**Implementation**:
```typescript
// New component: LiveStatusBadge
export function LiveStatusBadge({ 
  connected, 
  lastUpdate, 
  warmupStatus 
}: LiveStatusBadgeProps) {
  const timeSinceUpdate = Date.now() - lastUpdate
  const isStale = timeSinceUpdate > 5000  // >5s is stale
  
  return (
    <div className="flex items-center gap-2">
      {/* Connection status */}
      <div className={cn(
        "w-2 h-2 rounded-full",
        connected && !isStale ? "bg-green-500 animate-pulse" : "bg-red-500"
      )} />
      
      {/* Status text */}
      <span className="text-sm text-muted-foreground">
        {connected ? (
          isStale ? 'Reconnecting...' : 'Live'
        ) : (
          'Disconnected'
        )}
      </span>
      
      {/* Warm-up progress (if not fully warmed) */}
      {warmupStatus && warmupStatus.overallProgress < 100 && (
        <span className="text-xs text-muted-foreground">
          Warming up: {warmupStatus.overallProgress.toFixed(0)}%
        </span>
      )}
    </div>
  )
}
```

**Tasks**:
- [ ] Remove `RefreshControl` component
- [ ] Create `LiveStatusBadge` component
- [ ] Update `MarketSummary` to use ticker data
- [ ] Add funding rate display to relevant components
- [ ] Remove all `setInterval` refresh logic
- [ ] Update UI to show live connection status
- [ ] Add warm-up progress indicators
- [ ] Test UI with WebSocket disconnection

**Success Criteria**:
- ✅ No refresh buttons in UI
- ✅ Live status badge shows connection state
- ✅ Data updates automatically (no manual refresh)
- ✅ Warm-up progress visible to users
- ✅ Graceful handling of disconnections

---

### Phase 6: Testing & Optimization (Days 11-12)

#### 6.1 Integration Testing
**New File**: `tests/integration/webSocketStreaming.test.ts`

**Test Cases** (30+ tests):
1. End-to-end streaming pipeline
2. Backfill accuracy vs REST API
3. Real-time updates processing
4. Reconnection handling
5. Memory usage over time
6. Performance benchmarks

**Tasks**:
- [ ] Create integration test suite
- [ ] Test full pipeline (connect → backfill → stream → calculate)
- [ ] Verify metrics accuracy (WebSocket vs REST)
- [ ] Test reconnection scenarios
- [ ] Load test with 590 symbols
- [ ] Memory leak testing (24h continuous run)

---

#### 6.2 Performance Optimization

**Optimization Targets**:
1. **Startup Time**: <10 seconds (connect + subscribe)
2. **Memory Usage**: <20MB (ring buffers + ticker cache)
3. **Update Latency**: <100ms from WebSocket to UI
4. **CPU Usage**: <10% idle, <30% during updates
5. **Warm-up Time**: 24 hours for full metrics (gradual)
6. **Ticker Data Latency**: <1 second (ticker updates)

**Tasks**:
- [ ] Profile startup sequence
- [ ] Optimize backfill parallelization
- [ ] Add memoization for repeated calculations
- [ ] Implement lazy loading for UI
- [ ] Add performance monitoring

---

## Deployment Strategy

### Phase 1: Development Testing (Week 1)
- [ ] Enable WebSocket mode in development
- [ ] Test with 10 symbols
- [ ] Verify warm-up phase works correctly
- [ ] Test partial metrics (nulls during warm-up)
- [ ] Monitor for memory leaks

### Phase 2: Canary Rollout (Week 2)
```typescript
// Feature flag configuration
export const FEATURES = {
  USE_WEBSOCKET_STREAMING: process.env.NODE_ENV === 'development',  // Dev only
}
```

### Phase 3: Production Rollout (Week 3)
- Day 1: 10% of users
- Day 3: 50% of users
- Day 5: 100% of users

### Phase 4: Cleanup (Week 4)
- Remove REST polling code
- Remove feature flag
- Update documentation

---

## Migration Timeline

| Week | Days | Phase | Focus |
|------|------|-------|-------|
| 1 | 1-2 | Phase 1 | WebSocket connection layer |
| 1 | 3-4 | Phase 2 | Ring buffer implementation |
| 1 | 5-6 | Phase 3 | Metrics calculator |
| 2 | 7-8 | Phase 4 | WebSocket integration |
| 2 | 9-10 | Phase 5 | Service integration |
| 2 | 11-12 | Phase 6 | Testing & optimization |

**Total Effort**: ~60 hours over 12 days

---

## Risk Assessment

### High Risk
1. **WebSocket Connection Stability**
   - **Risk**: Frequent disconnections in production
   - **Mitigation**: Robust reconnection with exponential backoff
   - **Monitoring**: Alert on >5 disconnects/hour

2. **Data Accuracy**
   - **Risk**: WebSocket data differs from REST API
   - **Mitigation**: Extensive testing, compare both sources
   - **Validation**: Run both modes in parallel initially

### Medium Risk
3. **Memory Leaks**
   - **Risk**: Ring buffers grow unbounded
   - **Mitigation**: Fixed-size buffers (288 candles max)
   - **Monitoring**: Track heap size over 24h

4. **Startup Time**
   - **Risk**: 590 symbol backfill takes >10 minutes
   - **Mitigation**: Parallel backfill in batches
   - **Optimization**: Pre-warm buffers on server

### Low Risk
5. **Browser Compatibility**
   - **Risk**: WebSocket not supported in old browsers
   - **Mitigation**: Feature detection + REST fallback
   - **Support**: Modern browsers only (Chrome 90+, Firefox 88+)

---

## Success Metrics

### Technical Metrics
- ✅ WebSocket connection uptime >99.9% (single futures connection)
- ✅ Startup time <10 seconds (connect + subscribe)
- ✅ Memory usage <20MB (ring buffers + ticker cache)
- ✅ Update latency <100ms
- ✅ Warm-up phase completes naturally over 24h
- ✅ Partial metrics (nulls) handled gracefully in UI
- ✅ CPU usage <30% during updates
- ✅ Ticker data updates <1 second latency
- ✅ Ticker stream handles ~590 symbols per update
- ✅ Funding rate data available in real-time

### Business Metrics
- ✅ Zero API requests ever (100% reduction from start)
- ✅ Real-time alerts (<5 seconds from price change, once warmed up)
- ✅ Better user experience (instant UI updates + warm-up indicators)
- ✅ No rate limit errors
- ✅ Simpler deployment (no backfill, single WebSocket connection)
- ✅ No refresh buttons or intervals needed
- ✅ Live coin list updates automatically
- ✅ Market summary always current (<1s latency)
- ✅ Funding rate monitoring for futures positions

---

## Rollback Plan

### Immediate Rollback Triggers
- WebSocket connection fails >50% of attempts
- Memory usage >100MB
- Startup time >60 seconds
- Warm-up phase fails to progress

### Rollback Procedure
1. Set `USE_WEBSOCKET_STREAMING = false`
2. Deploy config change
3. Restart services
4. Verify REST mode working
5. Investigate root cause

---

## Future Enhancements

### Phase 7: Advanced Features (Month 2)
- [ ] Persist ring buffers to IndexedDB (survive page refresh)
- [ ] Add WebSocket authentication for private streams (user positions, orders)
- [ ] Subscribe to individual ticker streams (when user views specific coin)
- [ ] Subscribe to trade streams for order book/tape analysis
- [ ] Subscribe to markPrice streams for liquidation monitoring
- [ ] Implement custom timeframes (e.g., 2h, 4h, 6h)
- [ ] Add symbol search/filtering in ticker data
- [ ] Implement coin list sorting by ticker fields (volume, funding rate, open interest)
- [ ] Add funding rate history tracking and alerts

### Phase 8: Performance Optimization (Month 3)
- [ ] Move ring buffers to Web Worker (off main thread)
- [ ] Implement SharedArrayBuffer for cross-tab sync
- [ ] Add server-side WebSocket proxy (Vercel Edge)
- [ ] Implement data compression

---

## References

- [Binance Futures WebSocket Streams](https://binance-docs.github.io/apidocs/futures/en/#websocket-market-streams)
- [Binance Futures All Market Tickers Stream](https://binance-docs.github.io/apidocs/futures/en/#all-market-tickers-stream)
- [Binance Futures Kline/Candlestick Streams](https://binance-docs.github.io/apidocs/futures/en/#kline-candlestick-streams)
- [WebSocket API MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Ring Buffer Data Structure](https://en.wikipedia.org/wiki/Circular_buffer)

---

**Document Version**: 1.0  
**Created**: December 5, 2025  
**Author**: GitHub Copilot  
**Status**: 📋 Ready for Implementation
