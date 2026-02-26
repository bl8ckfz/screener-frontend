import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Vercel Serverless Function: Request Access
 *
 * Accepts a POST with { email: string }, validates it, rate-limits by IP,
 * then forwards a Discord embed to DISCORD_WAITLIST_WEBHOOK_URL.
 *
 * Environment variables required (set in Vercel dashboard):
 *   DISCORD_WAITLIST_WEBHOOK_URL  — Discord webhook URL for #waitlist channel
 */

// In-memory rate limit: 1 request per IP per 60 seconds
// Resets on cold start, but sufficient to prevent rapid-fire spam
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 60_000

function isRateLimited(ip: string): boolean {
  const last = rateLimitMap.get(ip)
  const now = Date.now()
  if (last && now - last < RATE_LIMIT_MS) return true
  rateLimitMap.set(ip, now)
  // Clean up entries older than 10 minutes to avoid memory growth
  if (rateLimitMap.size > 1000) {
    for (const [key, ts] of rateLimitMap.entries()) {
      if (now - ts > 600_000) rateLimitMap.delete(key)
    }
  }
  return false
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for same-origin Vercel requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limiting by IP
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Please wait a moment before trying again.' })
  }

  // Validate input
  const { email } = req.body ?? {}
  if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }

  const cleanEmail = email.trim().toLowerCase()

  // Webhook URL from environment
  const webhookUrl = process.env.DISCORD_WAITLIST_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('DISCORD_WAITLIST_WEBHOOK_URL is not set')
    return res.status(500).json({ error: 'Server configuration error.' })
  }

  // Send Discord embed
  const payload = {
    embeds: [
      {
        title: '📬 New Access Request — Pulsaryx',
        color: 0x3b82f6, // blue-500
        fields: [
          { name: 'Email', value: cleanEmail, inline: false },
          { name: 'IP', value: ip, inline: true },
          { name: 'Time', value: new Date().toUTCString(), inline: true },
        ],
        footer: { text: 'pulsaryx.com — waitlist' },
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
    console.error('request-access error:', err)
    return res.status(500).json({ error: 'Failed to send request. Please try again.' })
  }
}
