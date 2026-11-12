/**
 * Unsubscribe Page
 *
 * Where the "unsubscribe" link in the daily email lands. Works signed out: the
 * link carries a token that can do exactly one thing, switch that account's
 * daily email off.
 *
 * Nothing happens until the button is pressed. Mail scanners and link
 * previewers open every URL in a message, so a page that unsubscribed on load
 * would switch the email off for people who never asked. (Mail apps with their
 * own "unsubscribe" button skip this page and send the request directly.)
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/ui'

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080'

type State = 'idle' | 'sending' | 'done' | 'error'

export function UnsubscribePage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState<State>('idle')

  const unsubscribe = async () => {
    setState('sending')
    try {
      // A bare fetch: no session is involved, and none must be needed.
      const res = await fetch(`${BACKEND_URL}/email/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        credentials: 'omit',
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <header className="px-4 py-4 sm:px-6">
        <Link to="/" className="text-xl font-bold text-white transition-colors hover:text-gray-300">
          <Logo size={26} />
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/60 p-8 text-center">
          {!token ? (
            <>
              <h1 className="mb-2 text-xl font-semibold text-white">Link incomplete</h1>
              <p className="text-sm text-gray-400">
                This link is missing its token. Use the unsubscribe link from the email itself, or
                switch the daily email off from your account.
              </p>
            </>
          ) : state === 'done' ? (
            <>
              <h1 className="mb-2 text-xl font-semibold text-white">You’re unsubscribed</h1>
              <p className="text-sm text-gray-400">
                The daily email is switched off. Your account is unchanged, and you can switch the
                email back on from it at any time.
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-xl font-semibold text-white">Stop the daily email?</h1>
              <p className="mb-6 text-sm text-gray-400">
                You will no longer receive the daily scan. Nothing else about your account changes.
              </p>
              {state === 'error' && (
                <p role="alert" className="mb-4 text-sm text-red-400">
                  That did not go through. Try again in a moment.
                </p>
              )}
              <button
                type="button"
                onClick={unsubscribe}
                disabled={state === 'sending'}
                className="rounded bg-[#f5a623] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] disabled:opacity-50"
              >
                {state === 'sending' ? 'Unsubscribing…' : 'Unsubscribe'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
