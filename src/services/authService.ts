/**
 * Authentication Service
 * 
 * Handles user authentication with the backend API
 * - Registration
 * - Login
 * - Token management
 * - User session
 */

import axios from 'axios'

const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080'

export interface User {
  id: string
  email: string
  created_at: string
  last_login_at?: string
}

export interface AuthResponse {
  user: User
  token: string
}

export interface AuthError {
  error: string
}

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

/**
 * Auth service for managing authentication
 */
export const authService = {
  /**
   * Register a new user account
   */
  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_URL}/auth/register`, {
        email,
        password,
      })

      // Store token and user
      this.setToken(response.data.token)
      this.setUser(response.data.user)

      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed')
    }
  },

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_URL}/auth/login`, {
        email,
        password,
      })

      // Store token and user
      this.setToken(response.data.token)
      this.setUser(response.data.user)

      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed')
    }
  },

  /**
   * Logout current user
   */
  logout() {
    this.removeToken()
    this.removeUser()
  },

  /**
   * Get current user from API
   */
  async getCurrentUser(): Promise<User> {
    const token = this.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.get<User>(`${API_URL}/api/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      this.setUser(response.data)
      return response.data
    } catch (error: any) {
      // If 401, clear invalid token
      if (error.response?.status === 401) {
        this.logout()
      }
      throw new Error(error.response?.data?.error || 'Failed to get user')
    }
  },

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<AuthResponse> {
    const token = this.getToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await axios.post<AuthResponse>(
        `${API_URL}/api/refresh`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      this.setToken(response.data.token)
      this.setUser(response.data.user)

      return response.data
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.logout()
      }
      throw new Error(error.response?.data?.error || 'Token refresh failed')
    }
  },

  /**
   * Get stored authentication token
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },

  /**
   * Store authentication token
   */
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token)
  },

  /**
   * Remove authentication token
   */
  removeToken() {
    localStorage.removeItem(TOKEN_KEY)
  },

  /**
   * Get stored user
   */
  getUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY)
    if (!userStr) return null

    try {
      return JSON.parse(userStr)
    } catch {
      return null
    }
  },

  /**
   * Store user data
   */
  setUser(user: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  /**
   * Remove user data
   */
  removeUser() {
    localStorage.removeItem(USER_KEY)
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken()
  },
}
