/**
 * Live data for the landing page.
 *
 * Unauthenticated by design — no useAuth, no `enabled: isAuthenticated`, which
 * is what keeps this usable on a page whose whole job is serving people who
 * have not signed up.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchPublicDemo } from '@/services/publicDemoApi'
import type { PublicDemoResponse } from '@/types/publicDemo'

/** Matches the server's cache TTL: polling faster only ever returns the same bytes. */
const REFRESH_MS = 60_000

export function usePublicDemo(enabled = true) {
  const query = useQuery<PublicDemoResponse>({
    queryKey: ['publicDemo'],
    queryFn: ({ signal }) => fetchPublicDemo(signal),
    enabled,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    // One retry, then stop. The endpoint is rate-limited per IP and a visitor
    // behind CGNAT can share that bucket with strangers — hammering it on
    // failure would turn a slow page into a blocked one.
    retry: 1,
    refetchOnWindowFocus: false,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    /**
     * True when the server assembled a payload without its data sources. The
     * page still renders; it just has less to say.
     */
    isDegraded: !!query.data?.degraded,
  }
}
