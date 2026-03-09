/**
 * Forgot Password Page
 *
 * User enters their email. The backend sends a reset link (if the email exists).
 * Always shows a success message to avoid email enumeration.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '@/services/authService'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authService.forgotPassword(email.trim())
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4">
        <Link to="/" className="text-xl font-bold text-white hover:text-gray-300 transition-colors">
          🔍 Coin Sniffer
        </Link>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">

            {submitted ? (
              /* Success state */
              <div className="text-center">
                <div className="w-14 h-14 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
                <p className="text-gray-400 mb-6">
                  If <span className="text-white">{email}</span> has an account, we've sent a
                  password reset link. It expires in 1 hour.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Didn't receive it? Check your spam folder or{' '}
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    try again
                  </button>
                  .
                </p>
                <Link
                  to="/login"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  ← Back to sign in
                </Link>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-white mb-2">Reset your password</h1>
                  <p className="text-gray-400 text-sm">
                    Enter your email and we'll send you a link to reset your password.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white
                                 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500
                                 focus:border-transparent transition-colors"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800
                               disabled:opacity-50 text-white font-semibold rounded-xl transition-colors
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                               focus:ring-offset-gray-900"
                  >
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                  Remember your password?{' '}
                  <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
