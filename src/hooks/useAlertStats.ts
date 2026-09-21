import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Coin } from '@/types/coin'
import type { AlertHistoryEntry, CoinAlertStats } from '@/types/alertHistory'
import type { AlertHistoryItem, CombinedAlertType } from '@/types/alert'
import { alertHistoryService } from '@/services/alertHistoryService'
import { alertHistory } from '@/services/alertHistory'
import { USE_BACKEND_API } from '@/services/backendApi'
import { useStore } from './useStore'
import { useAlertRules } from './useAlertRules'
import { useLiveDojoSetups } from './useLiveDojoSetups'
import type { DojoSetup } from '@/types/dojo'

/**
 * Hook to compute alert statistics merged with current coin data
 * Automatically refreshes when alerts are added/cleared via store
 * @param coins - Current coin data from market feed
 * @returns Array of CoinAlertStats sorted by alert count (descending)
 */
export function useAlertStats(coins: Coin[]): CoinAlertStats[] {
  const refreshTrigger = useStore((state) => state.alertHistoryRefresh)
  const { isRuleEnabled } = useAlertRules()

  const backendAlertsQuery = useQuery({
    queryKey: ['backendAlerts'],
    queryFn: () => alertHistory.getHistory(),
    enabled: USE_BACKEND_API,
    staleTime: 5000,
    refetchInterval: 5000,
    retry: 2,
  })

  const backendEntries = useMemo(() => {
    if (!USE_BACKEND_API) return []
    const alerts = backendAlertsQuery.data || []
    return alerts
      .filter((alert) => isRuleEnabled(alert.type))
      .map((alert) => toAlertHistoryEntry(alert))
  }, [backendAlertsQuery.data, isRuleEnabled])

  // Coins with a Dojo plan in play, so they get a row even when nothing has
  // fired for them recently. See withLivePlanRows.
  const { bySymbol: livePlans } = useLiveDojoSetups()

  return useMemo(() => {
    const base = USE_BACKEND_API
      ? aggregateBySymbol(backendEntries, coins)
      : alertHistoryService.getCoinStats(coins)
    return withLivePlanRows(base, livePlans, coins)
  }, [coins, refreshTrigger, backendEntries, livePlans])
}

/**
 * Adds a row for every coin that has a Dojo plan in play but nothing in the
 * alert window.
 *
 * WHY A ROW HAS TO BE INVENTED AT ALL
 *
 * Every row above comes from an alert, read over 48 hours from a table kept for
 * seven days. A Dojo plan outlives both: a weekly zone can wait months for
 * price, doing nothing and firing nothing the whole time. So the coins whose
 * plans have been waiting longest — the ones most easily forgotten — were
 * exactly the ones with no row, and pinning a badge to a row that does not
 * exist shows nothing.
 *
 * The row is honest about what it is. totalAlerts is 0 because no alert fired,
 * alertTypes is empty for the same reason, and the plan badges rendered beside
 * them come from dojo_setups rather than from anything in this list.
 */
export function withLivePlanRows(
  stats: CoinAlertStats[],
  livePlans: Map<string, DojoSetup[]>,
  currentCoins?: Coin[]
): CoinAlertStats[] {
  if (livePlans.size === 0) return stats

  const present = new Set(stats.map((s) => s.symbol))
  const added: CoinAlertStats[] = []

  for (const [symbol, setups] of livePlans) {
    if (present.has(symbol) || setups.length === 0) continue

    const coin = currentCoins?.find((c) => c.symbol === symbol)
    // Falls back to the close when the zone armed. A plan can outlive its
    // symbol's place in the tracked universe, so there may be no live price —
    // and a stale price is better than a zero, which reads as a real one.
    const fallback = setups[setups.length - 1]

    added.push({
      symbol,
      currentPrice: coin?.lastPrice ?? fallback.trigger_price ?? 0,
      priceChange: coin?.priceChangePercent ?? 0,
      // Truthfully zero: nothing has fired for this coin inside the window.
      // The row is here for the plan, not for an alert.
      totalAlerts: 0,
      // The plan's own most recent moment, so sorting by "Latest" places the
      // row sensibly instead of pinning every plan-only coin to the bottom on
      // a timestamp of zero.
      lastAlertTimestamp: lastPlanEvent(setups),
      alertTypes: new Set<CombinedAlertType>(),
      alerts: [],
    })
  }

  return added.length > 0 ? [...stats, ...added] : stats
}

/** The most recent thing that happened to any of a coin's live plans. */
function lastPlanEvent(setups: DojoSetup[]): number {
  let latest = 0
  for (const s of setups) {
    // A fill outranks the publication: it is the later event and the more
    // interesting one.
    for (const iso of [s.fired_at, s.entry_hit_at]) {
      if (!iso) continue
      const t = Date.parse(iso)
      if (!Number.isNaN(t) && t > latest) latest = t
    }
  }
  return latest
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
    // Kept, so the alert can still be opened as the plan it refers to. This
    // transform is the third place an alert is reshaped on its way to the
    // screen, and it used to be where the Dojo context was finally lost even
    // when the two before it had preserved it.
    dojo: alert.dojo,
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

  // Exclude generic whale_detector — replaced by directional accumulation/distribution
  entries
    .filter(entry => entry.alertType !== 'futures_whale_detector')
    .forEach((entry) => {
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
