import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Vercel Serverless Function: Request Subscription
 *
 * Called from ExpiredPage when a user clicks "Contact for Subscription".
 * Accepts { email: string, userId?: string }, rate-limits by email (24h),
 * then forwards a Discord embed to DISCORD_SUBSCRIPTION_WEBHOOK_URL.
 *
 * Environment variables required (set in Vercel dashboard):
 *   DISCORD_SUBSCRIPTION_WEBHOOK_URL  — Discord webhook URL for #subscriptions channel
 */

// In-memory rate limit: 1 request per email per 24 hours
// Resets on cold start, sufficient to prevent accidental double-sends
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000 // 24 hours

function isRateLimited(email: string): boolean {
  const last = rateLimitMap.get(email)
  const now = Date.now()
  if (last && now - last < RATE_LIMIT_MS) return true
  rateLimitMap.set(email, now)
  // Clean up stale entries
  if (rateLimitMap.size > 1000) {
    for (const [key, ts] of rateLimitMap.entries()) {
      if (now - ts > RATE_LIMIT_MS) rateLimitMap.delete(key)
    }
  }
  return false
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, userId } = req.body ?? {}

  if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }

  const cleanEmail = email.trim().toLowerCase()

  if (isRateLimited(cleanEmail)) {
    return res.status(429).json({ error: 'Request already sent. We will be in touch soon.' })
  }

  const webhookUrl = process.env.DISCORD_SUBSCRIPTION_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('DISCORD_SUBSCRIPTION_WEBHOOK_URL is not set')
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'

  const payload = {
    embeds: [
      {
        title: '💳 Subscription Request — Pulsaryx',
        color: 0xf97316, // orange-500
        fields: [
          { name: 'Email', value: cleanEmail, inline: false },
          { name: 'User ID', value: userId ?? 'unknown', inline: true },
          { name: 'IP', value: ip, inline: true },
          { name: 'Time', value: new Date().toUTCString(), inline: false },
        ],
        footer: { text: 'pulsaryx.com — subscription request' },
      },
    ],
  }

  try {
    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!discordRes.ok) {
      console.error('Discord webhook error:', discordRes.status, await discordRes.text())
      return res.status(500).json({ error: 'Failed to send request. Please try again.' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('request-subscription error:', err)
    return res.status(500).json({ error: 'Failed to send request. Please try again.' })
  }
}
