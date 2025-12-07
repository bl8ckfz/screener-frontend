import type { Candle1m } from '@/types/api'

/**
 * Circular buffer for 1m candles with O(1) append/access
 * 
 * Stores 24 hours of 1-minute candles (1440 candles) per symbol.
 * More memory-efficient than array growth, constant memory footprint.
 * 
 * Memory per symbol: 1440 candles × 32 bytes = 46,080 bytes (~46 KB)
 * Total for 200 symbols: 200 × 46 KB = 9,216 KB (~9 MB)
 * 
 * @example
 * const buffer = new Candle1mRingBuffer('BTCUSDT')
 * 
 * // Add candles
 * buffer.push({ openTime: 1234567890000, close: 50000, volume: 100, quoteVolume: 5000000 })
 * 
 * // Access candles
 * const newest = buffer.getNewest()
 * const oldest = buffer.getOldest(60) // 60 candles back (1 hour window)
 * 
 * // Check availability
 * if (buffer.hasWindow(60)) {
 *   // Have at least 1 hour of data
 * }
 */
export class Candle1mRingBuffer {
  private buffer: Candle1m[]
  private head: number = 0
  private count: number = 0
  private readonly capacity = 1440  // 24 hours of 1m candles
  
  constructor(public readonly symbol: string) {
    // Pre-allocate array for efficiency
    this.buffer = new Array(this.capacity)
  }
  
  /**
   * Add new 1m candle (overwrites oldest if full)
   * 
   * @param candle - New candle to add
   * @returns Evicted candle if buffer was full, null otherwise
   */
  push(candle: Candle1m): Candle1m | null {
    // Get candle that will be evicted (if buffer is full)
    const evicted = this.count === this.capacity ? this.buffer[this.head] : null
    
    // Write new candle at head position
    this.buffer[this.head] = candle
    
    // Move head forward (circular)
    this.head = (this.head + 1) % this.capacity
    
    // Increment count (max = capacity)
    if (this.count < this.capacity) {
      this.count++
    }
    
    return evicted
  }
  
  /**
   * Get candle at index i (0 = oldest, count-1 = newest)
   * 
   * @param i - Index (0-based, 0 = oldest)
   * @returns Candle at index or null if index out of bounds
   */
  get(i: number): Candle1m | null {
    if (i < 0 || i >= this.count) {
      return null
    }
    
    // Calculate actual position in circular buffer
    // oldest candle is at (head - count) position
    const pos = (this.head - this.count + i + this.capacity) % this.capacity
    return this.buffer[pos]
  }
  
  /**
   * Get newest candle (most recent)
   * 
   * @returns Newest candle or null if buffer is empty
   */
  getNewest(): Candle1m | null {
    if (this.count === 0) {
      return null
    }
    return this.get(this.count - 1)
  }
  
  /**
   * Get oldest candle in window (n candles back from newest)
   * 
   * Used for window calculations: to get start of 1h window (60 candles),
   * call getOldest(60).
   * 
   * @param n - Window size in number of candles
   * @returns Oldest candle in window or null if not enough data
   * 
   * @example
   * // Get oldest candle in 1h window (60 candles)
   * const oldest = buffer.getOldest(60)
   * const newest = buffer.getNewest()
   * // Price change = (newest.close - oldest.close) / oldest.close * 100
   */
  getOldest(n: number): Candle1m | null {
    if (n > this.count || n <= 0) {
      return null
    }
    
    // Get candle at position (count - n)
    // e.g., for 60-candle window: get candle at index (count - 60)
    return this.get(this.count - n)
  }
  
  /**
   * Check if buffer has enough data for window
   * 
   * @param n - Required number of candles
   * @returns True if buffer has at least n candles
   * 
   * @example
   * if (buffer.hasWindow(60)) {
   *   // Can calculate 1h metrics
   * }
   */
  hasWindow(n: number): boolean {
    return this.count >= n
  }
  
  /**
   * Get current fill percentage
   * 
   * @returns Fill percentage (0-100)
   */
  getFillPercentage(): number {
    return (this.count / this.capacity) * 100
  }
  
  /**
   * Get number of candles currently in buffer
   * 
   * @returns Current count (0 to 1440)
   */
  getCount(): number {
    return this.count
  }
  
  /**
   * Get buffer capacity
   * 
   * @returns Maximum capacity (1440)
   */
  getCapacity(): number {
    return this.capacity
  }
  
  /**
   * Clear all candles from buffer
   */
  clear(): void {
    this.head = 0
    this.count = 0
    // Note: Don't reallocate array, just reset pointers
  }
  
  /**
   * Get all candles in order (oldest to newest)
   * 
   * WARNING: This creates a new array. Use sparingly (for debugging/testing).
   * For window calculations, use getOldest(n) and getNewest() instead.
   * 
   * @returns Array of candles in chronological order
   */
  toArray(): Candle1m[] {
    const result: Candle1m[] = []
    for (let i = 0; i < this.count; i++) {
      const candle = this.get(i)
      if (candle) {
        result.push(candle)
      }
    }
    return result
  }
  
  /**
   * Get debug information
   * 
   * @returns Debug info object
   */
  getDebugInfo(): {
    symbol: string
    count: number
    capacity: number
    fillPercentage: number
    head: number
    oldestTime: number | null
    newestTime: number | null
  } {
    const oldest = this.get(0)
    const newest = this.getNewest()
    
    return {
      symbol: this.symbol,
      count: this.count,
      capacity: this.capacity,
      fillPercentage: this.getFillPercentage(),
      head: this.head,
      oldestTime: oldest?.openTime ?? null,
      newestTime: newest?.openTime ?? null,
    }
  }
}
