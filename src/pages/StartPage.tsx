/**
 * Ad landing page: /start?a=scan|record|learn
 *
 * Paid traffic lands here instead of on `/` for one reason: the first thing a
 * visitor reads has to match the ad they clicked. Each ad angle gets its own
 * hero; below it, the page is LandingLayout — the same product argument as
 * `/`, so the two never drift apart.
 *
 * The copy lives in config/startHeroes, under the same rules as the ads.
 */
import { useSearchParams } from 'react-router-dom'
import { LandingLayout } from '@/components/landing/LandingLayout'
import { checkoutLink } from '@/config/checkout'
import { TRIAL } from '@/config/access'
import { START_HEROES, START_STEPS, startAngle } from '@/config/startHeroes'

export function StartPage() {
  const [params] = useSearchParams()
  const hero = START_HEROES[startAngle(params.get('a'))]

  return (
    <LandingLayout>
      <section className="mx-auto max-w-6xl px-4 pb-6 pt-14 sm:px-6 sm:pt-20">
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {hero.title}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-400">{hero.body}</p>

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a
            {...checkoutLink('screener_monthly', 'start')}
            className="rounded bg-[#f5a623] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
          >
            {TRIAL.cta}
          </a>
          <span className="text-sm text-gray-400">{TRIAL.short}</span>
        </div>
        {/* The same-email rule is the step that fails silently after money has
            changed hands, so it sits next to the button, not only in Pricing. */}
        <p className="mt-3 max-w-xl text-sm text-gray-400">
          Checkout runs on Whop — use the same email you will sign up with here. Not financial
          advice; trading involves risk.
        </p>

        <ol className="mt-12 grid gap-6 border-t border-gray-900 pt-8 sm:grid-cols-3">
          {START_STEPS.map((step, i) => (
            <li key={step.title}>
              <p className="font-mono text-sm text-[#f5a623]">{String(i + 1).padStart(2, '0')}</p>
              <h2 className="mt-1 text-base font-medium text-white">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-10 text-sm text-gray-400">Below is the live scanner, not a screenshot.</p>
      </section>
    </LandingLayout>
  )
}
