/**
 * Header and footer for the landing page.
 *
 * Both are quiet on purpose: the panel below the header is the loud thing, and
 * a marketing nav competing with it would only split attention.
 */
import { Link } from 'react-router-dom'
import { checkoutUrl } from '@/config/checkout'
import { Logo } from '@/components/ui'

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-900 bg-black/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo size={24} className="font-semibold tracking-tight text-white" />

        <nav className="flex items-center gap-1 sm:gap-3">
          <a
            href="#pricing"
            className="hidden px-2 py-1.5 text-sm text-gray-400 transition-colors hover:text-white sm:block"
          >
            Pricing
          </a>
          <Link
            to="/login"
            className="px-2 py-1.5 text-sm text-gray-400 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <a
            href={checkoutUrl('screener_monthly', 'hero')}
            className="rounded bg-[#f5a623] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
          >
            Get access
          </a>
        </nav>
      </div>
    </header>
  )
}

export function LandingFooter() {
  return (
    <footer className="border-t border-gray-900 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Lifted verbatim from the previous landing page — this wording reads
            as legally reviewed and is not ours to improve. */}
        <p className="text-xs leading-relaxed text-gray-500">
          <span className="font-semibold text-gray-400">Disclaimer:</span> Coin-Sniffer
          provides market data, alerts, and analytical tools for informational and
          educational purposes only. It does not provide financial, investment, or trading
          advice. Trading cryptocurrencies and futures involves substantial risk, and losses
          can exceed deposits. Past performance and alerts do not guarantee future results.
        </p>

        <div className="flex items-center gap-4 text-sm">
          <Link to="/terms" className="text-gray-400 transition-colors hover:text-white">
            Terms of Service
          </Link>
          <Link to="/privacy" className="text-gray-400 transition-colors hover:text-white">
            Privacy Policy
          </Link>
        </div>

        <p className="text-sm text-gray-600">
          &copy; {new Date().getFullYear()} Coin-Sniffer
        </p>
      </div>
    </footer>
  )
}
