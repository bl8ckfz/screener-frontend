/**
 * SubscriptionGuard Component
 * 
 * Wraps routes that require an active subscription or valid trial.
 * Shows ExpiredPage if the user's trial/subscription has expired.
 * Admins always pass through.
 * Canceled users with remaining time see a notice banner but keep access.
 * 
 * Also handles the post-payment redirect: when Whop redirects back with
 * ?session=ch_xxx, we call /api/billing/confirm to activate the user even
 * if the webhook failed (e.g. email mismatch between Whop and Pulsaryx).
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ExpiredPage } from '@/pages/ExpiredPage'
import { authService } from '@/services/authService'

interface SubscriptionGuardProps {
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { isExpired, isAdmin, isCanceled, user, refreshToken } = useAuth()
  const [confirming, setConfirming] = useState(false)
  // The session id of a confirmation that failed, kept so it can be retried.
  //
  // A failure used to be swallowed: the ?session param was stripped and the
  // user fell through to ExpiredPage — the subscription screen, straight after
  // paying — with no way to try again short of paying twice.
  const [failedSession, setFailedSession] = useState<string | null>(null)

  // Remove the session param from the URL so a refresh doesn't re-trigger.
  // Only after SUCCESS: while it fails, a refresh is a perfectly good retry.
  const stripSessionParam = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('session')
    window.history.replaceState({}, '', url.toString())
  }

  const confirm = (session: string) => {
    setConfirming(true)
    setFailedSession(null)
    authService.confirmCheckout(session)
      .then(() => refreshToken())
      .then(() => stripSessionParam())
      .catch(() => setFailedSession(session))
      .finally(() => setConfirming(false))
  }

  // On mount, check if Whop redirected back with a session param.
  // If so, call /api/billing/confirm to ensure the user is activated regardless
  // of whether the webhook matched them by email.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const session = params.get('session')
    if (!session) return

    const token = authService.getToken()
    if (!token) return

    confirm(session)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show nothing while confirming to avoid flashing ExpiredPage
  if (confirming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400 text-sm">Checking your purchase…</div>
      </div>
    )
  }

  // Confirmation failed and the account still has no access. If the webhook
  // got there anyway the user is not expired and simply carries on.
  if (failedSession && isExpired && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div role="alert" className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-white">
            We couldn’t confirm your purchase yet
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Your payment may still be processing. Try again in a moment — you will
            not be charged again. If it keeps failing, contact us on Whop with the
            email you paid with and we’ll activate your account.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => confirm(failedSession)}
              className="rounded bg-[#f5a623] px-4 py-2 text-sm font-medium text-black hover:bg-[#ffb83d]"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                stripSessionParam()
                setFailedSession(null)
              }}
              className="rounded border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isAdmin) {
    return <>{children}</>
  }

  if (isExpired) {
    return <ExpiredPage />
  }

  // Canceled but still has access — show a small notice
  if (isCanceled && user?.plan_expires_at) {
    const expiresDate = new Date(user.plan_expires_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
    return (
      <>
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 text-center text-sm text-yellow-400">
          Your subscription is canceled. Access ends {expiresDate}.{' '}
          <a href="/billing" className="underline font-medium hover:text-yellow-300">
            Resubscribe →
          </a>
        </div>
        {children}
      </>
    )
  }

  return <>{children}</>
}
