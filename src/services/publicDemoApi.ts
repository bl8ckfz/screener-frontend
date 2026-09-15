/**
 * The landing page's data client.
 *
 * WHY THIS DOES NOT USE backendApi
 *
 * Two reasons, and the first one is a real bug waiting to happen:
 *
 *  1. backendApi attaches `Authorization: Bearer <token>` whenever a token
 *     exists, and calls authService.logout() on ANY 401. A visitor who once
 *     had an account still has a token in localStorage, possibly expired —
 *     so fetching demo data through that client could log someone out from a
 *     marketing page they were only browsing.
 *
 *  2. An Authorization header makes the response uncacheable by any CDN in
 *     front of the API, and this payload is identical for every visitor. That
 *     shared cache is the whole reason the endpoint is cheap.
 *
 * So: a bare fetch, no credentials, no interceptors, no auth imports at all.
 */
import type { PublicDemoResponse } from '@/types/publicDemo'

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080'

/** Long enough for a cold cache rebuild, short enough that the hero isn't held hostage. */
const TIMEOUT_MS = 8000

export class PublicDemoError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'PublicDemoError'
  }
}

export async function fetchPublicDemo(signal?: AbortSignal): Promise<PublicDemoResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  // Respect a caller's abort (react-query unmount) as well as our own timeout.
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const res = await fetch(`${BACKEND_URL}/api/public/demo`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      // Explicit: no cookies, no Authorization. See the file header.
      credentials: 'omit',
    })

    if (!res.ok) {
      throw new PublicDemoError(`demo request failed: ${res.status}`, res.status)
    }
    return (await res.json()) as PublicDemoResponse
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
