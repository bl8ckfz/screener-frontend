/**
 * Expired Page
 * 
 * Full-page state shown when trial or subscription has expired.
 * Displays pricing plans and redirects to Whop checkout.
 */

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { authService } from '@/services/authService'

type CheckoutState = 'idle' | 'loading' | 'error'

interface PlanCard {
  slug: string
  name: string
  price: string
  period: string
  savings?: string
  description: string
  features: string[]
  highlight?: boolean
}

const PLANS: PlanCard[] = [
  {
    slug: 'screener_monthly',
    name: 'Screener',
    price: '$29',
    period: '/mo',
    description: 'Real-time crypto futures screener',
    features: [
      'Real-time alerts (Surge, Scout, Whale, Volume)',
      '200+ Binance Futures pairs',
      'Multi-timeframe analysis',
      'Custom watchlist & webhooks',
      'Discord/Telegram notifications',
    ],
  },
  {
    slug: 'screener_yearly',
    name: 'Screener',
    price: '$290',
    period: '/yr',
    savings: 'Save $58',
    description: 'Real-time crypto futures screener',
    features: [
      'Everything in monthly',
      '2 months free',
    ],
    highlight: true,
  },
  {
    slug: 'bundle_monthly',
    name: 'Bundle',
    price: '$39',
    period: '/mo',
    description: 'Screener + TradingView indicators',
    features: [
      'Everything in Screener',
      '8 premium TradingView indicators',
      'Raids, structure, momentum tools',
      'Priority support',
    ],
  },
  {
    slug: 'bundle_yearly',
    name: 'Bundle',
    price: '$390',
    period: '/yr',
    savings: 'Save $78',
    description: 'Screener + TradingView indicators',
    features: [
      'Everything in Bundle monthly',
      '2 months free',
    ],
    highlight: true,
  },
]

export function ExpiredPage() {
  const { user, logout } = useAuth()
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  // New user = never had a plan and never had a local trial end
  const isNewUser = user?.status === 'expired' && !user?.plan && !user?.plan_expires_at && !user?.trial_ends_at
  const wasTrial = !isNewUser && (user?.status === 'trial' || (user?.status === 'expired' && !user?.plan))

  async function handleCheckout(planSlug: string) {
    if (checkoutState === 'loading') return
    setCheckoutState('loading')
    setLoadingPlan(planSlug)
    setErrorMsg('')

    try {
      const { checkout_url } = await authService.createCheckout(planSlug)
      // Redirect to Whop checkout
      window.location.href = checkout_url
    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to start checkout')
      setCheckoutState('error')
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 border-b border-gray-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold text-white">⚡ Pulsaryx</span>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-5xl w-full text-center">
          {/* Title */}
          <div className="text-5xl mb-4">⚡</div>
          <h1 className="text-3xl font-bold text-white mb-3">
            {isNewUser
              ? 'Start your free trial'
              : wasTrial
                ? 'Your trial has expired'
                : 'Your subscription has expired'}
          </h1>
          <p className="text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
            {isNewUser
              ? 'Try Pulsaryx free for 7 days. No charge until your trial ends.'
              : wasTrial
                ? 'Your 7-day free trial has ended. Choose a plan to continue using Pulsaryx.'
                : 'Renew your subscription to continue accessing real-time alerts and market analysis.'}
          </p>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {PLANS.map((plan) => (
              <div
                key={plan.slug}
                className={`relative bg-gray-900 rounded-xl p-6 text-left border transition-colors ${
                  plan.highlight
                    ? 'border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                {plan.savings && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full whitespace-nowrap">
                    {plan.savings}
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                <p className="text-gray-500 text-xs mb-3">{plan.description}</p>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCheckout(plan.slug)}
                  disabled={checkoutState === 'loading'}
                  className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                      : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loadingPlan === plan.slug ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Redirecting…
                    </span>
                  ) : isNewUser ? (
                    'Start Free Trial'
                  ) : (
                    'Subscribe'
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* TV Add-on standalone */}
          <div className="max-w-md mx-auto bg-gray-900/50 border border-gray-700 rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-white font-medium">TradingView Add-on Only</h4>
                <p className="text-gray-500 text-xs">8 premium Pine Script indicators</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-white">$12</span>
                <span className="text-gray-400 text-sm">/mo</span>
                <span className="text-gray-600 mx-1">·</span>
                <span className="text-lg font-bold text-white">$120</span>
                <span className="text-gray-400 text-sm">/yr</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleCheckout('tv_monthly')}
                disabled={checkoutState === 'loading'}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 disabled:opacity-50"
              >
                {loadingPlan === 'tv_monthly' ? 'Redirecting…' : 'Monthly'}
              </button>
              <button
                onClick={() => handleCheckout('tv_yearly')}
                disabled={checkoutState === 'loading'}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 disabled:opacity-50"
              >
                {loadingPlan === 'tv_yearly' ? 'Redirecting…' : 'Yearly (Save $24)'}
              </button>
            </div>
          </div>

          {/* Error message */}
          {checkoutState === 'error' && (
            <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
          )}

          {/* Footer info */}
          <p className="text-sm text-gray-500">
            Logged in as {user?.email} · Secure checkout powered by Whop
          </p>
        </div>
      </div>
    </div>
  )
}
