# Deployment Guide - Crypto Screener

Frontend deploys to **Vercel** (auto-deploy from `main` branch).  
Backend (Railway) is deployed separately — see [screener-backend](../../screener-backend).

**Last Updated**: March 2026

---

## Prerequisites

- GitHub account with repository access
- Vercel account (free tier sufficient)
- Railway backend already running (provides `VITE_BACKEND_API_URL`)

## Quick Start

### Option 1: Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Import `bl8ckfz/crypto-screener` from GitHub
3. Framework preset: **Vite** (auto-detected)
4. Add environment variables (see below)
5. Click **Deploy**

### Option 2: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

---

## Environment Variables

Set these in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `VITE_BACKEND_API_URL` | `https://api-gateway-production-f4ba.up.railway.app` | Go backend base URL |
| `VITE_BACKEND_WS_URL` | `wss://api-gateway-production-f4ba.up.railway.app` | WebSocket for alerts |

> **Never commit `.env` to Git.** These values are only in `.env.local` (gitignored) and the Vercel dashboard.

### Local Development

```bash
cp .env.example .env.local
# Edit .env.local with values above
npm run dev
```

---

## Vercel Configuration

`vercel.json` in repo root handles:
- SPA routing (all routes → `index.html`)
- Static asset cache headers (1 year)
- Build: `npm run build` → `dist/`

---

## Automatic Deployments

Once connected to GitHub:
- ✅ **Production**: every push to `main`
- ✅ **Preview**: every pull request
- ✅ **Instant rollback**: one-click in Vercel dashboard

---

## Chart Data (Binance Futures API)

Charts call `https://fapi.binance.com/fapi/v1/klines` directly from the browser.  
In development this goes through the `allorigins.win` CORS proxy (configured in `src/config/api.ts`).  
In production the browser calls Binance directly (Binance allows cross-origin reads on klines).

If Binance rate-limits become an issue, add a Vercel serverless function:

```typescript
// api/binance-proxy.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url' })
  const response = await fetch(url)
  const data = await response.json()
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate')
  res.json(data)
}
```

---

## Performance (Vercel built-in)

- Global CDN (70+ edge regions)
- Brotli compression
- HTTP/3
- Core Web Vitals analytics

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails | Run `npm run build` locally first to reproduce |
| Env vars not working | Must start with `VITE_`; redeploy after adding |
| Blank page | Check browser console; verify `vercel.json` SPA rewrite |
| Backend unreachable | Check Railway deployment is running; verify `VITE_BACKEND_API_URL` |

---

## Deployment Checklist

**Before deploying:**
- [ ] `npm run type-check` — 0 errors
- [ ] `npm run lint` — 0 warnings
- [ ] `npm run build` — successful
- [ ] `npm run preview` — verify production build
- [ ] Env vars set in Vercel dashboard
- [ ] `.gitignore` excludes `.env.local`

**After deploying:**
- [ ] Backend health: `curl $VITE_BACKEND_API_URL/api/health`
- [ ] Data loads within 5 seconds
- [ ] Alert WebSocket connects
- [ ] Charts load (Binance klines)
- [ ] Auth (login / JWT refresh)
- [ ] Webhooks deliver (Discord / Telegram test)

---

## Production URLs

- **Vercel**: `https://crypto-screener-*.vercel.app`
- **Backend (Railway)**: `https://api-gateway-production-f4ba.up.railway.app`
- **GitHub**: https://github.com/bl8ckfz/crypto-screener
