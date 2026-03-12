/**
 * Terms of Service Page
 *
 * Legal terms governing use of the Coin Sniffer platform.
 * Accessible at /terms — linked from signup, landing, and footer.
 */

import { Link } from 'react-router-dom'

export function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-gray-300">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 border-b border-gray-800">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white hover:text-gray-300 transition-colors">
            🔍 Coin Sniffer
          </Link>
          <Link
            to="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500">Last updated: March 12, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using the Coin Sniffer platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.
          </p>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms. We will notify registered users of material changes via email.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">2. Service Description</h2>
          <p>
            Coin Sniffer provides real-time cryptocurrency market data, technical analysis tools, screening filters, and automated alerts for Binance Futures trading pairs. The Service includes:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Real-time price monitoring and alert notifications</li>
            <li>Technical indicator calculations and market screening</li>
            <li>Discord and Telegram webhook integrations</li>
            <li>Optional TradingView indicator add-ons</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">3. Not Financial Advice</h2>
          <p>
            <strong className="text-white">The Service is for informational and educational purposes only.</strong> Coin Sniffer does not provide financial, investment, or trading advice. No content, alerts, indicators, or data presented through the Service should be interpreted as a recommendation to buy, sell, or hold any cryptocurrency or financial instrument.
          </p>
          <p>
            You are solely responsible for your own trading and investment decisions. Always conduct your own research and consult a qualified financial advisor before making any financial decisions.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">4. Risk Disclosure</h2>
          <p>
            Trading cryptocurrencies and futures involves substantial risk of loss and is not suitable for every investor. Key risks include but are not limited to:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Losses can exceed your initial deposit when trading futures with leverage</li>
            <li>Cryptocurrency prices are highly volatile and can change rapidly</li>
            <li>Past performance of any indicator, alert, or strategy does not guarantee future results</li>
            <li>Market data may be delayed, incomplete, or inaccurate</li>
            <li>Technical failures, network issues, or exchange outages may prevent timely execution</li>
          </ul>
          <p>
            You acknowledge that you understand these risks and accept full responsibility for any losses incurred.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">5. Account & Eligibility</h2>
          <p>
            You must be at least 18 years of age (or the age of majority in your jurisdiction) to use the Service. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.
          </p>
          <p>
            You agree to provide accurate registration information and to notify us promptly of any unauthorized use of your account.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">6. Subscriptions & Billing</h2>
          <p>
            The Service is offered on a subscription basis with monthly and yearly billing cycles. Free trials, if offered, automatically convert to paid subscriptions unless canceled before the trial period ends.
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Payments are processed by Whop, our third-party billing provider</li>
            <li>Subscriptions auto-renew unless canceled before the renewal date</li>
            <li>You may cancel at any time through the Billing page or Whop dashboard</li>
            <li>After cancellation, you retain access until the end of the current billing period</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">7. Refund Policy</h2>
          <p>
            Due to the nature of digital services, all sales are generally final. However, we may offer refunds at our sole discretion on a case-by-case basis, particularly if:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>A technical issue prevented you from accessing the Service during a significant portion of your billing period</li>
            <li>You were charged after canceling before the renewal date due to a billing error</li>
          </ul>
          <p>
            To request a refund, contact us within 7 days of the charge. Refund requests for partial billing periods or dissatisfaction with alert performance will not be honored.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">8. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Share, resell, or redistribute any data, alerts, or indicators from the Service</li>
            <li>Use automated tools to scrape, crawl, or extract data from the Service</li>
            <li>Share your account credentials with others or operate multiple accounts</li>
            <li>Attempt to reverse-engineer, decompile, or exploit the Service</li>
            <li>Use the Service for any unlawful purpose or in violation of applicable laws</li>
          </ul>
          <p>
            Violation of these terms may result in immediate account termination without refund.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">9. Service Availability</h2>
          <p>
            We strive to maintain continuous service availability but do not guarantee uninterrupted or error-free operation. The Service depends on third-party data sources (including Binance APIs) and infrastructure that may experience downtime outside our control.
          </p>
          <p>
            We reserve the right to modify, suspend, or discontinue any feature of the Service at any time with reasonable notice. Scheduled maintenance will be announced when possible.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">10. Intellectual Property</h2>
          <p>
            All content, algorithms, indicators, branding, and software comprising the Service are owned by Coin Sniffer or its licensors. Your subscription grants a limited, non-exclusive, non-transferable license to use the Service for personal, non-commercial purposes.
          </p>
          <p>
            TradingView indicators provided through the TV add-on are licensed for personal use only and may not be shared, copied, or redistributed.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">11. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, Coin Sniffer and its operators, affiliates, and licensors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Trading losses or missed opportunities based on alerts or data from the Service</li>
            <li>Loss of profits, data, or goodwill</li>
            <li>Service interruptions or data inaccuracies</li>
          </ul>
          <p>
            <strong className="text-white">Our total aggregate liability is limited to the amount you paid for the Service in the 12 months preceding the claim.</strong>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">12. Disclaimer of Warranties</h2>
          <p>
            The Service is provided <strong className="text-white">"AS IS"</strong> and <strong className="text-white">"AS AVAILABLE"</strong> without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
          </p>
          <p>
            We do not warrant that alerts will be delivered on time, that data will be accurate or complete, or that the Service will meet your specific requirements. No advice or information obtained through the Service creates any warranty not expressly stated in these Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">13. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Coin Sniffer, its operators, and affiliates from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, violation of these Terms, or violation of any third party's rights.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">14. Account Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at any time for violation of these Terms, suspected fraud, or any other reason at our sole discretion. Upon termination:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Access to the Service will be revoked immediately</li>
            <li>No refund will be issued for the remaining billing period</li>
            <li>You remain liable for any outstanding obligations</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">15. Governing Law & Disputes</h2>
          <p>
            These Terms are governed by applicable law. Any disputes arising from these Terms or the Service shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, disputes shall be resolved through binding arbitration, except that either party may seek injunctive relief in a court of competent jurisdiction.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">16. Contact</h2>
          <p>
            For questions about these Terms or the Service, contact us through our Discord community or at the email address provided in your account settings.
          </p>
        </section>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-8 mt-12 flex items-center justify-between text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Coin Sniffer</p>
          <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">
            Privacy Policy →
          </Link>
        </div>
      </main>
    </div>
  )
}
