/**
 * Campaign attribution: which ad link brought this visitor.
 *
 * First-party only. Nothing here talks to an ad network or sets a cookie — the
 * privacy policy promises no third-party tracking cookies, and this keeps that
 * true. The tags ride along to two places we already own: the Whop checkout
 * link, so Whop's dashboard can say which campaign sold, and the registration
 * request, so the account remembers it.
 *
 * Only visits that carry campaign tags are recorded, and the first one wins
 * for ATTRIBUTION_TTL_DAYS. An organic visit must not displace an ad click
 * that is still being paid for, and a second ad click must not take credit
 * for the trial the first one started.
 */

const STORAGE_KEY = 'cs_attribution'
const ATTRIBUTION_TTL_DAYS = 30
const MAX_VALUE_LENGTH = 100

/** Query parameters worth keeping. Anything else in the URL is ignored. */
const TAG_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'twclid',
  'fbclid',
] as const

/** The subset that is meaningful to Whop. Click ids stay with us. */
const UTM_PARAMS = TAG_PARAMS.filter((p) => p.startsWith('utm_'))

export type Attribution = Partial<Record<(typeof TAG_PARAMS)[number], string>> & {
  /** Path the visitor landed on, without the query. */
  landing: string
  /** Host of the page that linked here, when it was another site. */
  referrer?: string
  /** ISO timestamp of the click. */
  captured_at: string
}

function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_VALUE_LENGTH)
}

function referrerHost(referrer: string, ownHost: string): string | undefined {
  if (!referrer) return undefined
  try {
    const host = new URL(referrer).host
    return host && host !== ownHost ? clean(host) : undefined
  } catch {
    return undefined
  }
}

function isFresh(a: Attribution, now: number): boolean {
  const at = Date.parse(a.captured_at)
  return Number.isFinite(at) && now - at < ATTRIBUTION_TTL_DAYS * 24 * 60 * 60 * 1000
}

/** The stored attribution, or null when there is none, it expired, or storage is unreadable. */
export function getAttribution(now: number = Date.now()): Attribution | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Attribution
    if (!parsed || typeof parsed !== 'object' || typeof parsed.captured_at !== 'string') {
      return null
    }
    return isFresh(parsed, now) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Record this visit if it carries campaign tags and nothing fresher is stored.
 *
 * Called once, before the router mounts: the catch-all route redirects with
 * the query string dropped, so reading it any later can find it already gone.
 */
export function captureAttribution(
  loc: Pick<Location, 'search' | 'pathname' | 'host'> = window.location,
  referrer: string = document.referrer,
  now: number = Date.now(),
): void {
  const params = new URLSearchParams(loc.search)
  const tags: Partial<Record<(typeof TAG_PARAMS)[number], string>> = {}
  for (const key of TAG_PARAMS) {
    const value = params.get(key)
    if (value) {
      const v = clean(value)
      if (v) tags[key] = v
    }
  }
  if (Object.keys(tags).length === 0) return
  if (getAttribution(now)) return

  const record: Attribution = {
    ...tags,
    landing: clean(loc.pathname || '/'),
    captured_at: new Date(now).toISOString(),
  }
  const ref = referrerHost(referrer, loc.host)
  if (ref) record.referrer = ref

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Private mode or blocked storage: the visit simply goes unattributed.
  }
}

/** The stored UTM tags as query pairs, for links that leave the site. */
export function utmParams(now: number = Date.now()): Array<[string, string]> {
  const a = getAttribution(now)
  if (!a) return []
  const pairs: Array<[string, string]> = []
  for (const key of UTM_PARAMS) {
    const value = a[key]
    if (value) pairs.push([key, value])
  }
  return pairs
}
