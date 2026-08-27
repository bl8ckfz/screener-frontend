/**
 * Verify Email Page
 *
 * Reads ?token= from the emailed link, confirms the address, and signs the
 * user in — they have just proven ownership and arrived from their own inbox.
 *
 * It is also the moment a Whop subscription bought BEFORE registering is
 * claimed: pending webhook events are keyed by email and replayed only once
 * that address is proven, so a user who paid first may land straight in an
 * active account.
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { verifyEmail } = useAuth()
  const token = searchParams.get('token') || ''

  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  // StrictMode mounts effects twice in development, and the token is
  // single-use — a second call would fail and show an error on a verification
  // that actually succeeded.
  const attempted = useRef(false)

  useEffect(() => {
    if (!token || attempted.current) return
    attempted.current = true

    verifyEmail(token)
      .then(() => {
        setDone(true)
        setTimeout(() => navigate('/app', { replace: true }), 1500)
      })
      .catch((err: Error) => setError(err.message || 'Verification failed'))
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/60 p-8 text-center">
        {!token ? (
          <>
            <h1 className="text-xl font-semibold text-white mb-2">Link incomplete</h1>
            <p className="text-sm text-gray-400 mb-6">
              This confirmation link is missing its token. Open the link directly
              from the email, or request a new one.
            </p>
            <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm">
              Back to sign in
            </Link>
          </>
        ) : error ? (
          <>
            <h1 className="text-xl font-semibold text-white mb-2">Could not confirm</h1>
            <p className="text-sm text-gray-400 mb-6">{error}</p>
            <p className="text-xs text-gray-500 mb-6">
              Links expire after 24 hours and work only once. Signing in again
              will offer you a fresh one.
            </p>
            <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm">
              Back to sign in
            </Link>
          </>
        ) : done ? (
          <>
            <h1 className="text-xl font-semibold text-white mb-2">Email confirmed</h1>
            <p className="text-sm text-gray-400">Signing you in…</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-white mb-2">Confirming…</h1>
            <p className="text-sm text-gray-400">One moment.</p>
          </>
        )}
      </div>
    </div>
  )
}
