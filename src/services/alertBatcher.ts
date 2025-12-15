/**
 * Alert Batching Service for Futures Alerts
 * 
 * Batches alerts over a configurable time window to prevent Discord rate limits
 * and provide better context with summary messages showing alert statistics.
 * 
 * Features:
 * - Collects alerts for 30-60 seconds before sending
 * - Single summary message per batch instead of one per alert
 * - Shows alert count per symbol with recent history (last hour)
 * - Severity breakdown and timeframe analysis
 * - Prevents Discord rate limit issues (5 messages per 5 seconds)
 */

import type { Alert } from '@/types/alert'

interface AlertBatch {
  alerts: Alert[]
  batchStartTime: number
  symbols: Set<string>
}

interface SymbolStats {
  symbol: string
  count: number
  types: Set<string>
  severities: Set<string>
  recentCount: number // Count in last hour
}

interface AlertSummary {
  totalAlerts: number
  batchDuration: number // seconds
  symbolStats: SymbolStats[]
  severityBreakdown: Record<string, number>
  timeframeBreakdown: Record<string, number>
  batchStartTime: number
  batchEndTime: number
}

/**
 * Singleton class for batching futures alerts
 */
class AlertBatcherService {
  private currentBatch: AlertBatch | null = null
  private batchTimeoutId: number | null = null
  private alertHistory: Map<string, number[]> = new Map() // symbol -> timestamps
  private readonly batchWindowMs: number
  private readonly historyWindowMs: number = 60 * 60 * 1000 // 1 hour
  private onBatchReadyCallback: ((summary: AlertSummary, alerts: Alert[]) => void) | null = null

  constructor(batchWindowMs: number = 30000) {
    this.batchWindowMs = batchWindowMs // Default: 30 seconds
  }

  /**
   * Add alert to current batch
   * Starts a new batch if none exists
   */
  addAlert(alert: Alert): void {
    // Initialize batch if needed
    if (!this.currentBatch) {
      this.startNewBatch()
    }

    // Add to current batch
    this.currentBatch!.alerts.push(alert)
    this.currentBatch!.symbols.add(alert.symbol)

    // Track in history for "recent count" calculations
    this.addToHistory(alert.symbol, alert.timestamp)

    console.log(`📦 Added alert to batch: ${alert.symbol} (${alert.type}) - Batch size: ${this.currentBatch!.alerts.length}`)
  }

  /**
   * Register callback for when batch is ready to send
   */
  onBatchReady(callback: (summary: AlertSummary, alerts: Alert[]) => void): void {
    this.onBatchReadyCallback = callback
  }

  /**
   * Start a new batch and schedule its completion
   */
  private startNewBatch(): void {
    const now = Date.now()
    
    this.currentBatch = {
      alerts: [],
      batchStartTime: now,
      symbols: new Set(),
    }

    console.log(`🆕 Started new alert batch (window: ${this.batchWindowMs}ms)`)

    // Schedule batch completion
    if (this.batchTimeoutId !== null) {
      clearTimeout(this.batchTimeoutId)
    }

    this.batchTimeoutId = window.setTimeout(() => {
      this.completeBatch()
    }, this.batchWindowMs)
  }

  /**
   * Complete current batch and send summary
   */
  private completeBatch(): void {
    if (!this.currentBatch || this.currentBatch.alerts.length === 0) {
      console.log('📦 Batch timer expired but no alerts to send')
      this.currentBatch = null
      this.batchTimeoutId = null
      return
    }

    const summary = this.generateSummary(this.currentBatch)
    const alerts = [...this.currentBatch.alerts]

    console.log(`✅ Batch complete: ${alerts.length} alerts from ${summary.symbolStats.length} symbols`)

    // Send to callback
    if (this.onBatchReadyCallback) {
      this.onBatchReadyCallback(summary, alerts)
    }

    // Reset batch
    this.currentBatch = null
    this.batchTimeoutId = null
  }

  /**
   * Generate summary statistics from batch
   */
  private generateSummary(batch: AlertBatch): AlertSummary {
    const now = Date.now()
    const symbolStatsMap = new Map<string, SymbolStats>()
    const severityBreakdown: Record<string, number> = {}
    const timeframeBreakdown: Record<string, number> = {}

    // Process each alert
    for (const alert of batch.alerts) {
      // Symbol statistics
      if (!symbolStatsMap.has(alert.symbol)) {
        symbolStatsMap.set(alert.symbol, {
          symbol: alert.symbol,
          count: 0,
          types: new Set(),
          severities: new Set(),
          recentCount: this.getRecentCount(alert.symbol),
        })
      }
      
      const stats = symbolStatsMap.get(alert.symbol)!
      stats.count++
      stats.types.add(alert.type)
      stats.severities.add(alert.severity)

      // Severity breakdown
      severityBreakdown[alert.severity] = (severityBreakdown[alert.severity] || 0) + 1

      // Timeframe breakdown
      if (alert.timeframe) {
        timeframeBreakdown[alert.timeframe] = (timeframeBreakdown[alert.timeframe] || 0) + 1
      }
    }

    // Sort symbols by alert count (most active first)
    const symbolStats = Array.from(symbolStatsMap.values())
      .sort((a, b) => b.count - a.count)

    return {
      totalAlerts: batch.alerts.length,
      batchDuration: Math.round((now - batch.batchStartTime) / 1000),
      symbolStats,
      severityBreakdown,
      timeframeBreakdown,
      batchStartTime: batch.batchStartTime,
      batchEndTime: now,
    }
  }

  /**
   * Track alert in history for recent count calculations
   */
  private addToHistory(symbol: string, timestamp: number): void {
    if (!this.alertHistory.has(symbol)) {
      this.alertHistory.set(symbol, [])
    }
    
    const history = this.alertHistory.get(symbol)!
    history.push(timestamp)

    // Clean old entries (older than 1 hour)
    const cutoff = timestamp - this.historyWindowMs
    const filtered = history.filter(ts => ts > cutoff)
    this.alertHistory.set(symbol, filtered)
  }

  /**
   * Get count of alerts for symbol in last hour
   */
  private getRecentCount(symbol: string): number {
    const history = this.alertHistory.get(symbol)
    if (!history) return 0

    const cutoff = Date.now() - this.historyWindowMs
    return history.filter(ts => ts > cutoff).length
  }

  /**
   * Force complete current batch immediately (useful for testing)
   */
  flushBatch(): void {
    if (this.batchTimeoutId !== null) {
      clearTimeout(this.batchTimeoutId)
    }
    this.completeBatch()
  }

  /**
   * Get current batch size (for debugging)
   */
  getCurrentBatchSize(): number {
    return this.currentBatch?.alerts.length || 0
  }

  /**
   * Configure batch window duration
   */
  setBatchWindow(ms: number): void {
    if (ms < 10000) {
      console.warn('⚠️ Batch window too short, minimum 10 seconds')
      return
    }
    if (ms > 300000) {
      console.warn('⚠️ Batch window too long, maximum 5 minutes')
      return
    }
    
    // @ts-expect-error - readonly property can be set in constructor
    this.batchWindowMs = ms
    console.log(`⚙️ Alert batch window set to ${ms}ms`)
  }
}

// Export singleton instance
export const alertBatcher = new AlertBatcherService(30000) // 30 second batches

// Export types
export type { AlertSummary, SymbolStats, AlertBatch }
