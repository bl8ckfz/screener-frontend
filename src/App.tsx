/**
 * App Component - Router Shell
 * 
 * Defines the route structure:
 * - / → Landing page (public)
 * - /login → Login page (public, redirects if authenticated)
 * - /signup → Signup page (public, redirects if authenticated)
 * - /app → Screener app (protected, requires auth)
 */

import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { SubscriptionGuard } from '@/components/auth/SubscriptionGuard'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { InvitePage } from '@/pages/InvitePage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'
import { TermsPage } from '@/pages/TermsPage'
import { PrivacyPage } from '@/pages/PrivacyPage'

/**
 * The signed-in app is loaded on demand.
 *
 * Importing ScreenerApp eagerly pulled lightweight-charts (~52KB gzipped) into
 * the entry chunk and had index.html modulepreload it — so every visitor to the
 * public landing page downloaded the whole charting library before the headline
 * painted, to render a page that mostly does not need it. Splitting here is
 * what makes the landing page's own lazy chart worth anything.
 *
 * BillingPage goes with it: it is only ever reached by a signed-in user.
 */
const ScreenerApp = lazy(() =>
  import('@/pages/ScreenerApp').then((m) => ({ default: m.ScreenerApp })),
)
const BillingPage = lazy(() =>
  import('@/pages/BillingPage').then((m) => ({ default: m.BillingPage })),
)

/** Shown only while an authenticated route's chunk is in flight. */
function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <svg className="h-8 w-8 animate-spin text-gray-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Protected routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <SubscriptionGuard>
                <Suspense fallback={<RouteFallback />}>
                  <ScreenerApp />
                </Suspense>
              </SubscriptionGuard>
            </ProtectedRoute>
          }
        />

        {/* Billing — auth required but no subscription guard (expired users need access) */}
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <BillingPage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
