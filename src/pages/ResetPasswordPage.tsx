/**
 * Reset Password Page
 *
 * Reads ?token= from the URL and lets the user set a new password.
 * Redirects to /login on success.
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '@/services/authService'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // If no token in URL, the link is broken
  const missingToken = !token

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => navigate('/login', { replace: true }), 3000)
      return () => clearTimeout(t)
    }
  }, [success, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword(token, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.')
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

            {missingToken ? (
              /* Invalid link */
              <div className="text-center">
                <div className="w-14 h-14 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Invalid link</h1>
                <p className="text-gray-400 mb-6">
                  This password reset link is missing or broken.
                </p>
                <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Request a new reset link
                </Link>
              </div>
            ) : success ? (
              /* Success */
              <div className="text-center">
                <div className="w-14 h-14 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Password updated!</h1>
                <p className="text-gray-400 mb-6">
                  Redirecting you to sign in…
                </p>
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Sign in now
                </Link>
              </div>
            ) : (
              /* Form */
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-white mb-2">Set new password</h1>
                  <p className="text-gray-400 text-sm">Choose a strong password of at least 8 characters.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                      New password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      placeholder="Minimum 8 characters"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white
                                 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500
                                 focus:border-transparent transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm" className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm new password
                    </label>
                    <input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      placeholder="Repeat password"
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
                    disabled={loading || !password || !confirm}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800
                               disabled:opacity-50 text-white font-semibold rounded-xl transition-colors
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                               focus:ring-offset-gray-900"
                  >
                    {loading ? 'Updating…' : 'Set new password'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
