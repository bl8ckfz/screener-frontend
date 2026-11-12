/**
 * A link from the free view to the plans.
 *
 * To /upgrade, not straight to Whop: a signed-in account starts checkout from
 * inside the app, where the purchase is tied to that account, instead of
 * relying on the email it types at checkout matching the one it signed up with.
 *
 * `source` says which part of the free view sent them, so the funnel report
 * can tell the sample from a locked row from the header button.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { trackFunnel } from '@/services/funnel'

export type UpgradeSource = 'free_header' | 'free_sample' | 'free_locked_row' | 'free_record' | 'free_notice'

const BUTTON =
  'inline-block rounded bg-[#f5a623] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]'
const TEXT =
  'text-sm font-medium text-[#f5a623] underline decoration-[#f5a623]/40 underline-offset-4 hover:decoration-[#f5a623]'

export function UpgradeLink({
  source,
  children,
  variant = 'button',
}: {
  source: UpgradeSource
  children: ReactNode
  variant?: 'button' | 'text'
}) {
  return (
    <Link
      to="/upgrade"
      onClick={() => trackFunnel('upgrade_click', { source })}
      className={variant === 'button' ? BUTTON : TEXT}
    >
      {children}
    </Link>
  )
}
