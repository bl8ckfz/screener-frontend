/**
 * Checkout links for people who do not have an account yet.
 *
 * The in-app path (authService.createCheckout) calls /api/checkout, which
 * requires a JWT — so it cannot serve the landing page, where nobody is signed
 * in. The anonymous path is Whop's direct link, and it works end to end:
 * the purchase webhook arrives before the account exists, finds no user, and
 * parks the event in pending_whop_events keyed by the buyer's email. When they
 * register with that same email the event replays and activates them.
 *
 * Matching is case-insensitive on both sides, but it is still matching on
 * EMAIL — which is why every CTA here has to tell the buyer to use the same
 * address when they sign up. Get that wrong and the sale completes, the
 * account stays locked, and nobody finds out until they complain.
 */

import { utmParams } from '@/services/attribution'
import { trackFunnel } from '@/services/funnel'

/** Where an anonymous visitor goes to buy. Configured per environment. */
const CHECKOUT_URLS: Record<CheckoutPlan, string | undefined> = {
  screener_monthly: import.meta.env.VITE_WHOP_CHECKOUT_SCREENER_MONTHLY,
  screener_yearly: import.meta.env.VITE_WHOP_CHECKOUT_SCREENER_YEARLY,
}

export type CheckoutPlan = 'screener_monthly' | 'screener_yearly'

/**
 * Where the click came from, appended so Whop's referrer data says which part
 * of the page is doing the selling. The locked zone row and the pricing table
 * are very different intents and it is worth being able to tell them apart.
 */
export type CheckoutSource = 'hero' | 'locked_zone' | 'trade_story' | 'pricing' | 'footer' | 'start'

/**
 * Build the checkout URL, or fall back to signup.
 *
 * The fallback matters: if the env var is unset in some environment, a CTA
 * that goes nowhere is worse than one that goes to registration, where the
 * user can still reach billing.
 *
 * Campaign tags from the visitor's ad click go along too, so Whop's dashboard
 * can say which ad sold — the one record that survives a buyer who checks out
 * and then registers on another device.
 */
export function checkoutUrl(plan: CheckoutPlan, source: CheckoutSource): string {
  const base = CHECKOUT_URLS[plan]
  if (!base) return '/signup'

  const query = new URLSearchParams([['source', source], ...utmParams()])
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}${query.toString()}`
}

/**
 * The props for a checkout `<a>`: where it goes, and a click handler that
 * counts the click before the page is left. Spread onto the link, so no CTA
 * can be added with the URL and without the count.
 */
export function checkoutLink(
  plan: CheckoutPlan,
  source: CheckoutSource,
): { href: string; onClick: () => void } {
  return {
    href: checkoutUrl(plan, source),
    onClick: () => trackFunnel('cta_click', { plan, source }),
  }
}

/** Whether real checkout links are configured in this environment. */
export function hasCheckoutLinks(): boolean {
  return !!CHECKOUT_URLS.screener_monthly
}
