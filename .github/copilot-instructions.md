# AI Coding Agent Instructions - Crypto Screener Frontend

## Project Overview

Real-time cryptocurrency market screener — a React/TypeScript **presentation layer** consuming a Go backend (Railway). All market data processing, indicator calculations (VCP, RSI, MACD, Fibonacci), and alert evaluation are done server-side.

**Current State** (March 2026):
- **Architecture**: Backend-first. Frontend fetches pre-computed metrics from the Go backend every 5 seconds.
- **Auth**: Custom JWT (Go backend). Supabase was removed January 27, 2026.
- **Symbols**: 43 Binance Futures pairs
- **Bundle**: 71.84KB gzipped | TypeScript errors: 0
- **Major cleanup (Jan 27, 2026)**: 31 legacy files deleted — local alertEngine, ring buffer, Binance API client, CoinGecko, timeframe service, `useMarketData`, `indicators.ts`, `dataProcessor.ts`, etc.

**Next planned work**: Auth wall / landing page (`AUTH_WALL_ROADMAP.md`), alert-centric UI redesign (`UI_REDESIGN_ALERT_CENTRIC_ROADMAP.md`).

## Core Architecture

### Data Flow Pipeline

```
Go Backend (Railway)
  └─ GET /api/metrics (every 5s)
       ↓ useBackendData.ts (TanStack Query)
       ↓ transform → Coin[]
       ↓ useStore.ts (Zustand — sorting, filters, config)
       ↓ Components (CoinTable, CoinModal, MarketSummary, etc.)

Go Backend (Railway)
  └─ WebSocket /ws/alerts
       ↓ useBackendAlerts.ts
       ↓ store.addAlert()
       ↓ AlertHistory, toast notifications, webhook delivery
```

**Charts only**: `chartData.ts` → Binance Futures API `fapi.binance.com/fapi/v1/klines` (on-demand, when user opens chart modal)

### Active Services (`src/services/`)
- `backendApi.ts` — HTTP client for Go backend (metrics, auth, watchlists)
- `authService.ts` — Custom JWT auth (login, refresh, logout)
- `watchlistService.ts` — Watchlist CRUD
- `alertHistoryService.ts` — Local alert history (localStorage)
- `webhookService.ts` — Discord/Telegram webhook delivery
- `chartData.ts` — Binance Futures klines for TradingView charts
- `storage.ts` — LocalStorage wrapper
- `notification.ts` / `audioNotification.ts` — Browser notifications + audio

### Active Hooks (`src/hooks/`)
- `useBackendData.ts` — Primary data source; polls `/api/metrics` every 5s
- `useBackendAlerts.ts` — WebSocket alert listener; pushes to Zustand store
- `useAuth.tsx` — Auth context (login/logout/session)
- `useStore.ts` — Global Zustand state (coins, settings, alerts, config)
- `useAlertRules.ts` / `useAlertStats.ts` — Alert rule management
- `useMarketStats.ts` — Aggregated market statistics
- `usePriceFlash.ts` — Price change flash animations
- `useAutoHideHeader.ts` — Auto-hide toolbar on scroll

### State Management
- **Server state**: TanStack Query in `useBackendData` — caching, polling, error handling
- **Global state**: Zustand (`useStore`) — coins, config, alerts, watchlists (persisted to localStorage)
- **Local state**: React `useState`/`useMemo` for UI-only state

**Rule**: TanStack Query owns server data. Zustand owns user preferences and UI state. Never duplicate.

## Development Workflows

```bash
npm run dev          # localhost:3000
npm run build        # production build
npm run type-check   # ALWAYS run before commits (strict mode)
npm run lint:fix     # auto-fix ESLint
npm run format       # Prettier
npm test             # Vitest watch mode
npm run test:coverage
```

**Required**: All commits must pass `npm run type-check && npm run lint` with 0 errors.

### Path Aliases
Use `@/` prefix for all imports (configured in `vite.config.ts`):
```typescript
import { useBackendData } from '@/hooks'
import { Button } from '@/components/ui'
import type { Coin } from '@/types'
```

