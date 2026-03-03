/**
 * Landing Page
 * 
 * Public page shown to unauthenticated users.
 * Features hero section, feature showcase, and CTA to login/signup.
 */

import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'

export function LandingPage() {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  const [reqEmail, setReqEmail] = useState('')
  const [reqLoading, setReqLoading] = useState(false)
  const [reqSuccess, setReqSuccess] = useState(false)
  const [reqError, setReqError] = useState('')

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqError('')
    setReqLoading(true)
    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: reqEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
      setReqSuccess(true)
    } catch (err: any) {
      setReqError(err.message ?? 'Failed to send request. Please try again.')
    } finally {
      setReqLoading(false)
    }
  }

  // Redirect authenticated users to app
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/app', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl sm:text-2xl font-bold">⚡ Pulsaryx</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent leading-tight">
            Real-Time Crypto Alerts & Market Analysis
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Monitor 200+ Binance Futures pairs with 10 alert types, TradingView charts, 
            and instant Discord/Telegram notifications — all in real-time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/20"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need to stay ahead
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="🚨"
              title="10 Alert Types"
              description="Surge, Scout, Whale, Volume Spike, Flat detection — evaluated in real-time on every candle."
            />
            <FeatureCard
              icon="📈"
              title="TradingView Charts"
              description="Full interactive charts with Ichimoku, VWAP, Fibonacci levels, and volume analysis."
            />
            <FeatureCard
              icon="⚡"
              title="Real-Time WebSocket"
              description="Instant alert delivery via WebSocket. Sub-100ms latency from candle to notification."
            />
            <FeatureCard
              icon="🔔"
              title="Discord & Telegram"
              description="Configure webhooks for instant notifications on your preferred platform."
            />
            <FeatureCard
              icon="📊"
              title="200+ Pairs"
              description="All Binance Futures USDT pairs tracked simultaneously with multi-timeframe analysis."
            />
            <FeatureCard
              icon="🎯"
              title="VCP & Fibonacci"
              description="Volatility Contraction Pattern scoring and 7-level Fibonacci pivot calculations."
            />
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 px-4 sm:px-6 border-y border-gray-800">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <StatItem value="200+" label="Tracked Pairs" />
          <StatItem value="10" label="Alert Types" />
          <StatItem value="<100ms" label="Alert Latency" />
          <StatItem value="24/7" label="Monitoring" />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to start?</h2>
          <p className="text-gray-400 mb-8">
            Request early access to start your 7-day free trial.
          </p>

          {reqSuccess ? (
            <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-6 text-green-400">
              <div className="text-2xl mb-2">✅</div>
              <p className="font-semibold">Request received!</p>
              <p className="text-sm mt-1 text-green-400/80">We'll send your invite link shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleRequestAccess} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={reqEmail}
                onChange={(e) => setReqEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={reqLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/20 whitespace-nowrap"
              >
                {reqLoading ? 'Sending…' : 'Request Access'}
              </button>
            </form>
          )}

          {reqError && (
            <p className="mt-3 text-sm text-red-400">{reqError}</p>
          )}

          <p className="mt-6 text-sm text-gray-500">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Pulsaryx. Real-time crypto market analysis.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 hover:border-gray-600 transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold text-blue-400">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  )
}
