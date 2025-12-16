/**
 * Memory Profiling Utility
 * Tracks memory usage over time and alerts on excessive growth
 * Only active in development mode
 */

import { debug } from './debug'

interface MemorySample {
  timestamp: number
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

class MemoryProfiler {
  private samples: MemorySample[] = []
  private readonly maxSamples = 100 // Keep last 100 samples
  private readonly sampleInterval = 60000 // Sample every minute
  private intervalId: number | null = null
  private startMemory: number = 0
  private readonly GROWTH_THRESHOLD_MB = 50 // Alert if growth > 50MB
  private readonly isDev = import.meta.env.DEV

  start() {
    if (!this.isDev || !this.isMemoryAPISupported()) {
      return
    }

    // Record initial memory
    const initial = this.getCurrentMemory()
    if (initial) {
      this.startMemory = initial.usedJSHeapSize
      this.samples.push(initial)
      debug.log('📊 Memory profiling started:', this.formatBytes(this.startMemory))
    }

    // Start periodic sampling
    this.intervalId = window.setInterval(() => {
      this.sample()
    }, this.sampleInterval)
  }

  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.samples.length > 0) {
      this.printSummary()
    }
  }

  private sample() {
    const memory = this.getCurrentMemory()
    if (!memory) return

    this.samples.push(memory)

    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }

    // Check for excessive growth
    this.checkGrowth(memory)

    // Log current stats every 5 minutes
    if (this.samples.length % 5 === 0) {
      this.logCurrentStats(memory)
    }
  }

  private getCurrentMemory(): MemorySample | null {
    if (!this.isMemoryAPISupported()) return null

    const mem = (performance as any).memory
    return {
      timestamp: Date.now(),
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
      jsHeapSizeLimit: mem.jsHeapSizeLimit,
    }
  }

  private checkGrowth(current: MemorySample) {
    if (this.samples.length < 2) return

    const growthMB = (current.usedJSHeapSize - this.startMemory) / (1024 * 1024)
    
    if (growthMB > this.GROWTH_THRESHOLD_MB) {
      debug.warn(
        `⚠️  Memory growth detected: +${growthMB.toFixed(1)}MB since start`,
        `(${this.formatBytes(this.startMemory)} → ${this.formatBytes(current.usedJSHeapSize)})`
      )
    }

    // Check for rapid growth (>10MB in last minute)
    if (this.samples.length >= 2) {
      const prev = this.samples[this.samples.length - 2]
      const rapidGrowthMB = (current.usedJSHeapSize - prev.usedJSHeapSize) / (1024 * 1024)
      
      if (rapidGrowthMB > 10) {
        debug.warn(`🚨 Rapid memory growth: +${rapidGrowthMB.toFixed(1)}MB in last minute`)
      }
    }
  }

  private logCurrentStats(current: MemorySample) {
    const growthMB = (current.usedJSHeapSize - this.startMemory) / (1024 * 1024)
    const utilizationPct = (current.usedJSHeapSize / current.jsHeapSizeLimit) * 100

    debug.log(
      `📊 Memory: ${this.formatBytes(current.usedJSHeapSize)} / ${this.formatBytes(current.jsHeapSizeLimit)}`,
      `(${utilizationPct.toFixed(1)}% utilized, +${growthMB.toFixed(1)}MB growth)`
    )
  }

  private printSummary() {
    if (this.samples.length === 0) return

    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    const durationMin = (last.timestamp - first.timestamp) / 60000
    const growthMB = (last.usedJSHeapSize - first.usedJSHeapSize) / (1024 * 1024)
    const avgUsed = this.samples.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / this.samples.length

    debug.log('📊 Memory Profiling Summary:')
    debug.log(`   Duration: ${durationMin.toFixed(1)} minutes`)
    debug.log(`   Initial: ${this.formatBytes(first.usedJSHeapSize)}`)
    debug.log(`   Final: ${this.formatBytes(last.usedJSHeapSize)}`)
    debug.log(`   Growth: ${growthMB > 0 ? '+' : ''}${growthMB.toFixed(1)}MB`)
    debug.log(`   Average: ${this.formatBytes(avgUsed)}`)
    debug.log(`   Samples: ${this.samples.length}`)
  }

  getStats() {
    if (this.samples.length === 0) return null

    const current = this.samples[this.samples.length - 1]
    const growthMB = (current.usedJSHeapSize - this.startMemory) / (1024 * 1024)

    return {
      currentMB: current.usedJSHeapSize / (1024 * 1024),
      startMB: this.startMemory / (1024 * 1024),
      growthMB,
      utilizationPct: (current.usedJSHeapSize / current.jsHeapSizeLimit) * 100,
      samples: this.samples.length,
    }
  }

  private formatBytes(bytes: number): string {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)}MB`
  }

  private isMemoryAPISupported(): boolean {
    return 'memory' in performance
  }
}

// Singleton instance
export const memoryProfiler = new MemoryProfiler()

// Auto-start in development
if (import.meta.env.DEV) {
  // Start profiling after a short delay to avoid affecting initial load
  setTimeout(() => memoryProfiler.start(), 5000)
  
  // Stop profiling on page unload
  window.addEventListener('beforeunload', () => memoryProfiler.stop())
}