## Component Architecture

```
<Layout>
  ├── Header (auto-hide on scroll)
  ├── Controls (PairSelector, TimeframeSelector)
  ├── MarketSummary
  ├── CoinTable → CoinRow (sortable, filterable)
  ├── CoinModal → ChartSection (TradingView) + metrics
  └── AlertHistory / WebhookManager
```

- **UI Components** (`src/components/ui/`): Presentational only, no hooks except `useState`
- **Feature Components**: Can use any hooks; handle business logic
- **Barrel exports**: Every component directory has `index.ts`
- **Styling**: Tailwind utility classes, semantic vars (`text-bullish`, `text-bearish`)

## Type System

All types in `src/types/` with barrel export via `index.ts`. Import from `@/types` only:
- `coin.ts` — Core data model (43 symbols, 6 timeframes)
- `alert.ts` — Alert types (includes `source: 'main' | 'watchlist'`)
- `config.ts` — User preferences with defaults
- `api.ts` — Backend API contracts

## Performance Optimizations

```javascript
// vite.config.ts code splitting
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'query-vendor': ['@tanstack/react-query'],
  'chart-vendor': ['lightweight-charts'],
}
```

```typescript
// Memoize expensive filtered/sorted arrays
const sorted = useMemo(() => sortCoins(coins, sortKey), [coins, sortKey])
// Don't memoize trivial derivations
```

VirtualizedCoinTable activates for 50+ coins (`@tanstack/react-virtual`).

## Critical Gotchas

1. **No local indicators**: `indicators.ts`, `dataProcessor.ts`, `binanceApi.ts` were deleted Jan 2026. All VCP/RSI/Fibonacci come from the backend as pre-computed values.
2. **No Supabase**: Auth and persistence are via custom JWT + localStorage. No Supabase env vars.
3. **Chart data is separate**: `chartData.ts` calls Binance Futures API directly for klines. This is the only place the frontend talks to Binance.
4. **CORS proxy dev-only**: `allorigins.win` proxy is only used for development chart fetches.
5. **Zustand persistence**: Changes to `DEFAULT_CONFIG` won't override existing localStorage — users may need to clear storage after breaking changes.
6. **Alert source field**: All `Alert` objects have `source: 'main' | 'watchlist'`. Legacy alerts without this field are treated as `'main'`.
7. **Timeframes**: `5m | 15m | 1h | 4h | 8h | 1d` — all computed by backend, stored in each `Coin` object.

## Essential Files

### Understand data flow
1. `src/hooks/useBackendData.ts` — polls backend, transforms response to `Coin[]`
2. `src/services/backendApi.ts` — HTTP client (endpoints, types, error handling)
3. `src/hooks/useBackendAlerts.ts` — WebSocket listener for real-time alerts
4. `src/types/coin.ts` — core data model

### Understand current state
1. `docs/ARCHITECTURE.md` — backend-first architecture diagram and data flow
2. `docs/ROADMAP.md` — completed phases + current priorities
3. `docs/WEEK2_CLEANUP_COMPLETE.md` — audit of what was deleted Jan 27, 2026
4. `README.md` — setup, env vars, scripts

### For active feature work
- Auth wall: `docs/AUTH_WALL_ROADMAP.md`
- UI redesign: `docs/UI_REDESIGN_ALERT_CENTRIC_ROADMAP.md`
- Alert colors: `docs/ALERT_COLOR_PICKER_ROADMAP.md`
- Deployment: `docs/DEPLOYMENT.md`

## Before Starting Any Task

1. Check `docs/ROADMAP.md` — is this already planned?
2. Check `docs/ARCHITECTURE.md` — understand current data flow constraints
3. Run `npm run type-check` to get baseline (must be 0 errors)

## When to Update docs/ROADMAP.md

- Completing a major milestone (add ✅)
- Discovering a new pattern or constraint worth tracking
- Completing or starting one of the active feature roadmaps
