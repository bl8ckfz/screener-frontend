/**
 * What a subscription includes, how the trial works, and what Pro adds — the
 * one place those answers are written.
 *
 * They used to be written separately on each screen, and they disagreed: the
 * landing page said "one plan … webhook delivery on request" while the app
 * called webhooks a Pro feature; the signup page promised a trial that
 * signing up does not start; and the subscription screen listed momentum
 * alerts but never mentioned the Dojo zones the landing page is about.
 *
 * Facts behind the wording (confirmed with the operator, 2026-09-29):
 * - The trial is a Whop free-trial plan: 7 days, card taken at checkout,
 *   charged automatically when it ends unless cancelled first. The landing
 *   page's checkout link and the in-app one both include it.
 * - Registering here creates an account with no access. Access starts with
 *   the Whop checkout — before registering (matched later by email) or after.
 * - Pro is arranged case by case, on request through Whop. No price is
 *   published, so none is stated here.
 *
 * Prices live in ./plans and are not repeated here.
 */

export const TRIAL_DAYS = 7

export const TRIAL = {
  /** For a CTA button. */
  cta: `Start ${TRIAL_DAYS}-day free trial`,
  /** One line under a CTA. */
  short: `${TRIAL_DAYS} days free · card at checkout · cancel before day ${TRIAL_DAYS} and pay nothing`,
  /** The full terms, for pricing and the FAQ. */
  terms: `Every plan starts with ${TRIAL_DAYS} days free. Checkout runs on Whop and takes your card up front; nothing is charged until the trial ends, and cancelling before then costs nothing. After that the plan renews at its listed price until you cancel.`,
} as const

/** What every subscription (and the trial) includes. */
export const INCLUDED: readonly string[] = [
  'Every Dojo zone as it publishes, with its entry, stop and three targets',
  'The status and outcome of every plan — including stops and zones retired before entry',
  'Nineteen momentum alerts across 200+ Binance USDT perpetuals, 1m to 1h',
  'The live dashboard: charts, watchlist and alert history',
]

/** What Pro adds on top, and how to get it. */
export const PRO = {
  items: [
    'Alerts delivered to your own Discord, Telegram or endpoint (webhooks)',
    'The levels behind each zone’s rating, its volume context and point of control',
  ] as readonly string[],
  /** The items as one sentence, for a screen with room for a line only. */
  summary: 'Pro adds webhook delivery to your own Discord, Telegram or endpoint, and the levels, volume context and point of control behind each zone.',
  how: 'Pro is arranged individually for subscribers — ask us on Whop once your subscription is running. It is not part of the trial.',
} as const
