import type { Alert } from '@/types/alert'
import type { Coin } from '@/types/coin'
import type { AlertHistoryEntry, CoinAlertStats } from '@/types/alertHistory'
import { ALERT_HISTORY_CONFIG } from '@/types/alertHistory'

/**
 * Service for managing alert history persistence and aggregation
 * Uses localStorage for persistence across reloads with 24h cleanup
 */
class AlertHistoryService {
  private readonly storageKey = ALERT_HISTORY_CONFIG.STORAGE_KEY
  private readonly retentionMs = ALERT_HISTORY_CONFIG.RETENTION_HOURS * 60 * 60 * 1000
  private readonly maxItems = ALERT_HISTORY_CONFIG.MAX_HISTORY_ITEMS
  
  // In-memory cache to avoid repeated sessionStorage reads
  private cache: AlertHistoryEntry[] | null = null
  private cacheTimestamp: number = 0
  private readonly CACHE_TTL_MS = 1000 // Cache valid for 1 second

  /**
   * Add new alert to history
   * @param alert - Alert that fired
   * @param coin - Coin data at time of alert
   */
  addAlert(alert: Alert, coin: Coin): void {
    const entry: AlertHistoryEntry = {
      id: `${alert.timestamp}-${alert.symbol}-${alert.type}`,
      symbol: alert.symbol,
      alertType: alert.type,
      timestamp: alert.timestamp,
      priceAtTrigger: coin.lastPrice,
      changePercent: coin.priceChangePercent,
      metadata: {
        value: alert.value,
        threshold: alert.threshold,
      },
    }

    const history = this.loadFromStorage()
    history.push(entry)
    
    // Enforce size limit: keep newest entries if over limit
    if (history.length > this.maxItems) {
      // Sort by timestamp (newest first) and keep only maxItems
      history.sort((a, b) => b.timestamp - a.timestamp)
      history.length = this.maxItems
    }
    
    this.saveToStorage(history)
    this.invalidateCache() // Clear cache after write
  }

  /**
   * Get all alert history entries (within retention period)
   * Uses in-memory cache to avoid repeated sessionStorage reads
   * @returns Array of alert entries, sorted newest first
   */
  getHistory(): AlertHistoryEntry[] {
    // Return cached data if valid
    if (this.cache && Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cache
    }
    
    // Load from storage and cache
    const history = this.loadFromStorage()
    const sorted = history.sort((a, b) => b.timestamp - a.timestamp)
    
    this.cache = sorted
    this.cacheTimestamp = Date.now()
    
    return sorted
  }

  /**
   * Get aggregated alert statistics per coin
   * @param currentCoins - Optional array of current coin data for price updates
   * @returns Array of coin stats, sorted by total alerts (descending)
   */
  getCoinStats(currentCoins?: Coin[]): CoinAlertStats[] {
    const history = this.getHistory()
    const stats = this.aggregateBySymbol(history)

    // Merge with current coin data for latest prices
    if (currentCoins) {
      return stats.map((stat) => {
        const coin = currentCoins.find((c) => c.symbol === stat.symbol)
        if (coin) {
          return {
            ...stat,
            currentPrice: coin.lastPrice,
            priceChange: coin.priceChangePercent,
          }
        }
        return stat
      })
    }

    return stats
  }

  /**
   * Remove alerts older than retention period
   * @returns Number of entries removed
   */
  cleanupOldAlerts(): number {
    const history = this.loadFromStorage()
    const cutoffTime = Date.now() - this.retentionMs
    const validEntries = history.filter((entry) => entry.timestamp >= cutoffTime)

    const removedCount = history.length - validEntries.length
    if (removedCount > 0) {
      console.log(`🧹 Alert cleanup: Removing ${removedCount} alerts older than ${new Date(cutoffTime).toLocaleString()}`)
      console.log(`   Retention: ${this.retentionMs}ms (${ALERT_HISTORY_CONFIG.RETENTION_HOURS}h)`)
      console.log(`   Current time: ${new Date().toLocaleString()}`)
      console.log(`   Cutoff time: ${new Date(cutoffTime).toLocaleString()}`)
      
      // Log removed alerts
      const removed = history.filter((entry) => entry.timestamp < cutoffTime)
      removed.forEach(entry => {
        const age = (Date.now() - entry.timestamp) / (60 * 60 * 1000)
        console.log(`   - ${entry.symbol} ${entry.alertType} at ${new Date(entry.timestamp).toLocaleString()} (${age.toFixed(1)}h old)`)
      })
      
      this.saveToStorage(validEntries)
      this.invalidateCache() // Clear cache after cleanup
    }

    return removedCount
  }

  /**
   * Clear all alert history
   */
  clearHistory(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey)
      this.invalidateCache() // Clear cache
    }
  }

  /**
   * Load alert history from SessionStorage
   * Automatically removes expired entries on load
   */
  private loadFromStorage(): AlertHistoryEntry[] {
    if (typeof window === 'undefined') return []

    try {
      const data = localStorage.getItem(this.storageKey)
      if (!data) return []

      const entries: AlertHistoryEntry[] = JSON.parse(data)
      const cutoffTime = Date.now() - this.retentionMs
      const beforeCount = entries.length

      // Filter out expired entries
      const filtered = entries.filter((entry) => entry.timestamp >= cutoffTime)
      
      if (filtered.length < beforeCount) {
        const removed = beforeCount - filtered.length
        console.log(`⚠️  loadFromStorage filtered out ${removed} expired alerts (cutoff: ${new Date(cutoffTime).toLocaleString()})`)
      }
      
      return filtered
    } catch (error) {
      console.error('Failed to load alert history:', error)
      return []
    }
  }

  /**
   * Save alert history to SessionStorage
   */
  private saveToStorage(entries: AlertHistoryEntry[]): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(entries))
    } catch (error) {
      console.error('Failed to save alert history:', error)
    }
  }

  /**
   * Invalidate in-memory cache
   * Called after write operations to ensure fresh data on next read
   */
  private invalidateCache(): void {
    this.cache = null
    this.cacheTimestamp = 0
  }

  /**
   * Aggregate alert entries by symbol
   * @returns Array of CoinAlertStats sorted by total alerts (descending)
   */
  private aggregateBySymbol(entries: AlertHistoryEntry[]): CoinAlertStats[] {
    const grouped = new Map<string, AlertHistoryEntry[]>()

    // Group by symbol
    entries.forEach((entry) => {
      const existing = grouped.get(entry.symbol) || []
      existing.push(entry)
      grouped.set(entry.symbol, existing)
    })

    // Create stats for each coin
    const stats: CoinAlertStats[] = Array.from(grouped.entries()).map(([symbol, alerts]) => {
      const sortedAlerts = alerts.sort((a, b) => b.timestamp - a.timestamp)
      const latestAlert = sortedAlerts[0]

      return {
        symbol,
        currentPrice: latestAlert.priceAtTrigger, // Will be updated with live data
        priceChange: latestAlert.changePercent, // Will be updated with live data
        totalAlerts: alerts.length,
        lastAlertTimestamp: latestAlert.timestamp,
        alertTypes: new Set(alerts.map((a) => a.alertType)),
        alerts: sortedAlerts,
      }
    })

    // Sort by total alerts descending
    return stats.sort((a, b) => b.totalAlerts - a.totalAlerts)
  }
}

// Export singleton instance
export const alertHistoryService = new AlertHistoryService()
