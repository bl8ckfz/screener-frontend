/**
 * TrialBanner Component
 * 
 * Displays trial countdown in the header when user is on a trial.
 * Color changes: green (>3 days), yellow (≤3 days), red (≤1 day).
 */

import { useAuth } from '@/hooks/useAuth'

export function TrialBanner() {
  const { isTrial, trialDaysRemaining } = useAuth()

  if (!isTrial || trialDaysRemaining === null) return null

  const colorClass = trialDaysRemaining <= 1
    ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : trialDaysRemaining <= 3
      ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
      : 'text-green-400 bg-green-500/10 border-green-500/30'

  const label = trialDaysRemaining === 1
    ? 'Trial: last day'
    : `Trial: ${trialDaysRemaining} days left`

  return (
    <div className={`px-2.5 py-1 text-xs font-medium rounded-md border ${colorClass}`}>
      {label}
    </div>
  )
}
