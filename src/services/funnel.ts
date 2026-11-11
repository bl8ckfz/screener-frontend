/**
 * Funnel events: which step of the public pages a visitor reached.
 *
 * Page views and accounts were the only two numbers there were, so a visitor
 * who read the page and left looked the same as one who clicked through to
 * checkout and gave up there. These events are the steps in between.
 *
 * First-party and anonymous, like ./attribution: one POST to our own API, no
 * cookie, no visitor id, nothing sent to an ad network. The backend stores the
 * event name, where on the page it came from and the campaign tags — no IP and
 * no user agent — so the privacy page's "no third-party tracking" stays true.
 *
 * A bare fetch for the same reasons as publicDemoApi: no Authorization header,
 * no interceptors, so counting a click can never log anyone out. And it never
 * throws or rejects: a visitor must not notice, or wait on, a failed count.
 *
 * The event names are also listed in screener-backend
 * (cmd/api-gateway/handlers_funnel.go); one the backend does not know is
 * refused there.
 */
import { getAttribution } from '@/services/attribution'

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080'

export type FunnelEvent =
  | 'landing_view'
  | 'demo_zone_select'
  | 'cta_click'
  | 'checkout_start'
  | 'signup_submit'
  | 'signup_verified'

export interface FunnelProps {
  /** Where on the page it happened: a CheckoutSource, or the screen's name. */
  source?: string
  /** The plan a checkout click was for. */
  plan?: string
}

const UTM_KEYS = ['utm_source', 'utm_campaign', 'utm_content'] as const

/** The campaign tags worth counting by. Click ids stay in the browser. */
function campaignTags(): Record<string, string> | undefined {
  const a = getAttribution()
  if (!a) return undefined
  const tags: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const value = a[key]
    if (value) tags[key] = value
  }
  return Object.keys(tags).length > 0 ? tags : undefined
}

export function trackFunnel(event: FunnelEvent, props: FunnelProps = {}): void {
  try {
    const body = JSON.stringify({
      event,
      source: props.source,
      plan: props.plan,
      // Path only. The query can carry a token (/verify-email?token=…).
      path: window.location.pathname,
      attribution: campaignTags(),
    })
    void fetch(`${BACKEND_URL}/api/public/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'omit',
      // Most of these fire on a click that navigates away (to Whop, to the
      // app); keepalive lets the request finish after the page is gone.
      keepalive: true,
    }).catch(() => {
      // Offline, blocked or rate-limited: the step simply goes uncounted.
    })
  } catch {
    // No fetch, no window: same answer.
  }
}
