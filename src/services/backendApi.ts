/**
 * Backend API Client
 * 
 * This service communicates with the Go backend (screener-backend)
 * to fetch processed metrics, alerts, and user settings.
 * 
 * Replaces direct Binance API calls when VITE_USE_BACKEND_API=true
 */

import type { Alert } from '@/types/alert'

interface UserSettings {
  userId: string
  alertRules: any[]
  webhooks: any[]
  preferences: Record<string, any>
}

/**
 * Backend API configuration
 */
const BACKEND_CONFIG = {
  baseUrl: import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080',
  timeout: 10000,
  wsUrl: import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:8080/ws/alerts',
}

// Log configuration on load
console.log('🔧 Backend Config:', {
  baseUrl: BACKEND_CONFIG.baseUrl,
  wsUrl: BACKEND_CONFIG.wsUrl,
  useBackend: import.meta.env.VITE_USE_BACKEND_API,
})

/**
 * Whether to use backend API instead of direct Binance calls
 */
export const USE_BACKEND_API = import.meta.env.VITE_USE_BACKEND_API === 'true'

/**
 * HTTP request helper with error handling
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = BACKEND_CONFIG.timeout
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

/**
 * Backend API Client
 */
export const backendApi = {
  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetchWithTimeout(`${BACKEND_CONFIG.baseUrl}/api/health`)
    return response.json()
  },

  /**
   * Fetch processed metrics for a symbol
   * 
   * Returns multi-timeframe data (5m, 15m, 1h, 4h, 8h, 1d) with:
   * - OHLCV data
   * - Price changes
   * - Volume ratios
   * - VCP indicator
   * - Fibonacci levels
   * - RSI, MACD
   */
  async getMetrics(symbol: string): Promise<any> {
    const response = await fetchWithTimeout(
      `${BACKEND_CONFIG.baseUrl}/metrics/${symbol.toUpperCase()}`
    )
    return response.json()
  },

  /**
   * Fetch all symbols with their latest metrics
   * 
   * This replaces the need to call Binance API for each symbol
   * Backend aggregates data for all 43 active symbols
   * 
   * Returns: Array of symbol metrics (not an object)
   */
  async getAllMetrics(): Promise<any[]> {
    const response = await fetchWithTimeout(
      `${BACKEND_CONFIG.baseUrl}/api/metrics/`
    )
    return response.json()
  },

  /**
   * Fetch 24h tickers from backend (proxy to Binance Futures)
   * Optionally filter by symbols (comma-separated)
   */
  async getAllTickers(symbols?: string[]): Promise<any[]> {
    const query = symbols && symbols.length > 0
      ? `?symbols=${encodeURIComponent(symbols.join(','))}`
      : ''
    const response = await fetchWithTimeout(
      `${BACKEND_CONFIG.baseUrl}/api/tickers${query}`
    )
    return response.json()
  },

  /**
   * Get user alert settings
   * 
   * Requires authentication (Supabase JWT in Authorization header)
   */
  async getSettings(token: string): Promise<UserSettings> {
    const response = await fetchWithTimeout(
      `${BACKEND_CONFIG.baseUrl}/settings`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    return response.json()
  },

  /**
   * Save user alert settings
   */
  async saveSettings(token: string, settings: UserSettings): Promise<void> {
    await fetchWithTimeout(
      `${BACKEND_CONFIG.baseUrl}/settings`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      }
    )
  },

  /**
   * Fetch alert history (last 48 hours)
   * 
   * Filters:
   * - symbol: Filter by trading pair (optional)
   * - ruleType: Filter by alert type (optional)
   * - limit: Max number of results (default: 100)
   */
  async getAlertHistory(params: {
    symbol?: string
    ruleType?: string
    limit?: number
    since?: string
  }): Promise<Alert[]> {
    const queryParams = new URLSearchParams()
    if (params.symbol) queryParams.set('symbol', params.symbol)
    if (params.ruleType) queryParams.set('rule_type', params.ruleType)
    if (params.limit) queryParams.set('limit', params.limit.toString())
    if (params.since) queryParams.set('since', params.since)

    const url = `${BACKEND_CONFIG.baseUrl}/api/alerts?${queryParams}`
    const response = await fetchWithTimeout(url)
    return response.json()
  },

  /**
   * Check if backend is healthy and accessible
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${BACKEND_CONFIG.baseUrl}/api/health`, {}, 3000)
      const data = await response.json()
      return data.status === 'ok'
    } catch {
      return false
    }
  },
}

/**
 * Helper functions for webhook validation
 */
export function isValidDiscordWebhookUrl(url: string): boolean {
  return url.includes('discord.com/api/webhooks/')
}

export function isValidTelegramWebhook(token: string, chatId: string): boolean {
  return token.length > 0 && chatId.length > 0
}

/**
 * Webhook API - Backend executes webhooks, frontend only configures
 * TODO: Implement when backend webhook endpoints are ready
 */
export const webhooks = {
  async list(_token: string): Promise<any[]> {
    console.warn('webhooks.list - backend implementation needed')
    return []
  },

  async create(_token: string, _config: any): Promise<any> {
    console.warn('webhooks.create - backend implementation needed')
    return {}
  },

  async update(_token: string, _id: string, _config: any): Promise<any> {
    console.warn('webhooks.update - backend implementation needed')
    return {}
  },

  async delete(_token: string, _id: string): Promise<void> {
    console.warn('webhooks.delete - backend implementation needed')
  },

  async test(_token: string, _id: string): Promise<{ success: boolean; error?: string }> {
    console.warn('webhooks.test - backend implementation needed')
    return { success: false, error: 'Not implemented' }
  },
}

