/**
 * Webhook service for sending alerts to external services (Discord, Telegram, etc.)
 * Features: Rate limiting, retry logic, multiple webhook support
 */

import type { Alert, AlertSeverity, WebhookConfig } from '@/types/alert'

/**
 * Discord embed color based on alert severity
 */
const SEVERITY_COLORS: Record<AlertSeverity, number> = {
  low: 0x3b82f6, // Blue
  medium: 0xf59e0b, // Orange
  high: 0xef4444, // Red
  critical: 0x991b1b, // Dark Red
}

/**
 * Rate limiter for webhooks (5 messages per 5 seconds per webhook)
 */
class WebhookRateLimiter {
  private queues: Map<string, number[]> = new Map()
  private readonly maxMessages = 5
  private readonly windowMs = 5000 // 5 seconds

  canSend(webhookId: string): boolean {
    const now = Date.now()
    const queue = this.queues.get(webhookId) || []
    
    // Remove old timestamps outside the window
    const validTimestamps = queue.filter(ts => now - ts < this.windowMs)
    
    if (validTimestamps.length >= this.maxMessages) {
      return false
    }
    
    return true
  }

  recordSend(webhookId: string) {
    const now = Date.now()
    const queue = this.queues.get(webhookId) || []
    const validTimestamps = queue.filter(ts => now - ts < this.windowMs)
    validTimestamps.push(now)
    this.queues.set(webhookId, validTimestamps)
  }

  getWaitTime(webhookId: string): number {
    const now = Date.now()
    const queue = this.queues.get(webhookId) || []
    
    if (queue.length < this.maxMessages) return 0
    
    const oldestTimestamp = Math.min(...queue)
    const timeUntilExpiry = this.windowMs - (now - oldestTimestamp)
    return Math.max(0, timeUntilExpiry)
  }
}

const rateLimiter = new WebhookRateLimiter()

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get emoji for alert type
 */
function getAlertEmoji(alert: Alert): string {
  const type = alert.type
  if (type.includes('bull') || type === 'price_pump' || type === 'volume_spike') {
    return '🐂'
  }
  if (type.includes('bear') || type === 'price_dump' || type === 'volume_drop') {
    return '🐻'
  }
  if (type.includes('hunter')) {
    return '🎣'
  }
  if (type === 'vcp_signal') {
    return '📊'
  }
  if (type === 'fibonacci_break') {
    return '📈'
  }
  if (type === 'trend_reversal') {
    return '🔄'
  }
  return '🔔'
}

/**
 * Get Discord embed color for alert type
 */
function getAlertColor(alert: Alert): number {
  const type = String(alert.type || '') // Ensure it's a string
  
  // Debug log
  console.log(`🔍 getAlertColor called: type="${type}", severity="${alert.severity}"`)
  
  // Bull alerts = Green
  if (type.includes('bull') || type === 'price_pump' || type === 'volume_spike') {
    console.log('✅ Matched BULL → returning GREEN')
    return 0x10b981 // Green
  }
  // Bear alerts = Red
  if (type.includes('bear') || type === 'price_dump' || type === 'volume_drop') {
    console.log('✅ Matched BEAR → returning RED')
    return 0xef4444 // Red
  }
  // Hunter alerts = Purple
  if (type.includes('hunter')) {
    console.log('✅ Matched HUNTER → returning PURPLE')
    return 0xa855f7 // Purple
  }
  // Default: Use severity-based colors
  console.log(`⚠️ No match, using severity color for "${alert.severity}"`)
  return SEVERITY_COLORS[alert.severity]
}

/**
 * Format alert value based on type
 */
function formatAlertValue(alert: Alert): string {
  if (alert.type.includes('price')) {
    return `${alert.value > 0 ? '+' : ''}${alert.value.toFixed(2)}%`
  }
  if (alert.type.includes('volume')) {
    return `${(alert.value / 1000000).toFixed(2)}M`
  }
  return alert.value.toFixed(4)
}

