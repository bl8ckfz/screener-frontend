/**
 * Backend WebSocket Alert Hook
 * 
 * Connects to backend WebSocket endpoint for real-time alert notifications.
 * Handles reconnection, state management, and integration with notification system.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { BackendWebSocketClient, backendApi } from '@/services/backendApi'
import { debug } from '@/utils/debug'
import type { Alert } from '@/types/alert'

interface BackendAlert {
  id: string
  symbol: string
  rule_type: string
  description: string
  timestamp: string
  price: number
  metadata?: Record<string, any>
}

interface UseBackendAlertsOptions {
  enabled?: boolean
  autoConnect?: boolean
  onAlert?: (alert: Alert) => void
}

interface UseBackendAlertsReturn {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  alerts: Alert[]
  connect: () => void
  disconnect: () => void
  clearAlerts: () => void
}

/**
 * Hook for backend WebSocket alert streaming
 */
export function useBackendAlerts(
  options: UseBackendAlertsOptions = {}
): UseBackendAlertsReturn {
  const {
    enabled = true,
    autoConnect = false, // Disabled by default - Railway doesn't support WebSocket
    onAlert,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])

  const wsClientRef = useRef<BackendWebSocketClient | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const onAlertRef = useRef<((alert: Alert) => void) | undefined>(onAlert)
  const unsubscribeFnsRef = useRef<(() => void)[]>([])

  useEffect(() => {
    onAlertRef.current = onAlert
  }, [onAlert])

  /**
   * Transform backend alert to frontend Alert type
   */
  const transformBackendAlert = useCallback((backendAlert: BackendAlert): Alert => {
    const isBearish = backendAlert.rule_type.toLowerCase().includes('bear')
    return {
      id: backendAlert.id,
      symbol: backendAlert.symbol,
      type: isBearish ? 'futures_big_bear_60' : 'futures_big_bull_60',
      severity: 'high' as const,
      title: backendAlert.description,
      message: `${backendAlert.symbol}: ${backendAlert.description}`,
      value: backendAlert.price,
      threshold: 0,
      timestamp: new Date(backendAlert.timestamp).getTime(),
      read: false,
      dismissed: false,
      source: 'main' as const,
    }
  }, [])

  /**
   * Handle incoming alert from WebSocket
   */
  const handleAlert = useCallback((backendAlert: BackendAlert) => {
    debug.log('🔔 Backend alert received:', backendAlert)

    const alert = transformBackendAlert(backendAlert)
    setAlerts((prev) => [alert, ...prev])

    // Call custom callback
    onAlertRef.current?.(alert)

    debug.log('✅ Alert processed:', alert.symbol, alert.type)
  }, [transformBackendAlert])

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!enabled) {
      debug.log('⏭️ Backend alerts disabled')
      return
    }

    if (isConnecting || wsClientRef.current?.isConnected()) {
      debug.log('✅ Already connected to backend WebSocket')
      return
    }

    try {
      debug.log('🔌 Connecting to backend WebSocket...')
      setIsConnecting(true)
      setError(null)
      
      // Get singleton WebSocket client
      const wsClient = BackendWebSocketClient.getInstance()
      wsClientRef.current = wsClient
      wsClient.addRef()

      // Subscribe to events and store unsubscribe functions
      const unsubs: (() => void)[] = []
      
      unsubs.push(wsClient.onOpen(() => {
        setIsConnected(true)
        setIsConnecting(false)
        setError(null)
        debug.log('✅ Backend WebSocket connected')
      }))

      unsubs.push(wsClient.onClose((event) => {
        setIsConnected(false)
        setIsConnecting(false)
        if (!event.wasClean) {
          setError(`WebSocket closed (${event.code})`)
        }
        debug.error('❌ Backend WebSocket closed:', event.code, event.reason)
      }))

      unsubs.push(wsClient.onError(() => {
        setIsConnected(false)
        setIsConnecting(false)
        setError('WebSocket error')
      }))

      // Subscribe to alerts
      unsubs.push(wsClient.onAlert((backendAlert: any) => {
        handleAlert(backendAlert)
      }))
      
      unsubscribeFnsRef.current = unsubs

      // Connect
      wsClient.connect()
      
    } catch (err) {
      setIsConnecting(false)
      setIsConnected(false)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      debug.error('❌ Backend WebSocket error:', errorMessage)
    }
  }, [enabled, handleAlert])

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    debug.log('🔌 Disconnecting from backend WebSocket...')

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    // Unsubscribe from all events
    unsubscribeFnsRef.current.forEach(unsub => unsub())
    unsubscribeFnsRef.current = []

    if (wsClientRef.current) {
      wsClientRef.current.removeRef()
      wsClientRef.current = null
    }

    setIsConnected(false)
    setIsConnecting(false)
    setError(null)
  }, [])

  /**
   * Clear alert list
   */
  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (enabled && autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, autoConnect, connect, disconnect])

  return {
    isConnected,
    isConnecting,
    error,
    alerts,
    connect,
    disconnect,
    clearAlerts,
  }
}
