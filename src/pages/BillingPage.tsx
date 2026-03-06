/**
 * Billing Page
 * 
 * Shows current subscription plan, status, and management options.
 * Allows upgrading to TV add-on and setting TradingView username.
 * Links to Whop dashboard for subscription management.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { authService, type BillingInfo } from '@/services/authService'
import { useNavigate } from 'react-router-dom'

export function BillingPage() {
  const { user, logout, isCanceled } = useAuth()
  const navigate = useNavigate()
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // TV username form
  const [tvUsername, setTvUsername] = useState('')
  const [tvSaving, setTvSaving] = useState(false)
  const [tvSuccess, setTvSuccess] = useState(false)

  // Checkout loading
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    loadBilling()
  }, [])

  async function loadBilling() {
    try {
      setLoading(true)
      const info = await authService.getBillingInfo()
      setBilling(info)
      if (info.tv_username) {
        setTvUsername(info.tv_username)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load billing info')
    } finally {
      setLoading(false)
    }
  }

  async function handleTVUsernameSave() {
    if (!tvUsername.trim() || tvSaving) return
    setTvSaving(true)
    setTvSuccess(false)
    try {
      await authService.setTVUsername(tvUsername.trim())
      setTvSuccess(true)
      setTimeout(() => setTvSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTvSaving(false)
    }
  }

  async function handleCheckout(plan: string) {
    if (checkoutLoading) return
    setCheckoutLoading(plan)
    try {
      const { checkout_url } = await authService.createCheckout(plan)
      window.location.href = checkout_url
    } catch (err: any) {
      setError(err.message)
      setCheckoutLoading(null)
    }
  }

  const statusColor = {
    active: 'text-green-400',
    trial: 'text-blue-400',
    canceled: 'text-yellow-400',
    expired: 'text-red-400',
  }

  const statusLabel = {
    active: 'Active',
    trial: 'Trial',
    canceled: 'Canceled',
    expired: 'Expired',
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-white">⚡ Pulsaryx</span>
            <button
              onClick={() => navigate('/app')}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Screener
            </button>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>

          {loading ? (
            <div className="text-gray-400 py-8 text-center">Loading billing info…</div>
          ) : error && !billing ? (
            <div className="text-red-400 py-8 text-center">{error}</div>
          ) : billing ? (
            <>
              {/* Current Plan Card */}
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Current Plan</h2>
                  <span className={`text-sm font-medium ${statusColor[user?.status as keyof typeof statusColor] || 'text-gray-400'}`}>
                    {statusLabel[user?.status as keyof typeof statusLabel] || user?.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Plan</span>
                    <span className="text-white font-medium">
                      {billing.plan ? billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1) : 'None'}
                    </span>
                  </div>

                  {billing.plan_expires_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">
                        {isCanceled ? 'Access ends' : 'Renews on'}
                      </span>
                      <span className="text-white">
                        {new Date(billing.plan_expires_at).toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">TradingView Add-on</span>
                    <span className={billing.tv_addon_active ? 'text-green-400' : 'text-gray-500'}>
                      {billing.tv_addon_active ? 'Active' : 'Not subscribed'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  {billing.manage_url && billing.whop_membership_id && (
                    <a
                      href={billing.manage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-600 transition-colors"
                    >
                      Manage on Whop
                    </a>
                  )}

                  {isCanceled && (
                    <button
                      onClick={() => handleCheckout(billing.plan === 'yearly' ? 'screener_yearly' : 'screener_monthly')}
                      disabled={!!checkoutLoading}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {checkoutLoading ? 'Redirecting…' : 'Resubscribe'}
                    </button>
                  )}
                </div>
              </div>

              {/* TV Add-on Card */}
              {!billing.tv_addon_active && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-2">TradingView Indicators</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Get access to 8 premium Pine Script indicators including Raids, structure analysis, and momentum tools.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCheckout('tv_monthly')}
                      disabled={!!checkoutLoading}
                      className="px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-600 transition-colors disabled:opacity-50"
                    >
                      {checkoutLoading === 'tv_monthly' ? 'Redirecting…' : '$12/mo'}
                    </button>
                    <button
                      onClick={() => handleCheckout('tv_yearly')}
                      disabled={!!checkoutLoading}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {checkoutLoading === 'tv_yearly' ? 'Redirecting…' : '$120/yr (Save $24)'}
                    </button>
                  </div>
                </div>
              )}

              {/* TV Username Card */}
              {billing.tv_addon_active && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-2">TradingView Username</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Enter your TradingView username to get access to the invite-only indicators.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tvUsername}
                      onChange={(e) => setTvUsername(e.target.value)}
                      placeholder="Your TradingView username"
                      className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleTVUsernameSave}
                      disabled={tvSaving || !tvUsername.trim()}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {tvSaving ? 'Saving…' : tvSuccess ? '✓ Saved' : 'Save'}
                    </button>
                  </div>
                  {tvSuccess && (
                    <p className="text-green-400 text-xs mt-2">
                      Username saved. Indicators will be shared within 24 hours.
                    </p>
                  )}
                </div>
              )}

              {/* Upgrade to Bundle */}
              {billing.plan && !billing.tv_addon_active && (
                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-2">Upgrade to Bundle</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Get both the Screener and TradingView indicators for a discounted price.
                  </p>
                  <button
                    onClick={() => handleCheckout('bundle_monthly')}
                    disabled={!!checkoutLoading}
                    className="px-6 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {checkoutLoading === 'bundle_monthly' ? 'Redirecting…' : 'Bundle — $39/mo'}
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
            </>
          ) : null}

          {/* Footer */}
          <p className="text-sm text-gray-600 text-center pt-4">
            Payments processed by Whop · {user?.email}
          </p>
        </div>
      </div>
    </div>
  )
}
