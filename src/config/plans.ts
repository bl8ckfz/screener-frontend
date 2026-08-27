/**
 * Plan pricing — the single source of truth for the frontend.
 *
 * These figures were duplicated across ExpiredPage and BillingPage with a
 * comment on one of them reading "IMPORTANT — Manual price sync required!".
 * They drifted anyway: the TradingView add-on was advertised at $59/mo and
 * $599/yr on one page and $19.99/mo and $219.99/yr on the other, while both
 * buttons opened the same Whop plan. A customer was quoted a price Whop was
 * never going to charge.
 *
 * ⚠️ These must still match the Whop dashboard — that is the only place the
 * customer is actually charged, and nothing here can verify it. Whop plan IDs
 * come from env vars (WHOP_PLAN_TV_MONTHLY and friends) and the slugs below
 * are what the backend maps to them in planIDForSlug.
 *
 * Last verified against Whop: 2026-08-27
 */

export type PlanSlug =
  | 'screener_monthly'
  | 'screener_yearly'
  | 'tv_monthly'
  | 'tv_yearly'
  | 'bundle_monthly'
  | 'bundle_yearly'

export interface PlanPrice {
  /** Amount charged, used for display and for deriving savings. */
  amount: number
  period: 'month' | 'year'
}

export const PLAN_PRICES: Record<PlanSlug, PlanPrice> = {
  screener_monthly: { amount: 39.99, period: 'month' },
  screener_yearly: { amount: 439.99, period: 'year' },
  tv_monthly: { amount: 19.99, period: 'month' },
  tv_yearly: { amount: 219.99, period: 'year' },
  bundle_monthly: { amount: 54.99, period: 'month' },
  bundle_yearly: { amount: 604.99, period: 'year' },
}

/** Trailing ".00" is noise; anything else keeps its cents. */
function money(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`
}

/** Price alone, e.g. "$19.99". */
export function planPrice(slug: PlanSlug): string {
  return money(PLAN_PRICES[slug].amount)
}

/** Period suffix, e.g. "/mo". */
export function planPeriod(slug: PlanSlug): string {
  return PLAN_PRICES[slug].period === 'year' ? '/yr' : '/mo'
}

/** Price with its period, e.g. "$19.99/mo". */
export function planPriceWithPeriod(slug: PlanSlug): string {
  return planPrice(slug) + planPeriod(slug)
}

/**
 * What the yearly plan saves against paying monthly for a year.
 *
 * DERIVED rather than written down, because a hardcoded saving is a third
 * number that can drift from the two it describes — and it did: the
 * TradingView yearly button read "Save $109", which was only ever consistent
 * with the wrong $59/$599 pair.
 */
export function yearlySaving(monthly: PlanSlug, yearly: PlanSlug): string {
  const saved = PLAN_PRICES[monthly].amount * 12 - PLAN_PRICES[yearly].amount
  return money(Math.round(saved * 100) / 100)
}
