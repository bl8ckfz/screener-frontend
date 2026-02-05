import type { CombinedAlertType } from './alert'

/**
 * Single alert history entry - immutable record of an alert firing
 */
export interface AlertHistoryEntry {
  id: string // Unique ID: `${timestamp}-${symbol}-${alertType}`
  symbol: string // Coin symbol (e.g., "BTC")
  alertType: CombinedAlertType // Type of alert that triggered
  timestamp: number // When alert fired (milliseconds since epoch)
  priceAtTrigger: number // Coin price when alert triggered
  changePercent: number // 24h price change % at trigger time
  metadata?: {
    // Optional additional data from alert
    value?: number
    threshold?: number
  }
}

/**
 * Aggregated alert statistics for a single coin
 * Used for display in Alert History table
 */
export interface CoinAlertStats {
  symbol: string // Coin symbol
  currentPrice: number // Latest price from live data
  priceChange: number // Current 24h change %
  totalAlerts: number // Total alert count in last 24h
  lastAlertTimestamp: number // Most recent alert time (ms)
  alertTypes: Set<CombinedAlertType> // Unique alert types triggered
  alerts: AlertHistoryEntry[] // Full alert history for this coin (sorted newest first)
}

/**
 * Alert history configuration
 */
export const ALERT_HISTORY_CONFIG = {
  STORAGE_KEY: 'crypto-screener-alert-history',
  RETENTION_HOURS: 24,
  CLEANUP_INTERVAL_MS: 60000, // Cleanup every 60 seconds
  MAX_HISTORY_ITEMS: 5000, // Maximum alerts to keep in storage (increased for high-volatility periods)
} as const
