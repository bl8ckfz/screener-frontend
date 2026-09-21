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
import type { DojoSetup, DojoOutcome, DojoSummary } from '@/types/dojo'

const QUERY_KEY = ['dojoSetups'] as const
const SUMMARY_KEY = ['dojoSummary'] as const

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

  // The counts come from the BACKEND, over the whole filtered population.
  //
  // They used to be derived here, from `setups` — which is one capped,
  // recency-ordered page. So the denominator moved with the view: filtering by
  // timeframe silently changed the hit rate, and a method with hundreds of
  // resolved trades reported whichever 200 rows had loaded. A number presented
  // as the method's performance was describing the current page, which is
  // worse than showing nothing because it looks like it means something.
  //
  // Same filters, through the same clause builder on the server, so the
  // summary always describes the rows the table is showing.
  const summaryQuery = useQuery({
    queryKey: [...SUMMARY_KEY, filters] as const,
    queryFn: () => backendApi.getDojoSummary(filters),
    enabled: isAuthenticated,
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  return {
    setups,
    /**
     * Undefined until it loads, and it must render as "—" rather than as
     * zeros. Zeros would read as "no trades", which is a claim about the
     * method rather than about the request.
     */
    summary: summaryQuery.data as DojoSummary | undefined,
    isSummaryLoading: summaryQuery.isLoading,
    isLoading,
    isError,
    error,
    isAuthenticated,
    refetch,
  }
}
