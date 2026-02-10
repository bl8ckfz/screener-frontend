/**
 * Alert History Service
 * 
 * Fetches alert history from backend API (screener-backend)
 * Backend stores alerts in TimescaleDB for 48-hour retention
 */

import { backendApi } from './backendApi'
import type { AlertHistoryItem } from '@/types/alert'

/**
 * Backend Alert structure (from Go backend)
 */
interface BackendAlert {
  id: string
  symbol: string
  rule_type: string
  description: string
  timestamp: string
  price: number
  metadata?: Record<string, any>
}

/**
 * Alert History Service - Communicates with backend API
 */
export class AlertHistory {
  private readonly retentionHours = 48
  /**
   * Get alert history from backend (last 48 hours)
   */
  async getHistory(): Promise<AlertHistoryItem[]> {
    try {
      const since = new Date(Date.now() - this.retentionHours * 60 * 60 * 1000).toISOString()
      const alerts = await backendApi.getAlertHistory({
        limit: 2000, // Increased from 500 to show more historical data
        since,
      }) as unknown as BackendAlert[]

      // Transform backend Alert format to AlertHistoryItem
      return alerts.map(alert => this.transformBackendAlert(alert))
    } catch (error) {
      console.error('Failed to fetch alert history:', error)
      return []
    }
  }

  /**
   * Get alerts for a specific symbol
   */
  async getAllBySymbol(symbol: string): Promise<AlertHistoryItem[]> {
    try {
      const since = new Date(Date.now() - this.retentionHours * 60 * 60 * 1000).toISOString()
      const alerts = await backendApi.getAlertHistory({
        symbol,
        limit: 2000,
        since,
      }) as unknown as BackendAlert[]
      
      return alerts.map(alert => this.transformBackendAlert(alert))
    } catch (error) {
      // Silently return empty array for timeout errors (common during network issues)
      if (error instanceof Error && error.message.includes('timeout')) {
        return []
      }
      console.error(`Failed to fetch alerts for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Get alert statistics
   */
  async getStats(): Promise<any> {
    try {
      const alerts = await this.getHistory()
      
      // Calculate stats from fetched alerts
      const totalAlerts = alerts.length
      const byType: Record<string, number> = {}
      const bySymbol: Record<string, number> = {}
      const bySeverity: Record<string, number> = {}
      
      alerts.forEach(alert => {
        byType[alert.type] = (byType[alert.type] || 0) + 1
        bySymbol[alert.symbol] = (bySymbol[alert.symbol] || 0) + 1
        bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1
      })
      
      return {
        totalAlerts,
        byType,
        bySymbol,
        bySeverity,
        lastUpdated: Date.now(),
      }
    } catch (error) {
      console.error('Failed to calculate alert stats:', error)
      return {
        totalAlerts: 0,
        byType: {},
        bySymbol: {},
        bySeverity: {},
        lastUpdated: Date.now(),
      }
    }
  }

  /**
   * Add alert to history (backend handles this via NATS)
   * This is a no-op since backend automatically stores alerts
   */
  async addToHistory(_alert: any): Promise<void> {
    // Backend automatically stores alerts from NATS stream
    // No client-side action needed
  }

  /**
   * Export history as CSV (not yet implemented)
   */
  async exportHistoryAsCSV(): Promise<string> {
    const alerts = await this.getHistory()
    // TODO: Implement CSV export
    const header = 'Symbol,Type,Price,Timestamp,Severity\n'
    const rows = alerts.map(a => 
      `${a.symbol},${a.type},${a.value},${new Date(a.timestamp).toISOString()},${a.severity}`
    ).join('\n')
    return header + rows
  }

  /**
   * Export history as JSON
   */
  async exportHistory(): Promise<string> {
    const alerts = await this.getHistory()
    return JSON.stringify(alerts, null, 2)
  }

  /**
   * Clear alerts (not supported - backend has retention policy)
   */
  async clear(): Promise<void> {
    console.warn('clear() not supported - backend has 48-hour retention policy')
  }

  /**
   * Clear alert history (not supported - backend has retention policy)
   */
  async clearHistory(): Promise<void> {
    console.warn('clearHistory() not supported - backend has 48-hour retention policy')
  }

  /**
   * Clear old history (not needed - backend auto-deletes after 48h)
   */
  async clearOldHistory(_days: number): Promise<void> {
    console.warn('clearOldHistory() not needed - backend auto-deletes after 48h')
  }

  /**
   * Clear by type (not supported)
   */
  async clearByType(_type: string): Promise<void> {
    console.warn('clearByType() not supported')
  }

  /**
   * Clear by symbol (not supported)
   */
  async clearBySymbol(_symbol: string): Promise<void> {
    console.warn('clearBySymbol() not supported')
  }

  /**
   * Transform backend alert to AlertHistoryItem
   */
  private transformBackendAlert(alert: BackendAlert): AlertHistoryItem {
    return {
      id: alert.id,
      symbol: alert.symbol,
      type: alert.rule_type as any, // Type will be validated by frontend
      severity: this.determineSeverity(alert.rule_type),
      title: this.generateTitle(alert.rule_type),
      message: alert.description || `${alert.rule_type} alert`,
      value: alert.price,
      threshold: 0, // Not provided by backend
      timestamp: new Date(alert.timestamp).getTime(),
      read: false,
      dismissed: false,
      source: 'main',
    }
  }

  /**
   * Generate human-readable title from rule type
   */
  private generateTitle(ruleType: string): string {
    const titles: Record<string, string> = {
      'big_bull_60m': 'Big Bull 60m',
      'big_bear_60m': 'Big Bear 60m',
      'pioneer_bull': 'Pioneer Bull',
      'pioneer_bear': 'Pioneer Bear',
      'whale': 'Whale Alert',
      'volume_spike': 'Volume Spike',
      'bubble_signal': 'Bubble Signal',
    }
    return titles[ruleType] || ruleType.replace(/_/g, ' ').toUpperCase()
  }

  /**
   * Determine alert severity from rule type
   */
  private determineSeverity(ruleType: string): 'high' | 'medium' | 'low' {
    const highSeverity = ['big_bull_60m', 'big_bear_60m', 'whale', 'bubble_signal']
    const mediumSeverity = ['pioneer_bull', 'pioneer_bear', 'volume_spike']
    
    if (highSeverity.includes(ruleType)) return 'high'
    if (mediumSeverity.includes(ruleType)) return 'medium'
    return 'low'
  }
}

export const alertHistory = new AlertHistory()
