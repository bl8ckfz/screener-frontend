import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui'

interface UserMenuProps {
  onSignIn: () => void
}

/**
 * UserMenu - User authentication menu
 * 
 * Features:
 * - Shows sign in button when logged out
 * - Shows user email and sign out button when logged in
 * - Integrates with backend JWT authentication
 */
export function UserMenu({ onSignIn }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout, loading } = useAuth()

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false)
    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  if (loading) {
    return (
      <div className="h-9 w-20 bg-surface-dark rounded-lg animate-pulse" />
    )
  }

  if (!user) {
    return (
      <Button
        onClick={onSignIn}
        variant="secondary"
        size="sm"
        className="flex items-center gap-2"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Sign In
      </Button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="flex items-center gap-2 rounded-lg border border-gray-700 bg-surface-dark px-3 py-2 text-sm text-white hover:bg-surface-light transition-colors"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold">
          {user.email?.[0]?.toUpperCase()}
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-gray-700 bg-surface-dark shadow-2xl z-[200]">
          <div className="border-b border-gray-700 p-3">
            <p className="text-xs text-gray-400">Signed in as</p>
            <p className="mt-1 text-sm font-medium text-white truncate">{user.email}</p>
            {user.created_at && (
              <p className="mt-1 text-xs text-gray-500">
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="p-2">
            <button
              onClick={() => {
                logout()
                setIsOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-surface-light hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
