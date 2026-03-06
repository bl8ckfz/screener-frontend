/**
 * SubscriptionGuard Component
 * 
 * Wraps routes that require an active subscription or valid trial.
 * Shows ExpiredPage if the user's trial/subscription has expired.
 * Admins always pass through.
 * Canceled users with remaining time see a notice banner but keep access.
 */

import { useAuth } from '@/hooks/useAuth'
import { ExpiredPage } from '@/pages/ExpiredPage'

interface SubscriptionGuardProps {
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { isExpired, isAdmin, isCanceled, user } = useAuth()

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
