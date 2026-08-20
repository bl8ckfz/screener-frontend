/**
 * useDojoSetups
 *
 * Fetches Dojo confluence setups from the backend. Only active when
 * authenticated — the endpoint sits behind auth and subscription middleware.
 *
 * Polls slowly on purpose. The scanner rebuilds once a day at 00:02 UTC, so
 * anything faster than a few minutes is wasted requests against a table that
 * gains a handful of rows a week.
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { backendApi } from '@/services/backendApi'
import type { DojoSetup, DojoOutcome } from '@/types/dojo'

const QUERY_KEY = ['dojoSetups'] as const

/** The scanner publishes once a day; five minutes is already generous. */
const REFETCH_MS = 5 * 60 * 1000

export interface DojoSetupFilters {
  timeframe?: string
  direction?: 'long' | 'short'
  status?: DojoOutcome
}

export function useDojoSetups(filters: DojoSetupFilters = {}) {
  const { isAuthenticated } = useAuth()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...QUERY_KEY, filters] as const,
    queryFn: async () => {
      const res = await backendApi.getDojoSetups({ ...filters, limit: 200 })
      return res.setups ?? []
    },
    enabled: isAuthenticated,
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const setups: DojoSetup[] = data ?? []

  // Hit rate counts RESOLVED trades only. Unfilled zones are excluded rather
  // than counted as losses: price never reached the resting limit, so there
  // was no trade to win or lose, and including them would understate the
  // method rather than measure it.
  const resolved = setups.filter((s) => s.outcome === 'target' || s.outcome === 'stopped')
  const wins = resolved.filter((s) => s.outcome === 'target').length

  const summary = {
    total: setups.length,
    armed: setups.filter((s) => s.outcome === 'unfilled').length,
    open: setups.filter((s) => s.outcome === 'open').length,
    resolved: resolved.length,
    wins,
    hitRate: resolved.length > 0 ? (wins / resolved.length) * 100 : null,
  }

  return { setups, summary, isLoading, isError, error, isAuthenticated, refetch }
}
