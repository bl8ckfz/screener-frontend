/**
 * Authentication Hook
 * 
 * Provides authentication state and methods to components
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { authService, type User } from '@/services/authService'
import { watchlistService } from '@/services/watchlistService'
import { useStore } from '@/hooks/useStore'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  syncWatchlist: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

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

  const syncWatchlist = async () => {
    try {
      const symbols = await watchlistService.getWatchlist()
      useStore.getState().setWatchlistSymbols(symbols)
    } catch (error) {
      console.error('Failed to sync watchlist:', error)
    }
  }

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password)
    setUser(response.user)
    // Sync watchlist after login
    await syncWatchlist()
  }

  const register = async (email: string, password: string) => {
    const response = await authService.register(email, password)
    setUser(response.user)
    // No need to sync on register - watchlist will be empty
  }

  const logout = () => {
    authService.logout()
    setUser(null)
    // Clear local watchlist
    useStore.getState().setWatchlistSymbols([])
  }

  const refreshToken = async () => {
    const response = await authService.refreshToken()
    setUser(response.user)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshToken,
        syncWatchlist,
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
