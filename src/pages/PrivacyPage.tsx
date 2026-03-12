/**
 * Privacy Policy Page
 *
 * Describes how Coin Sniffer collects, uses, and protects user data.
 * Accessible at /privacy — linked from signup, landing, and footer.
 */

import { Link } from 'react-router-dom'

export function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Last updated: March 12, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">1. Information We Collect</h2>

          <h3 className="text-lg font-medium text-gray-200">1.1 Account Information</h3>
          <p>When you create an account, we collect:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Email address (used for account authentication and communications)</li>
            <li>Password (stored as a salted hash — we never store plaintext passwords)</li>
            <li>TradingView username (if you subscribe to the TV indicator add-on)</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-200">1.2 Billing Information</h3>
          <p>
            Payment processing is handled entirely by our third-party provider, <strong className="text-white">Whop</strong>. We do not collect, store, or have access to your credit card numbers or bank details. We receive only:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Subscription plan and status</li>
            <li>Billing period dates</li>
            <li>Whop membership identifiers</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-200">1.3 Usage Data</h3>
          <p>We may automatically collect:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Alert configuration preferences (alert types, thresholds, enabled pairs)</li>
            <li>Watchlist selections</li>
            <li>Webhook URLs you configure for Discord or Telegram notifications</li>
            <li>Basic analytics data (page views, feature usage) to improve the Service</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-200">1.4 Technical Data</h3>
          <p>
            When you use the Service, our servers may log your IP address, browser type, and device information for security and troubleshooting purposes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">2. How We Use Your Information</h2>
          <p>We use collected information to:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Provide and maintain the Service (authentication, alert delivery, data display)</li>
            <li>Process subscriptions and manage your account</li>
            <li>Send alert notifications through your configured webhooks</li>
            <li>Grant access to TradingView indicators (using your TV username)</li>
            <li>Communicate important account or service updates via email</li>
            <li>Improve the Service based on usage patterns</li>
            <li>Detect and prevent fraud or abuse</li>
          </ul>
          <p>
            <strong className="text-white">We will never sell your personal information to third parties.</strong>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">3. Third-Party Services</h2>
          <p>We share data with the following third-party services only as necessary to operate the Service:</p>

          <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 space-y-3">
            <div>
              <strong className="text-white">Supabase</strong> — Authentication & database
              <p className="text-sm text-gray-500">Stores account data. Subject to <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Supabase Privacy Policy</a>.</p>
            </div>
            <div>
              <strong className="text-white">Whop</strong> — Payment processing
              <p className="text-sm text-gray-500">Handles billing and subscriptions. Subject to <a href="https://whop.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Whop Privacy Policy</a>.</p>
            </div>
            <div>
              <strong className="text-white">Discord / Telegram</strong> — Webhook delivery
              <p className="text-sm text-gray-500">Alert notifications are sent to webhook URLs you provide. We do not access your Discord or Telegram accounts.</p>
            </div>
            <div>
              <strong className="text-white">Vercel</strong> — Hosting
              <p className="text-sm text-gray-500">Frontend hosting and CDN. Subject to <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Vercel Privacy Policy</a>.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">4. Data Retention</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li><strong className="text-gray-200">Account data:</strong> Retained while your account is active and for 30 days after deletion request</li>
            <li><strong className="text-gray-200">Alert history:</strong> Retained for up to 48 hours for real-time data, longer for historical records</li>
            <li><strong className="text-gray-200">Billing records:</strong> Retained as required by applicable tax and financial regulations</li>
            <li><strong className="text-gray-200">Server logs:</strong> Automatically purged after 90 days</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">5. Data Security</h2>
          <p>We implement reasonable security measures to protect your information, including:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Encrypted data transmission (HTTPS/TLS)</li>
            <li>Secure password hashing (bcrypt)</li>
            <li>JWT-based authentication with token expiration</li>
            <li>Role-based access controls on backend systems</li>
          </ul>
          <p>
            No method of electronic transmission or storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">6. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li><strong className="text-gray-200">Access:</strong> Request a copy of the personal data we hold about you</li>
            <li><strong className="text-gray-200">Correction:</strong> Request correction of inaccurate data</li>
            <li><strong className="text-gray-200">Deletion:</strong> Request deletion of your account and associated data</li>
            <li><strong className="text-gray-200">Export:</strong> Request your data in a portable format</li>
            <li><strong className="text-gray-200">Objection:</strong> Object to certain uses of your data</li>
          </ul>
          <p>
            To exercise any of these rights, contact us through Discord or the email address in your account settings. We will respond within 30 days.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">7. Cookies & Local Storage</h2>
          <p>
            Coin Sniffer uses browser local storage to persist your preferences (selected currency pair, sort settings, alert configuration). We do not use third-party tracking cookies.
          </p>
          <p>
            Authentication tokens (JWT) are stored in local storage for session management. These are automatically cleared when you sign out.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">8. Children's Privacy</h2>
          <p>
            The Service is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal data, we will take steps to delete it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">9. International Users</h2>
          <p>
            Your data may be processed and stored in locations outside your country of residence. By using the Service, you consent to the transfer of your data to these locations. We take reasonable steps to ensure your data is treated securely in accordance with this Privacy Policy.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated via email to registered users. The "Last updated" date at the top reflects the most recent revision.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">11. Contact</h2>
          <p>
            For questions or concerns about this Privacy Policy or your personal data, contact us through our Discord community or at the email address provided in your account settings.
          </p>
        </section>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-8 mt-12 flex items-center justify-between text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Coin Sniffer</p>
          <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">
            ← Terms of Service
          </Link>
        </div>
      </main>
    </div>
  )
}
