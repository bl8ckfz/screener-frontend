/**
 * Ring Buffer for storing 5-minute klines
 * 
 * Efficiently stores 24 hours of 5m candles (288 candles) in a circular buffer.
 * When full, oldest candles are automatically overwritten.
 * 
 * Memory per symbol: ~16KB (288 candles × ~56 bytes per candle)
 */

export interface Kline5m {
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

/**
 * Circular buffer for storing 288 5-minute candles (24 hours)
 */
export class KlineRingBuffer {
  private buffer: Kline5m[]
  private head: number = 0        // Next write position
  private count: number = 0       // Number of filled slots (0 to capacity)
  private readonly capacity = 288 // 24h of 5m candles (24 × 60 / 5 = 288)
  public readonly symbol: string

  constructor(symbol: string) {
    this.symbol = symbol
    this.buffer = new Array(this.capacity)
  }

  /**
   * Add a new candle to the buffer
   * Overwrites oldest candle when buffer is full
   */
  push(candle: Kline5m): void {
    // Validate candle has required fields
    if (!candle.openTime || candle.close === undefined) {
      throw new Error(`Invalid candle for ${this.symbol}: missing openTime or close`)
    }

    // Write to current head position
    this.buffer[this.head] = candle

    // Move head forward (wrap around to 0 after reaching capacity)
    this.head = (this.head + 1) % this.capacity

    // Increment count (max at capacity)
    if (this.count < this.capacity) {
      this.count++
    }
  }

  /**
   * Get the last N candles in chronological order (oldest first)
   * @param n - Number of candles to retrieve (must be <= count)
   * @returns Array of candles, oldest first
   */
  getLastN(n: number): Kline5m[] {
    if (n > this.count) {
      throw new Error(`Not enough data: requested ${n}, have ${this.count}`)
    }

    if (n <= 0) {
      return []
    }

    const result: Kline5m[] = []

    // Calculate start position (n candles back from head)
    // Example: head=10, count=288, n=12
    //   start = (10 - 12 + 288) % 288 = 286
    let start = (this.head - n + this.capacity) % this.capacity

    // Read n candles from start position
    for (let i = 0; i < n; i++) {
      const index = (start + i) % this.capacity
      result.push(this.buffer[index])
    }

    return result
  }

  /**
   * Check if buffer has at least N candles
   */
  hasEnoughData(n: number): boolean {
    return this.count >= n
  }

  /**
   * Get percentage of buffer filled (0-100)
   */
  getFillPercentage(): number {
    return (this.count / this.capacity) * 100
  }

  /**
   * Get the oldest candle in the buffer
   */
  getOldestCandle(): Kline5m | null {
    if (this.count === 0) return null

    // If buffer is full, oldest is at head position (about to be overwritten)
    // If buffer is not full, oldest is at index 0
    const oldestIndex = this.count === this.capacity ? this.head : 0
    return this.buffer[oldestIndex]
  }

  /**
   * Get the newest (most recent) candle in the buffer
   */
  getNewestCandle(): Kline5m | null {
    if (this.count === 0) return null

    // Newest is always at (head - 1), with wraparound
    const newestIndex = (this.head - 1 + this.capacity) % this.capacity
    return this.buffer[newestIndex]
  }

  /**
   * Get current number of candles in buffer
   */
  getCount(): number {
    return this.count
  }

  /**
   * Get buffer capacity (always 288)
   */
  getCapacity(): number {
    return this.capacity
  }

  /**
   * Check if buffer is full (has 288 candles)
   */
  isFull(): boolean {
    return this.count === this.capacity
  }

  /**
   * Clear all data from buffer
   */
  clear(): void {
    this.head = 0
    this.count = 0
  }

  /**
   * Get buffer state for debugging
   */
  getDebugInfo(): {
    symbol: string
    count: number
    capacity: number
    head: number
    fillPercentage: number
    isFull: boolean
  } {
    return {
      symbol: this.symbol,
      count: this.count,
      capacity: this.capacity,
      head: this.head,
      fillPercentage: this.getFillPercentage(),
      isFull: this.isFull()
    }
  }
}
