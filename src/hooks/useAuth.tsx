/**
 * Authentication Hook
 * 
 * Provides authentication state and methods to components
 */

import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from 'react'
import { authService, type User } from '@/services/authService'
import { watchlistService } from '@/services/watchlistService'
import { webhookService } from '@/services/webhookService'
import { useStore } from '@/hooks/useStore'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  // Subscription state
  isExpired: boolean
  isTrial: boolean
  isActive: boolean
  isCanceled: boolean
  isAdmin: boolean
  hasTvAddon: boolean
  currentPlan: string | null
  trialDaysRemaining: number | null
  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, inviteCode?: string) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  syncWatchlist: () => Promise<void>
  syncWebhooks: () => Promise<void>
  markExpired: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [forceExpired, setForceExpired] = useState(false)

  // Set up 403 interceptor once
  useEffect(() => {
    authService.setupSubscriptionInterceptor(() => {
      setForceExpired(true)
    })
  }, [])

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = authService.getUser()
      const token = authService.getToken()

      if (storedUser && token) {
        try {
          // Verify token is still valid by fetching current user
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
        } catch (error) {
          console.error('Failed to load user:', error)
          authService.logout()
          setUser(null)
        }
      }

      setLoading(false)
    }

    loadUser()
  }, [])

  // Compute subscription state
  const subscriptionState = useMemo(() => {
    if (!user) {
      return { isExpired: false, isTrial: false, isActive: false, isCanceled: false, isAdmin: false, hasTvAddon: false, currentPlan: null, trialDaysRemaining: null }
    }

    if (forceExpired && user.role !== 'admin') {
      return { isExpired: true, isTrial: false, isActive: false, isCanceled: false, isAdmin: false, hasTvAddon: false, currentPlan: null, trialDaysRemaining: null }
    }

    const isAdmin = user.role === 'admin'
    const hasTvAddon = user.tv_addon_active ?? false
    const currentPlan = user.plan ?? null

    // Admins are always active
    if (isAdmin) {
      return { isExpired: false, isTrial: false, isActive: true, isCanceled: false, isAdmin: true, hasTvAddon, currentPlan, trialDaysRemaining: null }
    }

    // Check trial expiry client-side
    if (user.status === 'trial' && user.trial_ends_at) {
      const trialEnd = new Date(user.trial_ends_at)
      const now = new Date()
      if (trialEnd <= now) {
        return { isExpired: true, isTrial: false, isActive: false, isCanceled: false, isAdmin: false, hasTvAddon, currentPlan, trialDaysRemaining: 0 }
      }
      const msRemaining = trialEnd.getTime() - now.getTime()
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
      return { isExpired: false, isTrial: true, isActive: false, isCanceled: false, isAdmin: false, hasTvAddon, currentPlan, trialDaysRemaining: daysRemaining }
    }

    if (user.status === 'active') {
      return { isExpired: false, isTrial: false, isActive: true, isCanceled: false, isAdmin: false, hasTvAddon, currentPlan, trialDaysRemaining: null }
    }

    // Canceled = access continues until period end, then expires
    if (user.status === 'canceled') {
      const periodEnd = user.plan_expires_at ? new Date(user.plan_expires_at) : null
      const stillHasAccess = periodEnd ? periodEnd > new Date() : false
      if (stillHasAccess) {
        return { isExpired: false, isTrial: false, isActive: true, isCanceled: true, isAdmin: false, hasTvAddon, currentPlan, trialDaysRemaining: null }
      }
      return { isExpired: true, isTrial: false, isActive: false, isCanceled: true, isAdmin: false, hasTvAddon, currentPlan: null, trialDaysRemaining: null }
    }

    // status === 'expired'
    if (user.status === 'expired') {
      return { isExpired: true, isTrial: false, isActive: false, isCanceled: false, isAdmin: false, hasTvAddon: false, currentPlan: null, trialDaysRemaining: null }
    }

    // Legacy: trial status with no trial_ends_at yet
    if (user.status === 'trial') {
      return { isExpired: false, isTrial: true, isActive: false, isCanceled: false, isAdmin: false, hasTvAddon, currentPlan, trialDaysRemaining: 7 }
    }

    // Unknown status — treat as expired
    return { isExpired: true, isTrial: false, isActive: false, isCanceled: false, isAdmin: false, hasTvAddon: false, currentPlan: null, trialDaysRemaining: null }
  }, [user, forceExpired])

  const syncWatchlist = async () => {
    try {
      const symbols = await watchlistService.getWatchlist()
      useStore.getState().setWatchlistSymbols(symbols)
    } catch (error) {
      console.error('Failed to sync watchlist:', error)
    }
  }

  const syncWebhooks = async () => {
    try {
      const webhooks = await webhookService.getWebhooks()
      useStore.getState().setWebhooks(webhooks)
    } catch (error) {
      console.error('Failed to sync webhooks:', error)
    }
  }

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password)
    setUser(response.user)
    setForceExpired(false)
    // Sync watchlist and webhooks after login
    await Promise.all([syncWatchlist(), syncWebhooks()])
  }

  const register = async (email: string, password: string, inviteCode?: string) => {
    const response = await authService.register(email, password, inviteCode)
    setUser(response.user)
    setForceExpired(false)
  }

  const logout = () => {
    authService.logout()
    setUser(null)
    setForceExpired(false)
    // Clear local watchlist and webhooks
    useStore.getState().setWatchlistSymbols([])
    useStore.getState().setWebhooks([])
  }

  const refreshToken = async () => {
    const response = await authService.refreshToken()
    setUser(response.user)
  }

  const markExpired = useCallback(() => {
    setForceExpired(true)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        ...subscriptionState,
        login,
        register,
        logout,
        refreshToken,
        syncWebhooks,
        syncWatchlist,
        markExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
