/**
 * SubscriptionGuard Component
 * 
 * Wraps routes that require an active subscription or valid trial.
 * Shows ExpiredPage if the user's trial/subscription has expired.
 * Admins always pass through.
 */

import { useAuth } from '@/hooks/useAuth'
import { ExpiredPage } from '@/pages/ExpiredPage'

interface SubscriptionGuardProps {
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { isExpired, isAdmin } = useAuth()

  if (isAdmin) {
    return <>{children}</>
  }

  if (isExpired) {
    return <ExpiredPage />
  }

  return <>{children}</>
}
