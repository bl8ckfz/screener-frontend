/**
 * Expired Page
 * 
 * Full-page state shown when trial or subscription has expired.
 * User can log in but sees this instead of the screener.
 * Provides info about subscribing and a logout button.
 */

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

type RequestState = 'idle' | 'loading' | 'success' | 'error'

export function ExpiredPage() {
  const { user, logout } = useAuth()
  const [requestState, setRequestState] = useState<RequestState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const wasTrial = user?.status === 'trial' || (user?.status === 'expired' && !user?.plan)

  async function handleSubscriptionRequest() {
    if (requestState === 'loading' || requestState === 'success') return
    setRequestState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/request-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, userId: user?.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Failed to send request. Please try again.')
        setRequestState('error')
      } else {
        setRequestState('success')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setRequestState('error')
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-lg text-center">
          {/* Icon */}
          <div className="text-6xl mb-6">⏰</div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-3">
            {wasTrial ? 'Your trial has expired' : 'Your subscription has expired'}
          </h1>

          {/* Description */}
          <p className="text-gray-400 mb-8 leading-relaxed">
            {wasTrial
              ? 'Your 7-day free trial has ended. Subscribe to continue using Pulsaryx with full access to all features.'
              : 'Your subscription has expired. Renew to continue accessing real-time alerts, charts, and market analysis.'}
          </p>

          {/* Plan options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-1">Monthly</h3>
              <p className="text-gray-400 text-sm mb-4">Full access, billed monthly</p>
              <div className="text-2xl font-bold text-blue-400">Contact us</div>
            </div>
            <div className="bg-gray-900 border border-blue-500/50 rounded-xl p-6 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                Best Value
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Yearly</h3>
              <p className="text-gray-400 text-sm mb-4">Full access, billed annually</p>
              <div className="text-2xl font-bold text-blue-400">Contact us</div>
            </div>
          </div>

          {/* Contact CTA */}
          {requestState === 'success' ? (
            <div className="inline-flex items-center gap-2 px-8 py-3 bg-green-700/30 border border-green-600/40 text-green-400 font-semibold rounded-xl">
              ✓ Request sent! We'll be in touch soon.
            </div>
          ) : (
            <button
              onClick={handleSubscriptionRequest}
              disabled={requestState === 'loading'}
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/20"
            >
              {requestState === 'loading' ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Sending…
                </>
              ) : (
                'Contact for Subscription'
              )}
            </button>
          )}
          {requestState === 'error' && (
            <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
          )}

          {/* User info */}
          <p className="mt-6 text-sm text-gray-500">
            Logged in as {user?.email}
          </p>
        </div>
      </div>
    </div>
  )
}
