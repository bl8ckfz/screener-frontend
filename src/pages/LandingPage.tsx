/**
 * Landing Page
 * 
 * Public page shown to unauthenticated users.
 * Features hero section, feature showcase, and CTA to login/signup.
 */

import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'

export function LandingPage() {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

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
            <span className="text-xl sm:text-2xl font-bold">📊 Screener</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Get Started
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
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/20"
            >
              Get Started Free
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-4 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-lg rounded-xl transition-colors"
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
              description="Big Bull/Bear, Pioneer, Whale, Volume Spike, Flat detection — evaluated in real-time on every candle."
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
            Create a free account and start monitoring the market in seconds.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/20"
          >
            Create Free Account
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Screener. Real-time crypto market analysis.</p>
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
