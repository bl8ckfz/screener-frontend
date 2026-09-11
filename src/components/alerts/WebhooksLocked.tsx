import { useAuth } from '@/hooks/useAuth'

/**
 * WebhooksLocked Component
 *
 * Shown in place of WebhookManager when the account is not on Pro.
 *
 * The tab stays visible rather than disappearing: a feature that silently is not
 * there reads as a bug, and users who had webhooks before the Pro split need to
 * see where their configuration went.
 *
 * There is no self-serve purchase — the 'pro' role is granted by hand — so the
 * copy names Whop as the channel rather than dangling a checkout button that
 * goes nowhere. Deliberately no link: the customer-facing Whop URL is not
 * something this app knows, and a wrong one is worse than none.
 */
export function WebhooksLocked() {
  const { isExpired, isTrial } = useAuth()

  // An account with no live plan is failing the billing check as well as the
  // Pro one. Point at the thing they can actually fix themselves.
  const billingFirst = isExpired || isTrial

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="text-4xl mb-4" aria-hidden="true">
        🔒
      </div>

      <h4 className="text-base font-medium text-white mb-2">Webhooks are a Pro feature</h4>

      <p className="text-sm text-gray-400 max-w-md mb-6">
        Webhook delivery — pushing alerts straight to Discord, Telegram, Slack or your own
        endpoint as they fire — is part of Pro rather than the standard plan.
      </p>

      {billingFirst ? (
        <p className="text-sm text-gray-400 max-w-md">
          It needs an active subscription plus Pro enabled on your account. Contact us on
          Whop once your subscription is running and we'll switch it on.
        </p>
      ) : (
        <p className="text-sm text-gray-400 max-w-md">
          Your subscription is active — Pro just isn't switched on yet.{' '}
          <span className="text-gray-200">Contact us on Whop</span> and we'll enable it.
        </p>
      )}

      <div className="mt-8 w-full max-w-md rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-left">
        <p className="text-xs font-medium text-gray-300 mb-2">What you get with Pro</p>
        <ul className="text-xs text-gray-400 space-y-1.5">
          <li>• Alerts pushed to Discord, Telegram, Slack or a raw HTTP endpoint</li>
          <li>• Filter the feed down to momentum or Dojo setups</li>
          <li>• Scope delivery to your watchlist instead of the whole market</li>
        </ul>
      </div>

      {/*
        Migration 029 deleted the webhook rows of accounts that were not entitled
        when the Pro gate landed, so an upgraded user starts empty. Saying so here
        is cheaper than the "where did my webhook go" support round-trip.
      */}
      <p className="text-xs text-gray-500 max-w-md mt-6">
        Had a webhook set up before? You'll need to add it again once Pro is enabled.
      </p>
    </div>
  )
}