/**
 * Send alert to Discord webhook
 */
export async function sendDiscordWebhook(
  webhookUrl: string,
  alert: Alert
): Promise<boolean> {
  console.log(`📤 sendDiscordWebhook called for ${alert.symbol} (${alert.type})`)
  
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    console.error('Invalid Discord webhook URL:', webhookUrl)
    return false
  }

  try {
    const emoji = getAlertEmoji(alert)
    const value = formatAlertValue(alert)
    const timestamp = new Date(alert.timestamp).toISOString()
    const color = getAlertColor(alert)
    
    // Debug: Log alert type and color
    console.log(`🎨 Discord webhook color for ${alert.symbol} (${alert.type}): ${color.toString(16)} ${color === 0x10b981 ? '(GREEN)' : color === 0xef4444 ? '(RED)' : color === 0xa855f7 ? '(PURPLE)' : '(OTHER)'}`)

    // Build Discord embed
    const embed = {
      title: `${emoji} ${alert.title}`,
      description: alert.message,
      color: color,
      fields: [
        {
          name: 'Symbol',
          value: alert.symbol,
          inline: true,
        },
        {
          name: 'Value',
          value: value,
          inline: true,
        },
        {
          name: 'Severity',
          value: alert.severity.toUpperCase(),
          inline: true,
        },
      ],
      timestamp: timestamp,
      footer: {
        text: 'Crypto Screener Alert',
      },
    }

    // Add timeframe if present
    if (alert.timeframe) {
      embed.fields.push({
        name: 'Timeframe',
        value: alert.timeframe,
        inline: true,
      })
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Discord webhook failed:', response.status, errorText)
      return false
    }

    console.log(`✅ Discord webhook sent: ${alert.symbol} - ${alert.title}`)
    return true
  } catch (error) {
    console.error('Failed to send Discord webhook:', error)
    return false
  }
}

/**
 * Test Discord webhook with a sample message
 */
export async function testDiscordWebhook(webhookUrl: string): Promise<boolean> {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    console.error('Invalid Discord webhook URL')
    return false
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [
          {
            title: '✅ Test Alert',
            description: 'Discord webhook integration is working correctly!',
            color: 0x10b981, // Green
            fields: [
              {
                name: 'Status',
                value: 'Connected',
                inline: true,
              },
              {
                name: 'Source',
                value: 'Crypto Screener',
                inline: true,
              },
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Crypto Screener Alert System',
            },
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Discord webhook test failed:', response.status, errorText)
      return false
    }

    console.log('✅ Discord webhook test successful')
    return true
  } catch (error) {
    console.error('Failed to test Discord webhook:', error)
    return false
  }
}

/**
 * Validate Discord webhook URL format
 */
export function isValidDiscordWebhookUrl(url: string): boolean {
  if (!url) return false
  
  try {
    const urlObj = new URL(url)
    return (
      urlObj.hostname === 'discord.com' ||
      urlObj.hostname === 'discordapp.com'
    ) && urlObj.pathname.startsWith('/api/webhooks/')
  } catch {
    return false
  }
}

/**
 * Send alert to Telegram bot
 */
export async function sendTelegramWebhook(
  botToken: string,
  chatId: string,
  alert: Alert
): Promise<boolean> {
  if (!botToken || !chatId) {
    console.error('Invalid Telegram credentials')
    return false
  }

  try {
    const emoji = getAlertEmoji(alert)
    const value = formatAlertValue(alert)
    const timestamp = new Date(alert.timestamp).toLocaleString()

    // Build Telegram message with HTML formatting
    let message = `${emoji} <b>${alert.title}</b>\n\n`
    message += `${alert.message}\n\n`
    message += `<b>Symbol:</b> ${alert.symbol}\n`
    message += `<b>Value:</b> ${value}\n`
    message += `<b>Severity:</b> ${alert.severity.toUpperCase()}\n`
    
    if (alert.timeframe) {
      message += `<b>Timeframe:</b> ${alert.timeframe}\n`
    }
    
    message += `\n<i>${timestamp}</i>`

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Telegram webhook failed:', response.status, errorText)
      return false
    }

    console.log(`✅ Telegram webhook sent: ${alert.symbol} - ${alert.title}`)
    return true
  } catch (error) {
    console.error('Failed to send Telegram webhook:', error)
    return false
  }
}

