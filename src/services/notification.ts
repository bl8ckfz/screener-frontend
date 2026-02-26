import { debug } from '@/utils/debug'
/**
 * Browser Notification Service
 * 
 * Handles browser notification permissions and display using the Notification API.
 * Provides a wrapper around the native API with proper error handling and feature detection.
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported'

/**
 * Check if browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (!isNotificationSupported()) {
    return 'unsupported'
  }
  return Notification.permission as NotificationPermissionStatus
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!isNotificationSupported()) {
    debug.warn('Browser notifications are not supported')
    return 'unsupported'
  }

  try {
    const permission = await Notification.requestPermission()
    debug.log('Notification permission:', permission)
    return permission as NotificationPermissionStatus
  } catch (error) {
    console.error('Failed to request notification permission:', error)
    return 'denied'
  }
}

/**
 * Show a browser notification
 */
export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
  onClick?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
}

export function showNotification(options: NotificationOptions): Notification | null {
  const permission = getNotificationPermission()

  if (permission !== 'granted') {
    debug.warn('Cannot show notification: permission not granted')
    return null
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      tag: options.tag,
      requireInteraction: options.requireInteraction ?? false,
      silent: options.silent ?? false,
    })

    // Attach event handlers
    if (options.onClick) {
      notification.onclick = () => {
        options.onClick?.()
        notification.close()
      }
    }

    if (options.onClose) {
      notification.onclose = options.onClose
    }

    if (options.onError) {
      notification.onerror = options.onError
    }

    return notification
  } catch (error) {
    console.error('Failed to show notification:', error)
    return null
  }
}

/**
 * Show a crypto alert notification
 */
export interface CryptoAlertNotificationOptions {
  symbol: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  onClick?: () => void
}

export function showCryptoAlertNotification(options: CryptoAlertNotificationOptions): Notification | null {
  // Map severity to visual indicators
  const icons = {
    info: '💡',
    warning: '⚠️',
    critical: '🚨',
  }

  const icon = icons[options.severity]

  return showNotification({
    title: `${icon} ${options.symbol} - ${options.title}`,
    body: options.message,
    tag: `crypto-alert-${options.symbol}`, // Reuse tag to replace old notifications
    requireInteraction: options.severity === 'critical',
    silent: false,
    onClick: options.onClick,
  })
}

/**
 * Test notification (for permission request UX)
 */
export function showTestNotification(): Notification | null {
  return showNotification({
    title: '🎉 Notifications Enabled',
    body: 'You will now receive crypto alerts via browser notifications.',
    tag: 'pulsaryx-test',
    silent: true,
  })
}
