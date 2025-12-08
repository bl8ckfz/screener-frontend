import { useEffect, useState } from 'react'
import { Alert, AlertSeverity, CombinedAlertType } from '@/types/alert'
import { useStore } from '@/hooks/useStore'
import { formatNumber } from '@/utils/format'

interface AlertNotificationProps {
  alert: Alert
  onDismiss: (alertId: string) => void
  autoDismissAfter?: number // seconds, 0 = never
}

/**
 * Single alert notification toast
 */
function AlertNotificationToast({
  alert,
  onDismiss,
  autoDismissAfter = 30,
}: AlertNotificationProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (autoDismissAfter > 0) {
      const timer = setTimeout(() => {
        handleDismiss()
      }, autoDismissAfter * 1000)
      return () => clearTimeout(timer)
    }
  }, [autoDismissAfter])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      onDismiss(alert.id)
    }, 300) // Animation duration
  }

  const getSeverityColor = (severity: AlertSeverity): string => {
    // Determine if alert is bullish or bearish based on type
    const isBullish = [
      'price_pump',
      'pioneer_bull',
      '5m_big_bull',
      '15m_big_bull',
      'bottom_hunter',
    ].includes(alert.type)
    
    const isBearish = [
      'price_dump',
      'pioneer_bear',
      '5m_big_bear',
      '15m_big_bear',
      'top_hunter',
    ].includes(alert.type)

    // Bullish alerts = green shades
    if (isBullish) {
      const bullishColors = {
        low: 'border-green-500 bg-green-500/10',
        medium: 'border-green-400 bg-green-400/10',
        high: 'border-green-300 bg-green-300/10',
        critical: 'border-green-200 bg-green-200/10',
      }
      return bullishColors[severity]
    }
    
    // Bearish alerts = red/orange shades
    if (isBearish) {
      const bearishColors = {
        low: 'border-orange-500 bg-orange-500/10',
        medium: 'border-orange-400 bg-orange-400/10',
        high: 'border-red-500 bg-red-500/10',
        critical: 'border-red-400 bg-red-400/10',
      }
      return bearishColors[severity]
    }
    
    // Neutral alerts = blue shades (volume, vcp, etc.)
    const neutralColors = {
      low: 'border-blue-500 bg-blue-500/10',
      medium: 'border-blue-400 bg-blue-400/10',
      high: 'border-purple-500 bg-purple-500/10',
      critical: 'border-purple-400 bg-purple-400/10',
    }
    return neutralColors[severity]
  }

  const getSeverityIcon = (severity: AlertSeverity): string => {
    const icons = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🔶',
      critical: '🚨',
    }
    return icons[severity]
  }

  const getAlertTypeIcon = (type: CombinedAlertType): string => {
    if (type.includes('bull') || type === 'price_pump') return '📈'
    if (type.includes('bear') || type === 'price_dump') return '📉'
    if (type.includes('hunter')) return '🎣'
    if (type.includes('volume')) return '📊'
    if (type === 'vcp_signal') return '🎯'
    if (type === 'fibonacci_break') return '🔢'
    return '🔔'
  }

  const renderAlertValue = (alert: Alert): JSX.Element => {
    const momentumAlerts = ['pioneer_bull', 'pioneer_bear', '5m_big_bull', '5m_big_bear', '15m_big_bull', '15m_big_bear']
    const isMomentum = momentumAlerts.includes(alert.type)

    if (isMomentum) {
      // Show percentage change for momentum alerts
      const changeColor = alert.value >= 0 ? 'text-green-400' : 'text-red-400'
      return (
        <span className={`font-mono font-semibold ${changeColor}`}>
          {alert.value >= 0 ? '+' : ''}{alert.value.toFixed(2)}%
        </span>
      )
    }

    // For price-based alerts, format based on magnitude
    const price = alert.value
    let formattedPrice: string
    
    if (price < 0.0001) {
      // Very small values - show more decimals
      formattedPrice = price.toFixed(8)
    } else if (price < 1) {
      // Small values
      formattedPrice = price.toFixed(6)
    } else if (price < 1000) {
      // Medium values
      formattedPrice = formatNumber(price)
    } else {
      // Large values
      formattedPrice = formatNumber(price)
    }

    return (
      <span className="font-mono">
        {formattedPrice}
        {alert.threshold > 0 && (
          <span className="text-gray-500"> / {formatNumber(alert.threshold)}</span>
        )}
      </span>
    )
  }

  return (
    <div
      className={`
        pointer-events-auto w-full overflow-hidden rounded-lg border-l-4 shadow-lg backdrop-blur-sm
        ${getSeverityColor(alert.severity)}
        transition-all duration-300 ease-in-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      style={{ minWidth: '320px', maxWidth: '420px' }}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 text-2xl">
            {getSeverityIcon(alert.severity)}
          </div>
          <div className="ml-3 w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getAlertTypeIcon(alert.type)}</span>
              <p className="text-sm font-medium text-white">{alert.title}</p>
            </div>
            <p className="mt-1 text-sm text-gray-300">{alert.message}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
              <span className="font-mono font-semibold text-blue-400">
                {alert.symbol}
              </span>
              {alert.timeframe && (
                <span className="rounded bg-gray-700 px-2 py-0.5">
                  {alert.timeframe}
                </span>
              )}
              {renderAlertValue(alert)}
            </div>
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="inline-flex rounded-md text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="sr-only">Close</span>
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar for auto-dismiss */}
      {autoDismissAfter > 0 && (
        <div className="h-1 w-full bg-gray-800">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{
              animation: `shrink ${autoDismissAfter}s linear`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}

/**
 * AlertNotificationContainer - Manages notification queue
 * 
 * Features:
 * - Toast-style notifications in top-right corner
 * - Auto-dismiss with countdown
 * - Stacked display (max 5 visible)
 * - Sound alerts (optional)
 * - History tracking in IndexedDB
 */
export function AlertNotificationContainer() {
  const { activeAlerts, alertSettings, dismissAlert } = useStore()
  const [hasPlayedSound, setHasPlayedSound] = useState<Set<string>>(new Set())

  // Debug: Log active alerts changes
  useEffect(() => {
    console.log(`🔔 AlertNotificationContainer: ${activeAlerts.length} active alerts`, activeAlerts.map(a => a.symbol))
  }, [activeAlerts])

  // Play sound for new alerts
  useEffect(() => {
    if (!alertSettings.soundEnabled) return
    if (!activeAlerts || activeAlerts.length === 0) return

    try {
      activeAlerts.forEach((alert) => {
        if (!hasPlayedSound.has(alert.id)) {
          playAlertSound(alert.severity)
          setHasPlayedSound((prev) => new Set(prev).add(alert.id))
        }
      })
    } catch (error) {
      console.error('Error playing alert sounds:', error)
    }
  }, [activeAlerts, alertSettings.soundEnabled, hasPlayedSound])

  const playAlertSound = (severity: AlertSeverity) => {
    try {
      // Use Web Audio API for alert sounds
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Different frequencies for different severities
      const frequencies = {
        low: 440, // A4
        medium: 554, // C#5
        high: 659, // E5
        critical: 880, // A5
      }

      oscillator.frequency.value = frequencies[severity]
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5
      )

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (error) {
      console.warn('Failed to play alert sound:', error)
    }
  }

  // Show only the most recent 5 alerts
  const visibleAlerts = activeAlerts.slice(-5)

  if (visibleAlerts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-end gap-3 p-4 sm:p-6"
      style={{ maxWidth: '100vw' }}
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex w-full flex-col items-end gap-3" style={{ maxWidth: '420px', marginLeft: 'auto' }}>
        {visibleAlerts.map((alert) => (
          <AlertNotificationToast
            key={alert.id}
            alert={alert}
            onDismiss={dismissAlert}
            autoDismissAfter={alertSettings.autoDismissAfter}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * AlertBanner - Persistent banner for critical alerts
 * 
 * Displays at the top of the page for critical alerts that require attention
 */
interface AlertBannerProps {
  alerts: Alert[]
  onDismiss: (alertId: string) => void
}

export function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical')

  if (criticalAlerts.length === 0) return null

  return (
    <div className="border-b border-red-500 bg-red-500/20 backdrop-blur-sm">
      {criticalAlerts.map((alert) => (
        <div key={alert.id} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="font-medium text-white">
                {alert.symbol}: {alert.title}
              </p>
              <p className="text-sm text-gray-300">{alert.message}</p>
            </div>
          </div>
          <button
            onClick={() => onDismiss(alert.id)}
            className="rounded p-1 text-gray-400 hover:bg-red-500/30 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
