import type { Alert } from '@/types/alert'
import type { Coin } from '@/types/coin'
import type { AlertHistoryEntry, CoinAlertStats } from '@/types/alertHistory'
import { ALERT_HISTORY_CONFIG } from '@/types/alertHistory'

/**
 * Service for managing alert history persistence and aggregation
 * Uses SessionStorage for session-based retention with 24h cleanup
 */
class AlertHistoryService {
  private readonly storageKey = ALERT_HISTORY_CONFIG.STORAGE_KEY
  private readonly retentionMs = ALERT_HISTORY_CONFIG.RETENTION_HOURS * 60 * 60 * 1000
  private readonly maxItems = ALERT_HISTORY_CONFIG.MAX_HISTORY_ITEMS

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
  }

  /**
   * Get all alert history entries (within retention period)
   * @returns Array of alert entries, sorted newest first
   */
  getHistory(): AlertHistoryEntry[] {
    const history = this.loadFromStorage()
    return history.sort((a, b) => b.timestamp - a.timestamp)
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
      this.saveToStorage(validEntries)
    }

    return removedCount
  }

  /**
   * Clear all alert history
   */
  clearHistory(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.storageKey)
    }
  }

  /**
   * Load alert history from SessionStorage
   * Automatically removes expired entries on load
   */
  private loadFromStorage(): AlertHistoryEntry[] {
    if (typeof window === 'undefined') return []

    try {
      const data = sessionStorage.getItem(this.storageKey)
      if (!data) return []

      const entries: AlertHistoryEntry[] = JSON.parse(data)
      const cutoffTime = Date.now() - this.retentionMs

      // Filter out expired entries
      return entries.filter((entry) => entry.timestamp >= cutoffTime)
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
      sessionStorage.setItem(this.storageKey, JSON.stringify(entries))
    } catch (error) {
      console.error('Failed to save alert history:', error)
    }
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
