/**
 * Pricing, and the one instruction that keeps a sale from going missing.
 *
 * An anonymous buyer reaches Whop before they have an account here. The webhook
 * arrives first, finds no user, and parks the purchase against the EMAIL they
 * paid with; registering with that same address replays it and unlocks the
 * account. Which means the email instruction below is not boilerplate — it is
 * the step that fails silently when skipped, and it fails after the money has
 * changed hands.
 */
import { planPrice, planPeriod, yearlySaving } from '@/config/plans'
import { checkoutUrl } from '@/config/checkout'

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-gray-900 bg-[#08090b]">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Pricing
        </h2>
        <p className="mt-3 max-w-prose text-gray-400">
          One plan. Every zone, every alert, the dashboard, and webhook delivery on request.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-800 p-6">
            <h3 className="text-sm text-gray-400">Monthly</h3>
            <p className="mt-2">
              <span className="font-mono text-4xl text-white">{planPrice('screener_monthly')}</span>
              <span className="text-gray-500">{planPeriod('screener_monthly')}</span>
            </p>
            <a
              href={checkoutUrl('screener_monthly', 'pricing')}
              className="mt-6 block rounded bg-[#f5a623] px-4 py-2.5 text-center text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
            >
              Get access
            </a>
          </div>

          <div className="rounded-lg border border-[#f5a623]/40 p-6">
            <h3 className="text-sm text-gray-400">
              Yearly
              <span className="ml-2 text-[#f5a623]">
                save {yearlySaving('screener_monthly', 'screener_yearly')}
              </span>
            </h3>
            <p className="mt-2">
              <span className="font-mono text-4xl text-white">{planPrice('screener_yearly')}</span>
              <span className="text-gray-500">{planPeriod('screener_yearly')}</span>
            </p>
            <a
              href={checkoutUrl('screener_yearly', 'pricing')}
              className="mt-6 block rounded bg-[#f5a623] px-4 py-2.5 text-center text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
            >
              Get access
            </a>
          </div>
        </div>

        <p className="mt-6 max-w-prose text-sm leading-relaxed text-gray-400">
          Checkout runs on Whop. <span className="text-white">Use the same email address
          you will sign up with here</span> — that is how your purchase finds your account.
        </p>
      </div>
    </section>
  )
}
