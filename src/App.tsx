/**
 * App Component - Router Shell
 * 
 * Defines the route structure:
 * - / → Landing page (public)
 * - /login → Login page (public, redirects if authenticated)
 * - /signup → Signup page (public, redirects if authenticated)
 * - /app → Screener app (protected, requires auth)
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { SubscriptionGuard } from '@/components/auth/SubscriptionGuard'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { InvitePage } from '@/pages/InvitePage'
import { ScreenerApp } from '@/pages/ScreenerApp'
import { BillingPage } from '@/pages/BillingPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />

        {/* Redirect old signup to landing */}
        <Route path="/signup" element={<Navigate to="/" replace />} />

        {/* Protected routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <SubscriptionGuard>
                <ScreenerApp />
              </SubscriptionGuard>
            </ProtectedRoute>
          }
        />

        {/* Billing — auth required but no subscription guard (expired users need access) */}
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <BillingPage />
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
