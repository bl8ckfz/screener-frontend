import { useMemo } from 'react'
import type { Coin } from '@/types/coin'
import type { CoinAlertStats } from '@/types/alertHistory'
import { alertHistoryService } from '@/services/alertHistoryService'
import { useStore } from './useStore'

/**
 * Hook to compute alert statistics merged with current coin data
 * Automatically refreshes when alerts are added/cleared via store
 * @param coins - Current coin data from market feed
 * @returns Array of CoinAlertStats sorted by alert count (descending)
 */
export function useAlertStats(coins: Coin[]): CoinAlertStats[] {
  const refreshTrigger = useStore((state) => state.alertHistoryRefresh)
  
  return useMemo(() => {
    return alertHistoryService.getCoinStats(coins)
  }, [coins, refreshTrigger])
}
