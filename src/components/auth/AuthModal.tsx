import { useEffect, useState, memo } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/config'
import { Button } from '@/components/ui'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

// Memoize appearance config to prevent re-creating on every render
const authAppearance = {
  theme: ThemeSupa,
  variables: {
    default: {
      colors: {
        brand: '#3b82f6',
        brandAccent: '#2563eb',
        brandButtonText: 'white',
        defaultButtonBackground: '#1f2937',
        defaultButtonBackgroundHover: '#374151',
        defaultButtonBorder: '#4b5563',
        defaultButtonText: 'white',
        dividerBackground: '#4b5563',
        inputBackground: '#1f2937',
        inputBorder: '#4b5563',
        inputBorderHover: '#6b7280',
        inputBorderFocus: '#3b82f6',
        inputText: 'white',
        inputLabelText: '#d1d5db',
        inputPlaceholder: '#9ca3af',
        messageText: '#d1d5db',
        messageTextDanger: '#ef4444',
        anchorTextColor: '#3b82f6',
        anchorTextHoverColor: '#2563eb',
      },
      space: {
        spaceSmall: '4px',
        spaceMedium: '8px',
        spaceLarge: '16px',
      },
      fontSizes: {
        baseBodySize: '14px',
        baseInputSize: '14px',
        baseLabelSize: '14px',
        baseButtonSize: '14px',
      },
      borderWidths: {
        buttonBorderWidth: '1px',
        inputBorderWidth: '1px',
      },
      radii: {
        borderRadiusButton: '6px',
        buttonBorderRadius: '6px',
        inputBorderRadius: '6px',
      },
    },
  },
  className: {
    container: 'auth-container',
    button: 'auth-button',
    input: 'auth-input',
    label: 'auth-label',
  },
} as const

/**
 * AuthModal - Authentication UI component
 * 
 * Features:
 * - Email/password sign up and sign in
 * - Magic link authentication
 * - Password reset
 * - Uses Supabase Auth UI for consistent experience
 * - Memoized to prevent form input loss during parent re-renders
 */
function AuthModalComponent({ isOpen, onClose }: AuthModalProps) {
  const [view, setView] = useState<'sign_in' | 'sign_up'>('sign_in')

  useEffect(() => {
    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        onClose()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-lg border border-gray-700 bg-surface-dark p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">
            {view === 'sign_in' ? 'Sign In' : 'Create Account'}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {view === 'sign_in'
              ? 'Sign in to sync your settings across devices'
              : 'Create an account to backup your watchlists and alerts'}
          </p>
        </div>

        {/* Auth UI */}
        <Auth
          supabaseClient={supabase}
          view={view}
          appearance={authAppearance}
          providers={[]}
          redirectTo={window.location.origin}
        />

        {/* Toggle view */}
        <div className="mt-4 text-center text-sm">
          {view === 'sign_in' ? (
            <p className="text-gray-400">
              Don't have an account?{' '}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('sign_up')}
                className="text-blue-400 hover:text-blue-300"
              >
                Sign up
              </Button>
            </p>
          ) : (
            <p className="text-gray-400">
              Already have an account?{' '}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('sign_in')}
                className="text-blue-400 hover:text-blue-300"
              >
                Sign in
              </Button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Export memoized version to prevent unnecessary re-renders
export const AuthModal = memo(AuthModalComponent)
