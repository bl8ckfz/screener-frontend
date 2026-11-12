/**
 * The second call to action on the public pages: a free account.
 *
 * The trial button asks a stranger for a card. This asks for an email address,
 * and it is the step most visitors are actually ready for — so it sits beside
 * the trial button rather than below the fold. Counted like the checkout
 * links, with its own source, so the report can compare the two.
 */
import { Link } from 'react-router-dom'
import { FREE } from '@/config/access'
import { trackFunnel } from '@/services/funnel'

export function FreeSignupLink({ source }: { source: 'hero_free' | 'start_free' | 'pricing_free' }) {
  return (
    <Link
      to="/signup"
      onClick={() => trackFunnel('cta_click', { source })}
      className="rounded border border-gray-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:border-gray-500 hover:bg-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
    >
      {FREE.cta}
    </Link>
  )
}
