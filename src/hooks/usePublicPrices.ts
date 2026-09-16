/**
 * Live prices for the landing page demo.
 *
 * Separate from usePublicDemo on purpose. That payload carries zones, four
 * hundred candles a symbol and the outcome counts, so it is cached a minute at
 * both ends — right for data that changes once a day, and completely wrong for
 * a price. Polled at that cadence the price on a page calling itself live moved
 * once a minute at best.
 *
 * This asks for prices alone, which is one Redis read on the server and costs
 * nothing at Binance.
 */
import { useQuery } from '@tanstack/react-query'

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080'

/** Matches the endpoint's own Cache-Control; asking faster cannot be fresher. */
const REFRESH_MS = 5000

interface PublicPrices {
  prices: Record<string, number>
  generated_at: string
}

export function usePublicPrices(enabled = true) {
  const query = useQuery<PublicPrices>({
    queryKey: ['publicPrices'],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${BACKEND_URL}/api/public/prices`, {
        signal,
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`prices request failed: ${res.status}`)
      return res.json()
    },
    enabled,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    // One retry then stop. This is decoration on a marketing page — it must
    // never become a source of load, and a stale price is better than a
    // hammered endpoint.
    retry: 1,
    refetchOnWindowFocus: false,
  })

  return query.data?.prices ?? {}
}
