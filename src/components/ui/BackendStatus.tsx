/**
 * Backend Status Badge
 * 
 * Shows which data source is active (Backend API vs Binance API)
 * and WebSocket connection status for backend mode.
 */

import { useEffect, useState } from 'react'
import { backendApi } from '@/services/backendApi'

interface BackendStatusProps {
  wsConnected?: boolean
  className?: string
}

export function BackendStatus({ wsConnected = false, className = '' }: BackendStatusProps) {
  const [isHealthy, setIsHealthy] = useState(true)
  const [isChecking, setIsChecking] = useState(false)

  // Check backend health periodically
  useEffect(() => {
    const checkHealth = async () => {
      setIsChecking(true)
      try {
        const healthy = await backendApi.checkHealth()
        setIsHealthy(healthy)
      } catch (err) {
        setIsHealthy(false)
      } finally {
        setIsChecking(false)
      }
    }

    // Initial check
    checkHealth()

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000)

    return () => clearInterval(interval)
  }, [])

  // Backend mode
  const statusColor = isHealthy ? 'green' : 'red'
  const wsStatusColor = wsConnected ? 'green' : 'gray'

  return (
    <div className={`inline-flex items-center gap-1.5 md:gap-3 px-1.5 md:px-3 py-0.5 md:py-1 rounded-full bg-${statusColor}-500/10 text-${statusColor}-400 text-[10px] md:text-xs font-medium ${className}`}>
      {/* Backend API status */}
      <div className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-${statusColor}-400 ${isChecking ? 'animate-pulse' : ''}`}></span>
        <span className="hidden md:inline">Backend API</span>
        <span className="md:hidden">BE</span>
      </div>

      {/* WebSocket status */}
      <div className="flex items-center gap-1 border-l border-gray-600 pl-1.5 md:pl-3">
        <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-${wsStatusColor}-400 ${!wsConnected ? 'animate-pulse' : ''}`}></span>
        <span className="text-gray-400 hidden md:inline">WS: {wsConnected ? 'Connected' : 'Disconnected'}</span>
        <span className="text-gray-400 md:hidden">{wsConnected ? '✓' : '✗'}</span>
      </div>
    </div>
  )
}
