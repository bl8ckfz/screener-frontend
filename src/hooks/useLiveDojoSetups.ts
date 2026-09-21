/**
 * Which coins currently have a Dojo plan in play, keyed by base symbol.
 *
 * # WHY THIS DOES NOT COME FROM THE ALERT STREAM
 *
 * The alert table's badges are built from alert_history, which the frontend
 * reads over a 48-hour window and the database keeps for seven days. Both are
 * far shorter than a Dojo plan lives. A weekly zone can wait months for price,
 * so its "zone armed" alert ages out long before the plan resolves — and with
 * it, every sign in that table that the coin has a plan at all.
 *
 * The plan itself is in dojo_setups, which deliberately has no retention. So
 * the question "does this coin have a plan in play" is asked of the plans, and
 * the answer stops depending on whether an alert about it happens to still be
 * in the window.
 *
 * # WHY THE SERVER APPLIES THE FILTER
 *
 * status=live is the union of waiting and running. Fetching a recent page and
 * filtering here would reintroduce the same truncation in a new place: with no
 * retention on the table, the live plans are not reliably the recent ones, and
 * the long-lived ones that most need to stay visible would be the first to
 * fall off the end.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { backendApi } from '@/services/backendApi'
import { baseSymbol, isLiveOutcome } from '@/types/dojo'
import type { DojoSetup } from '@/types/dojo'

const QUERY_KEY = ['dojoSetups', 'live'] as const

/**
 * Plans change on the daily pass, and within a minute of a fill. Polling this
 * hard is already generous for a set that moves a handful of times a day.
 */
const REFETCH_MS = 60 * 1000

/**
 * A ceiling, not a window. It bounds a runaway response rather than selecting
 * which plans are returned — the server has already narrowed to the live ones,
 * and a book of more than this many open plans at once is a problem worth
 * seeing rather than silently trimming.
 */
const MAX_LIVE = 500

export interface LiveDojoSetups {
  /** Base symbol (ZETA, not ZETAUSDT) to the plans in play on it. */
  bySymbol: Map<string, DojoSetup[]>
  isLoading: boolean
}

export function useLiveDojoSetups(): LiveDojoSetups {
  const { isAuthenticated } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await backendApi.getDojoSetups({ status: 'live', limit: MAX_LIVE })
      return res.setups ?? []
    },
    enabled: isAuthenticated,
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  })

  const bySymbol = useMemo(() => {
    const m = new Map<string, DojoSetup[]>()
    for (const s of data ?? []) {
      // Belt and braces against a server that does not know status=live.
      //
      // An older API ignores an unrecognised status instead of rejecting it,
      // so during a deploy where the frontend is ahead of the backend this
      // request comes back as "the most recent setups, any outcome". Rendering
      // those would mark resolved plans as in play, which is a worse lie than
      // showing nothing.
      //
      // This is NOT what keeps the list complete — the server filter is, and
      // has to be, because with no retention on dojo_setups the live plans are
      // not the recent ones. This only refuses to believe a resolved plan is
      // live.
      if (!isLiveOutcome(s.outcome)) continue

      // Keyed on the base symbol, because that is what the coin list and the
      // alert table use. dojo_setups stores the full contract symbol.
      const key = baseSymbol(s.symbol)
      const existing = m.get(key)
      if (existing) existing.push(s)
      else m.set(key, [s])
    }
    // Oldest first within a symbol. A plan that has been waiting longest is the
    // one most likely to be forgotten, so it leads rather than being pushed
    // behind whatever armed this morning.
    for (const list of m.values()) {
      list.sort((a, b) => Date.parse(a.fired_at) - Date.parse(b.fired_at))
    }
    return m
  }, [data])

  return { bySymbol, isLoading }
}