/**
 * Test Telegram webhook with a sample message
 */
export async function testTelegramWebhook(
  botToken: string,
  chatId: string
): Promise<boolean> {
  if (!botToken || !chatId) {
    console.error('Invalid Telegram credentials')
    return false
  }

  try {
    const message = `✅ <b>Test Alert</b>\n\nTelegram webhook integration is working correctly!\n\n<b>Status:</b> Connected\n<b>Source:</b> Crypto Screener`

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Telegram webhook test failed:', response.status, errorText)
      return false
    }

    console.log('✅ Telegram webhook test successful')
    return true
  } catch (error) {
    console.error('Failed to test Telegram webhook:', error)
    return false
  }
}

/**
 * Send webhook with rate limiting and retry logic
 */
export async function sendWebhookWithRetry(
  webhook: WebhookConfig,
  alert: Alert,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ success: boolean; attempts: number; error?: string }> {
  const webhookId = webhook.id

  // Check rate limit
  if (!rateLimiter.canSend(webhookId)) {
    const waitTime = rateLimiter.getWaitTime(webhookId)
    console.warn(`Webhook ${webhook.name} rate limited, wait ${waitTime}ms`)
    return {
      success: false,
      attempts: 0,
      error: `Rate limited. Wait ${Math.ceil(waitTime / 1000)}s`,
    }
  }

  let lastError: string = ''
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      let success = false

      if (webhook.type === 'discord') {
        success = await sendDiscordWebhook(webhook.url, alert)
      } else if (webhook.type === 'telegram') {
        // Extract bot token and chat ID from webhook URL or use separate fields
        // Format: telegram://botToken:chatId
        const match = webhook.url.match(/^telegram:\/\/([^:]+):(.+)$/)
        if (match) {
          const [, botToken, chatId] = match
          success = await sendTelegramWebhook(botToken, chatId, alert)
        } else {
          lastError = 'Invalid Telegram webhook format'
          break
        }
      }

      if (success) {
        rateLimiter.recordSend(webhookId)
        return { success: true, attempts: attempt }
      }

      lastError = 'Webhook delivery failed'
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Webhook attempt ${attempt}/${retryConfig.maxAttempts} failed:`, error)
    }

    // Don't retry on last attempt
    if (attempt < retryConfig.maxAttempts) {
      // Exponential backoff: baseDelay * 2^(attempt-1)
      const delay = Math.min(
        retryConfig.baseDelayMs * Math.pow(2, attempt - 1),
        retryConfig.maxDelayMs
      )
      console.log(`Retrying webhook in ${delay}ms...`)
      await sleep(delay)
    }
  }

  return {
    success: false,
    attempts: retryConfig.maxAttempts,
    error: lastError,
  }
}

/**
 * Send to multiple webhooks in parallel
 * Supports separate webhook lists for main and watchlist alerts
 */
export async function sendToWebhooks(
  webhooks: WebhookConfig[],
  alert: Alert,
  source: 'main' | 'watchlist' = 'main'
): Promise<Map<string, { success: boolean; attempts: number; error?: string }>> {
  const results = new Map()
  const enabledWebhooks = webhooks.filter(w => w.enabled)

  if (enabledWebhooks.length === 0) {
    console.log(`No enabled webhooks for ${source} alerts`)
    return results
  }

  console.log(`📤 Sending ${source} alert to ${enabledWebhooks.length} webhooks: ${alert.symbol}`)

  await Promise.all(
    enabledWebhooks.map(async (webhook) => {
      const result = await sendWebhookWithRetry(webhook, alert)
      results.set(webhook.id, result)
    })
  )

  return results
}
