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
  role: 'user' | 'pro' | 'admin'
  status: 'trial' | 'active' | 'expired' | 'canceled'
  trial_ends_at: string | null
  plan: 'monthly' | 'yearly' | null
  plan_activated_at: string | null
  plan_expires_at: string | null
  tv_addon_active: boolean
  created_at: string
  last_login_at?: string
}

export interface BillingInfo {
  plan: string | null
  status: string
  plan_expires_at: string | null
  whop_membership_id: string | null
  tv_addon_active: boolean
  tv_username: string | null
  manage_url: string
}

export interface CheckoutResponse {
  checkout_url: string
}

export interface InviteValidation {
  valid: boolean
  message?: string
  expires_at?: string
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
   * Register a new user account (invite code optional)
   */
  async register(
    email: string,
    password: string,
    inviteCode?: string,
  ): Promise<{ verificationRequired: true }> {
    try {
      const body: Record<string, string> = { email, password }
      if (inviteCode) body.invite_code = inviteCode

      await axios.post(`${API_URL}/auth/register`, body)

      // No token is issued: the account cannot sign in until the address is
      // confirmed, so storing a session here would only create one the next
      // request rejects.
      return { verificationRequired: true }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed')
    }
  },

  /**
   * Confirm an email address using the token from the emailed link.
   *
   * Verifying signs the user in: they have just proven ownership of the
   * address and arrived from their own inbox. It is also the moment a Whop
   * subscription bought before registering is claimed, so the returned user
   * may already be active.
   */
  async verifyEmail(token: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_URL}/auth/verify-email`, { token })
      this.setToken(response.data.token)
      this.setUser(response.data.user)
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Verification failed')
    }
  },

  /**
   * Ask for a fresh confirmation link.
   *
   * Always resolves, whatever the server says: the endpoint deliberately
   * answers the same way for known and unknown addresses so it cannot be used
   * to discover which are registered, and surfacing a difference here would
   * undo that.
   */
  async resendVerification(email: string): Promise<void> {
    try {
      await axios.post(`${API_URL}/auth/resend-verification`, { email })
    } catch {
      /* intentionally silent — see above */
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
      // An unconfirmed address is a distinct outcome, not a bad password —
      // the credentials were already accepted. Tagged so the caller can offer
      // to resend the link instead of leaving the user stuck retyping a
      // password that was never wrong.
      if (error.response?.status === 403 && error.response?.data?.error === 'email_not_verified') {
        const e = new Error(
          error.response?.data?.message ?? 'Confirm your email address before signing in.',
        ) as Error & { code?: string }
        e.code = 'email_not_verified'
        throw e
      }
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

  /**
   * Validate an invite code
   */
  async validateInvite(code: string): Promise<InviteValidation> {
    try {
      const response = await axios.get<InviteValidation>(`${API_URL}/auth/invite/${code}`)
      return response.data
    } catch (error: any) {
      return {
        valid: false,
        message: error.response?.data?.message || 'Invalid invite code',
      }
    }
  },

  /**
   * Set up subscription expired interceptor.
   * Call once on app init. Fires callback when API returns 403 subscription_expired.
   */
  setupSubscriptionInterceptor(onExpired: () => void) {
    axios.interceptors.response.use(
      response => response,
      error => {
        // Matches 'subscription_expired' ONLY, deliberately. The other 403 codes
        // are feature gates, not billing states: 'webhooks_not_enabled' means the
        // account lacks the pro add-on while its subscription is perfectly valid,
        // and 'active_plan_required' is raised per-feature. Treating either as
        // expiry would throw the whole app behind the expired wall over one
        // locked panel.
        if (
          error.response?.status === 403 &&
          error.response?.data?.error === 'subscription_expired'
        ) {
          onExpired()
        }
        return Promise.reject(error)
      }
    )
  },

  // ── Billing ────────────────────────────────────────────────────────────────

  /**
   * Create a Whop checkout URL for the given plan slug.
   * Plan slugs: screener_monthly, screener_yearly, tv_monthly, tv_yearly, bundle_monthly, bundle_yearly
   */
  async createCheckout(plan: string): Promise<CheckoutResponse> {
    const token = this.getToken()
    if (!token) throw new Error('Not authenticated')

    try {
      const response = await axios.post<CheckoutResponse>(
        `${API_URL}/api/checkout`,
        { plan },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create checkout')
    }
  },

  /**
   * Get billing info for the current user.
   */
  async getBillingInfo(): Promise<BillingInfo> {
    const token = this.getToken()
    if (!token) throw new Error('Not authenticated')

    try {
      const response = await axios.get<BillingInfo>(
        `${API_URL}/api/billing`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get billing info')
    }
  },

  /**
   * Confirm a Whop checkout session after redirect back from payment.
   * Activates the subscription immediately without waiting for webhook.
   */
  async confirmCheckout(session: string): Promise<void> {
    const token = this.getToken()
    if (!token) throw new Error('Not authenticated')

    try {
      await axios.post(
        `${API_URL}/api/billing/confirm?session=${encodeURIComponent(session)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to confirm checkout')
    }
  },

  /**
   * Set TradingView username for indicator access.
   */
  async setTVUsername(tvUsername: string): Promise<void> {
    const token = this.getToken()
    if (!token) throw new Error('Not authenticated')

    try {
      await axios.put(
        `${API_URL}/api/settings/tv-username`,
        { tv_username: tvUsername },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update TV username')
    }
  },

  /**
   * Request a password-reset email. Always resolves (to avoid email enumeration).
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email })
    } catch (error: any) {
      // Propagate rate-limit errors only
      if (error.response?.status === 429) {
        throw new Error(error.response?.data?.error || 'Too many requests. Please wait.')
      }
      // All other errors are silent — same message as success
    }
  },

  /**
   * Exchange a raw reset token for a new password.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { token, password })
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to reset password')
    }
  },

  /**
   * Change password for the currently authenticated user.
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const token = this.getToken()
    if (!token) throw new Error('Not authenticated')

    try {
      await axios.post(
        `${API_URL}/api/change-password`,
        { old_password: oldPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to change password')
    }
  },
}


/**
 * Does this account have the webhooks add-on?
 *
 * Mirrors webhookAccessMiddleware in the backend (cmd/api-gateway/middleware.go)
 * and the delivery join in pkg/webhook/service.go. Webhooks are an extra, not
 * part of the base plan: an account needs the 'pro' role AND live paid time, or
 * it needs to be an admin. Keep all three in sync — if the UI is more generous
 * than the gate the user gets a form that 403s on save; if it is stingier they
 * cannot reach a feature they are paying for.
 */
/**
 * May this account see HOW a zone was built?
 *
 * The plan is what the subscription buys — zone, entry, stop, targets, R:R,
 * and the confluence band that says how strongly the scanner rated it. What
 * this gates is the derivation behind that band: which levels back the zone,
 * and where it sits in the traded volume distribution. Someone holding those
 * can reproduce the method; someone holding the band knows the verdict without
 * the working.
 *
 * The rule is the same as hasWebhookAccess today and is written out again
 * rather than delegated, because they are two different questions. Webhooks
 * could be unbundled from Pro, or plan detail sold separately, and a shared
 * implementation would silently move whichever one was not being edited.
 *
 * Trial accounts do not qualify, deliberately: a trial evaluates the product,
 * it does not grant what is sold on top of it. The backend enforces the same
 * rule in planDetailAccess (cmd/api-gateway/handlers_dojo.go) and strips the
 * fields from the response, so this only decides what the UI asks for and how
 * it explains an absence — it is not what keeps the data back.
 */
export function hasPlanDetailAccess(user: User | null): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role !== 'pro') return false

  if (user.status === 'active') return true
  if (user.status === 'canceled') {
    return user.plan_expires_at ? new Date(user.plan_expires_at) > new Date() : false
  }
  return false
}

export function hasWebhookAccess(user: User | null): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role !== 'pro') return false

  if (user.status === 'active') return true
  // 'canceled' keeps access until the period it was paid for actually ends.
  if (user.status === 'canceled') {
    return user.plan_expires_at ? new Date(user.plan_expires_at) > new Date() : false
  }
  return false
}
