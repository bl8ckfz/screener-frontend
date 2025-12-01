# Deployment Guide - Crypto Screener

This guide covers deploying the Crypto Screener to Vercel with GitHub integration.

## Prerequisites

- [x] GitHub account with repository access
- [x] Vercel account (free tier sufficient)
- [x] Supabase project with credentials

## Quick Start

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel**: https://vercel.com/new
2. **Import Repository**:
   - Sign in with GitHub
   - Select `bl8ckfz/crypto-screener`
   - Click "Import"

3. **Configure Project**:
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)

4. **Add Environment Variables**:
   ```
   VITE_SUPABASE_URL=https://yygqcyfvhngxwpnakdtm.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

5. **Deploy**: Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

## Environment Variables

Set these in Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://yygqcyfvhngxwpnakdtm.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase anonymous key |

**Important**: Never commit these values to Git. They should only be in:
- Local `.env` file (gitignored)
- Vercel dashboard (encrypted storage)

## Deployment Configuration

The project includes `vercel.json` with:

- **Framework Detection**: Vite auto-detection
- **Build Settings**: `npm run build` → `dist/`
- **SPA Routing**: All routes redirect to `index.html`
- **Cache Headers**: Static assets cached for 1 year
- **Rewrite Rules**: Client-side routing support

## Automatic Deployments

Once connected to GitHub, Vercel automatically:

✅ **Production Deployments**: Every push to `main` branch  
✅ **Preview Deployments**: Every pull request  
✅ **Instant Rollback**: One-click rollback to any previous deployment

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your domain (e.g., `screener.yourdomain.com`)
3. Configure DNS records as shown
4. Wait for SSL certificate (automatic)

## CORS Proxy for Binance API

**Current Status**: Development uses `allorigins.win` proxy (not production-ready)

**Future Solution**: Add Vercel Serverless Function

Create `api/binance-proxy.ts`:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
}
```

Then update `src/config/api.ts` to use `/api/binance-proxy?url=...` in production.

## Performance Optimization

Vercel automatically provides:

✅ **Global CDN**: Edge network in 70+ regions  
✅ **HTTP/3**: Latest protocol support  
✅ **Brotli Compression**: Better than gzip  
✅ **Image Optimization**: Automatic (if using `<Image />`)  
✅ **Analytics**: Core Web Vitals tracking

## Monitoring

### Vercel Analytics (Built-in)
- Core Web Vitals (LCP, FID, CLS)
- Real user monitoring
- Performance insights

### Add Sentry (Optional)
```bash
npm install @sentry/react @sentry/vite-plugin
```

Update `vite.config.ts`:
```typescript
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "your-org",
      project: "crypto-screener",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Verify all dependencies in `package.json`
- Run `npm run build` locally to test

### Environment Variables Not Working
- Must start with `VITE_` prefix for client-side access
- Redeploy after adding/changing variables
- Check spelling and case sensitivity

### API CORS Errors
- Binance API requires proxy in production
- Mock data fallback should work offline
- Consider implementing Vercel serverless function

### Blank Page After Deploy
- Check browser console for errors
- Verify routing configuration in `vercel.json`
- Ensure `index.html` is in `dist/` folder

## Deployment Checklist

Before deploying:

- [ ] Run `npm run type-check` (no errors)
- [ ] Run `npm run lint` (no errors)
- [ ] Run `npm run build` (successful)
- [ ] Test production build: `npm run preview`
- [ ] Verify environment variables in Vercel
- [ ] Check `.gitignore` excludes `.env`
- [ ] Commit and push to GitHub
- [ ] Deploy via Vercel dashboard

After deployment:

- [ ] Test authentication (sign up/in/out)
- [ ] Test data sync (create watchlist, refresh browser)
- [ ] Test real-time sync (open two browser tabs)
- [ ] Test alerts (create rule, trigger condition)
- [ ] Test webhooks (Discord/Telegram delivery)
- [ ] Check performance (Lighthouse score >90)
- [ ] Monitor error tracking (Sentry/Vercel)

## Production URLs

- **Vercel Auto-generated**: `https://crypto-screener-*.vercel.app`
- **Custom Domain**: (configure in Vercel dashboard)
- **GitHub Repository**: https://github.com/bl8ckfz/crypto-screener

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Support**: https://vercel.com/support
- **GitHub Issues**: https://github.com/bl8ckfz/crypto-screener/issues

---

**Last Updated**: December 1, 2025  
**Status**: Phase 6.4 - Production Deployment
