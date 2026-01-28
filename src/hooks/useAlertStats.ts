import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Coin } from '@/types/coin'
import type { AlertHistoryEntry, CoinAlertStats } from '@/types/alertHistory'
import type { AlertHistoryItem, CombinedAlertType } from '@/types/alert'
import { alertHistoryService } from '@/services/alertHistoryService'
import { alertHistory } from '@/services/alertHistory'
import { USE_BACKEND_API } from '@/services/backendApi'
import { useStore } from './useStore'

/**
 * Hook to compute alert statistics merged with current coin data
 * Automatically refreshes when alerts are added/cleared via store
 * @param coins - Current coin data from market feed
 * @returns Array of CoinAlertStats sorted by alert count (descending)
 */
export function useAlertStats(coins: Coin[]): CoinAlertStats[] {
  const refreshTrigger = useStore((state) => state.alertHistoryRefresh)

  const backendAlertsQuery = useQuery({
    queryKey: ['backendAlerts'],
    queryFn: () => alertHistory.getHistory(),
    enabled: USE_BACKEND_API,
    staleTime: 30000,
    refetchInterval: 30000,
    retry: 2,
  })

  const backendEntries = useMemo(() => {
    if (!USE_BACKEND_API) return []
    const alerts = backendAlertsQuery.data || []
    return alerts.map((alert) => toAlertHistoryEntry(alert))
  }, [backendAlertsQuery.data])

  return useMemo(() => {
    if (USE_BACKEND_API) {
      return aggregateBySymbol(backendEntries, coins)
    }
    return alertHistoryService.getCoinStats(coins)
  }, [coins, refreshTrigger, backendEntries])
}

function toAlertHistoryEntry(alert: AlertHistoryItem): AlertHistoryEntry {
  const symbol = normalizeSymbol(alert.symbol)
  return {
    id: alert.id || `${alert.timestamp}-${symbol}-${alert.type}`,
    symbol,
    alertType: alert.type as CombinedAlertType,
    timestamp: alert.timestamp,
    priceAtTrigger: alert.value ?? 0,
    changePercent: 0,
    metadata: {
      value: alert.value,
      threshold: alert.threshold,
    },
  }
}

function normalizeSymbol(symbol: string): string {
  if (symbol.endsWith('USDT')) return symbol.replace('USDT', '')
  if (symbol.endsWith('FDUSD')) return symbol.replace('FDUSD', '')
  if (symbol.endsWith('TRY')) return symbol.replace('TRY', '')
  return symbol
}

function aggregateBySymbol(entries: AlertHistoryEntry[], currentCoins?: Coin[]): CoinAlertStats[] {
  const grouped = new Map<string, AlertHistoryEntry[]>()

  entries.forEach((entry) => {
    const existing = grouped.get(entry.symbol) || []
    existing.push(entry)
    grouped.set(entry.symbol, existing)
  })

  const stats: CoinAlertStats[] = Array.from(grouped.entries()).map(([symbol, alerts]) => {
    const sortedAlerts = alerts.sort((a, b) => b.timestamp - a.timestamp)
    const latestAlert = sortedAlerts[0]

    return {
      symbol,
      currentPrice: latestAlert.priceAtTrigger,
      priceChange: latestAlert.changePercent,
      totalAlerts: alerts.length,
      lastAlertTimestamp: latestAlert.timestamp,
      alertTypes: new Set(alerts.map((a) => a.alertType)),
      alerts: sortedAlerts,
    }
  })

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