/**
 * WebSocket Client for Real-time Alerts (Singleton)
 */
export class BackendWebSocketClient {
  private static instance: BackendWebSocketClient | null = null
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = Infinity
  private reconnectDelay = 2000
  private maxReconnectDelay = 30000
  private listeners: ((alert: Alert) => void)[] = []
  private openListeners: (() => void)[] = []
  private closeListeners: ((event: CloseEvent) => void)[] = []
  private errorListeners: ((event: Event) => void)[] = []
  private pingInterval: NodeJS.Timeout | null = null
  private manualClose = false
  private refCount = 0
  private disconnectTimeout: NodeJS.Timeout | null = null

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BackendWebSocketClient {
    if (!BackendWebSocketClient.instance) {
      BackendWebSocketClient.instance = new BackendWebSocketClient()
    }
    return BackendWebSocketClient.instance
  }

  /**
   * Increment reference count (called when hook mounts)
   */
  addRef(): void {
    this.refCount++
    console.log(`[BackendWS] Reference count: ${this.refCount}`)
    
    // Cancel pending disconnect if remounting
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout)
      this.disconnectTimeout = null
      console.log('[BackendWS] Cancelled pending disconnect')
    }
  }

  /**
   * Decrement reference count (called when hook unmounts)
   */
  removeRef(): void {
    this.refCount--
    console.log(`[BackendWS] Reference count: ${this.refCount}`)
    
    // Disconnect after delay when no more references (allows StrictMode remount)
    if (this.refCount <= 0) {
      this.refCount = 0
      
      // Delay disconnect by 100ms to allow StrictMode remount
      this.disconnectTimeout = setTimeout(() => {
        console.log('[BackendWS] No references, disconnecting')
        this.disconnect()
        this.disconnectTimeout = null
      }, 100)
    }
  }

  /**
   * Connect to backend WebSocket for real-time alerts
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[BackendWS] Already connected')
      return
    }

    this.manualClose = false
    this.reconnectAttempts = 0

    console.log('[BackendWS] Connecting to', BACKEND_CONFIG.wsUrl)
    
    // Connect directly without token (backend endpoint is authOptional)
    this.ws = new WebSocket(BACKEND_CONFIG.wsUrl)

    this.ws.onopen = () => {
      console.log('[BackendWS] Connected successfully')
      this.reconnectAttempts = 0
      this.openListeners.forEach(listener => listener())
      
      // Keep connection alive by sending periodic messages
      // Backend expects client messages to reset the 30s read deadline
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Handle alert messages (backend sends raw alert JSON from NATS)
        // Silently forward to listeners (removed excessive logging)
        this.listeners.forEach(listener => listener(data))
      } catch (error) {
        console.error('[BackendWS] Failed to parse message:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('[BackendWS] Error:', error)
      this.errorListeners.forEach(listener => listener(error))
    }

    this.ws.onclose = (event) => {
      console.log('[BackendWS] Connection closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      })
      this.stopHeartbeat()
      this.ws = null
      this.closeListeners.forEach(listener => listener(event))

      if (this.manualClose) {
        return
      }
      
      // Attempt reconnection with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = Math.min(
          this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
          this.maxReconnectDelay
        )
        console.log(`[BackendWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
        
        setTimeout(() => {
          this.connect()
        }, delay)
      } else {
        console.error('[BackendWS] Max reconnection attempts reached')
      }
    }
  }

  /**
   * Start heartbeat to keep connection alive
   * Backend expects WebSocket ping frames and responds with pong
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    
    // Send JSON keepalive every 10 seconds (Railway may have short idle timeout)
    // Backend reads any message to reset the 30s deadline
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          // Send JSON ping - more likely to traverse proxies than empty message
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
          // Removed keepalive logging to reduce console spam
        } catch (error) {
          console.error('[BackendWS] Failed to send keepalive:', error)
        }
      }
    }, 10000) // 10 seconds - Railway may timeout idle connections faster than 30s
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      console.log('[BackendWS] Disconnecting')
      this.stopHeartbeat()
      this.manualClose = true
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Subscribe to alert events
   */
  onAlert(callback: (alert: Alert) => void): () => void {
    this.listeners.push(callback)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Subscribe to open events
   */
  onOpen(callback: () => void): () => void {
    this.openListeners.push(callback)
    return () => {
      const index = this.openListeners.indexOf(callback)
      if (index > -1) {
        this.openListeners.splice(index, 1)
      }
    }
  }

  /**
   * Subscribe to close events
   */
  onClose(callback: (event: CloseEvent) => void): () => void {
    this.closeListeners.push(callback)
    return () => {
      const index = this.closeListeners.indexOf(callback)
      if (index > -1) {
        this.closeListeners.splice(index, 1)
      }
    }
  }

  /**
   * Subscribe to error events
   */
  onError(callback: (event: Event) => void): () => void {
    this.errorListeners.push(callback)
    return () => {
      const index = this.errorListeners.indexOf(callback)
      if (index > -1) {
        this.errorListeners.splice(index, 1)
      }
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export default backendApi
