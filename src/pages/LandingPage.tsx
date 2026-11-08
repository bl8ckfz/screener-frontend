/**
 * Landing Page
 *
 * The page's argument is the panel, not the copy: a visitor sees the actual
 * scanner output — real chart, real zones, real outcomes including the losses —
 * before they read a word of persuasion. Zones still waiting for price have
 * their levels withheld by the server, and that locked row is the strongest
 * call to action on the page.
 *
 * Only the hero is this page's own; everything below it is LandingLayout,
 * shared with the ad landing page.
 */
import { LandingLayout } from '@/components/landing/LandingLayout'
import { checkoutUrl } from '@/config/checkout'
import { TRIAL } from '@/config/access'

export function LandingPage() {
  return (
    <LandingLayout>
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-14 sm:px-6 sm:pt-20">
        {/* Leads with the job, not the machinery. The scan count used to be the
            headline and "usually it finds nothing" the first sentence — both
            true, neither saying what a visitor would do with it each day. */}
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Find setups worth watching. Know the plan. See what happened.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-400">
          Every day the scanner checks 200+ Binance futures pairs. When a zone qualifies you
          get the entry, the stop and three targets the same day — then its status as price
          arrives, and a public record of how it ended, losses included.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a
            href={checkoutUrl('screener_monthly', 'hero')}
            className="rounded bg-[#f5a623] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
          >
            {TRIAL.cta}
          </a>
          <span className="text-sm text-gray-400">{TRIAL.short}</span>
        </div>
        <p className="mt-3 text-sm text-gray-400">
          Below is the live scanner, not a screenshot.
        </p>
      </section>
    </LandingLayout>
  )
}
