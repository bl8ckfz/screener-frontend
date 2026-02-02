/**
 * Watchlist Service
 * 
 * Handles watchlist operations with backend API
 */

import axios from 'axios'
import { authService } from './authService'

const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080'

export interface WatchlistResponse {
  symbols: string[]
  count: number
}

export interface WatchlistError {
  error: string
}

/**
 * Watchlist service for managing user's watchlist
 */
export const watchlistService = {
  /**
   * Get user's watchlist from backend
   */
  async getWatchlist(): Promise<string[]> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.get<WatchlistResponse>(`${API_URL}/api/watchlist`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      return response.data.symbols || []
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to get watchlist')
    }
  },

  /**
   * Add symbol to watchlist
   */
  async addSymbol(symbol: string): Promise<void> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      await axios.post(
        `${API_URL}/api/watchlist`,
        { symbol: symbol.toUpperCase() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to add symbol to watchlist')
    }
  },

  /**
   * Remove symbol from watchlist
   */
  async removeSymbol(symbol: string): Promise<void> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      await axios.delete(`${API_URL}/api/watchlist`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { symbol: symbol.toUpperCase() },
      })
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to remove symbol from watchlist')
    }
  },

  /**
   * Replace entire watchlist
   */
  async replaceWatchlist(symbols: string[]): Promise<void> {
    const token = authService.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      await axios.put(
        `${API_URL}/api/watchlist`,
        { symbols: symbols.map((s) => s.toUpperCase()) },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    } catch (error: any) {
      if (error.response?.status === 401) {
        authService.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to replace watchlist')
    }
  },
}
