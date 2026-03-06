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

const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080'

interface SubscriptionGuardProps {
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { isExpired, isAdmin, isCanceled, user, refreshToken } = useAuth()
  const [confirming, setConfirming] = useState(false)

  // On mount, check if Whop redirected back with a session param.
  // If so, call /api/billing/confirm to ensure the user is activated regardless
  // of whether the webhook matched them by email.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const session = params.get('session')
    if (!session) return

    const token = authService.getToken()
    if (!token) return

    setConfirming(true)

    fetch(`${API_URL}/api/billing/confirm?session=${encodeURIComponent(session)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.ok) {
          // Refresh user state to pick up new status
          await refreshToken()
        }
      })
      .catch(() => { /* non-critical */ })
      .finally(() => {
        // Remove session param from URL so refreshing doesn't re-trigger
        const url = new URL(window.location.href)
        url.searchParams.delete('session')
        window.history.replaceState({}, '', url.toString())
        setConfirming(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show nothing while confirming to avoid flashing ExpiredPage
  if (confirming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400 text-sm">Activating your subscription…</div>
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
