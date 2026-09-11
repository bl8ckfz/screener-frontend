import { useAuth } from '@/hooks/useAuth'

/**
 * WebhooksLocked Component
 *
 * Shown in place of WebhookManager when the account lacks the webhooks add-on.
 *
 * The tab stays visible rather than disappearing: a feature that silently is not
 * there reads as a bug, and users who had webhooks before the add-on split need
 * to see where their configuration went.
 *
 * There is no self-serve purchase for this — the 'pro' role is granted by hand —
 * so the copy asks the user to get in touch instead of dangling a checkout
 * button that goes nowhere.
 */
export function WebhooksLocked() {
  const { isExpired, isTrial } = useAuth()

  // An account with no live plan is failing the billing check as well as the
  // add-on one. Point at the thing they can actually fix themselves.
  const billingFirst = isExpired || isTrial

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="text-4xl mb-4" aria-hidden="true">
        🔒
      </div>

      <h4 className="text-base font-medium text-white mb-2">Webhooks aren't enabled on your account</h4>

      <p className="text-sm text-gray-400 max-w-md mb-6">
        Webhook delivery — pushing alerts straight to Discord, Telegram, Slack or your own
        endpoint as they fire — is an add-on rather than part of the standard plan.
      </p>

      {billingFirst ? (
        <p className="text-sm text-gray-400 max-w-md">
          It needs an active subscription plus the add-on enabled on your account.
        </p>
      ) : (
        <p className="text-sm text-gray-400 max-w-md">
          Your subscription is active — the add-on just isn't switched on yet. Get in touch
          and we'll enable it.
        </p>
      )}

      <div className="mt-8 w-full max-w-md rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-left">
        <p className="text-xs font-medium text-gray-300 mb-2">What you get with it</p>
        <ul className="text-xs text-gray-400 space-y-1.5">
          <li>• Alerts pushed to Discord, Telegram, Slack or a raw HTTP endpoint</li>
          <li>• Up to 5 destinations, each filtered to momentum or Dojo setups</li>
          <li>• Scope any destination to your watchlist instead of the whole market</li>
        </ul>
      </div>
    </div>
  )
}
