/**
 * Data for the free view and for the daily-email switch.
 *
 * These read /api/free/*, which needs a sign-in but no subscription — so
 * unlike useDojoSetups they work for an account that has never paid. Nothing
 * here touches a paid endpoint; a free account calling one gets a 403.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { backendApi } from '@/services/backendApi'
import type { FreeZonesResponse, FreeRecordResponse, RecordOutcome } from '@/types/free'

/** The server caches the zone list for a minute; asking sooner returns the same bytes. */
const ZONES_REFRESH_MS = 60_000

export function useFreeZones() {
  const { isAuthenticated } = useAuth()
  return useQuery<FreeZonesResponse>({
    queryKey: ['freeZones'],
    queryFn: () => backendApi.getFreeZones(),
    enabled: isAuthenticated,
    staleTime: ZONES_REFRESH_MS,
    refetchInterval: ZONES_REFRESH_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

/** The finished zones, a page at a time. Changing the filter starts a new list. */
export function useFreeRecord(outcome?: RecordOutcome) {
  const { isAuthenticated } = useAuth()
  return useInfiniteQuery<FreeRecordResponse>({
    queryKey: ['freeRecord', outcome ?? 'all'],
    queryFn: ({ pageParam }) =>
      backendApi.getFreeRecord({ outcome, cursor: (pageParam as string) || undefined }),
    initialPageParam: '',
    getNextPageParam: (last) => last.next_cursor || undefined,
    enabled: isAuthenticated,
    // The record gains a row a day at most.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

const DIGEST_KEY = ['digestPreference'] as const

/** The daily-email switch: its current value and a way to change it. */
export function useDigestPreference() {
  const { isAuthenticated } = useAuth()
  const client = useQueryClient()

  const query = useQuery({
    queryKey: DIGEST_KEY,
    queryFn: () => backendApi.getDigestPreference(),
    enabled: isAuthenticated,
    staleTime: Infinity,
    retry: 1,
  })

  const mutation = useMutation({
    mutationFn: (digest: boolean) => backendApi.setDigestPreference(digest),
    // The server's answer is the truth; the switch shows that, not the click.
    onSuccess: (saved) => client.setQueryData(DIGEST_KEY, saved),
  })

  return {
    digest: query.data?.digest,
    isLoading: query.isLoading,
    isError: query.isError || mutation.isError,
    isSaving: mutation.isPending,
    setDigest: (on: boolean) => mutation.mutate(on),
  }
}
