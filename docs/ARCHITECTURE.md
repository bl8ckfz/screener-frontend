# Frontend Architecture - January 2026

## Overview

The frontend has been refactored from a 3,029-line monolithic HTML file into a modern React application that consumes processed data from a Go backend. This document describes the current architecture after the Week 2 cleanup.

## Core Principles

1. **Backend-First**: All data processing, indicator calculations, and alert evaluation happen in the Go backend
2. **Presentation Layer**: Frontend focuses solely on displaying data and handling user interactions
3. **Separation of Concerns**: Real-time metrics (backend) vs historical charts (Binance API)
4. **Type Safety**: Full TypeScript coverage with strict mode enabled
5. **Performance**: Code splitting, lazy loading, memoization for 43 simultaneous data streams

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Components   │    │    Hooks     │    │   Services   │  │
│  │              │    │              │    │              │  │
│  │ • CoinTable  │───▶│useBackendData│───▶│ backendApi   │  │
│  │ • CoinModal  │    │              │    │              │  │
│  │ • Charts     │    │useBackendAler│───▶│ (WebSocket)  │  │
│  │ • Controls   │    │              │    │              │  │
│  │              │    │useMarketStats│    │  chartData   │  │
│  └──────────────┘    └──────────────┘    │  (Binance)   │  │
│                                           └──────────────┘  │
│                                                  │           │
└──────────────────────────────────────────────────┼───────────┘
                                                   │
                        ┌──────────────────────────┼───────────┐
                        │                          ▼           │
                        │         ┌────────────────────────┐   │
                        │         │   Backend API          │   │
                        │         │   (Railway.app)        │   │
                        │         ├────────────────────────┤   │
                        │         │ GET /api/metrics/      │   │
                        │         │ GET /api/health        │   │
                        │         │ WS  /ws/alerts         │   │
                        │         └────────────────────────┘   │
                        │                                       │
                        │         ┌────────────────────────┐   │
                        │         │   Binance Futures API  │   │
                        │         ├────────────────────────┤   │
                        │         │ GET /fapi/v1/klines    │   │
                        │         └────────────────────────┘   │
                        └───────────────────────────────────────┘
```

## Directory Structure

```
src/
├── components/           # React components (presentation)
│   ├── coin/            # Coin-specific components
│   │   ├── CoinTable.tsx           # Main data grid
│   │   ├── VirtualizedCoinTable.tsx # Performance-optimized table
│   │   ├── CoinModal.tsx           # Detail view
│   │   ├── ChartSection.tsx        # Chart display (Binance data)
│   │   └── ...
│   ├── controls/        # User controls
│   ├── market/          # Market-level components
│   ├── alerts/          # Alert management UI
│   └── ui/              # Reusable UI components
│
├── hooks/               # Custom React hooks
│   ├── useBackendData.ts    # Primary data source (120 lines)
│   ├── useBackendAlerts.ts  # WebSocket alerts
│   ├── useMarketStats.ts    # Market aggregation
│   └── useStore.ts          # Global state (Zustand)
│
├── services/            # External service integrations
│   ├── backendApi.ts        # Backend HTTP client
│   ├── chartData.ts         # Binance chart data (172 lines)
│   ├── storage.ts           # LocalStorage/IndexedDB
│   └── syncService.ts       # Supabase sync
│
├── utils/               # Utility functions
│   ├── format.ts            # Number/date formatting
│   ├── sort.ts              # Client-side sorting
│   └── export.ts            # CSV/JSON export
│
└── types/               # TypeScript definitions
    ├── coin.ts              # Core data model
    ├── alert.ts             # Alert types
    └── config.ts            # User preferences

```

## Data Flow

### Real-Time Metrics (Every 5 seconds)

```
Backend API (43 symbols)
  ↓ HTTP GET /api/metrics/
useBackendData hook (TanStack Query)
  ↓ Transform: SymbolMetrics → Coin type
Coin[] state
  ↓ Props
CoinTable component
  ↓ Render
User sees updated prices, VCP, indicators
```

### Alert System

```
Backend Alert Engine
  ↓ WebSocket /ws/alerts
useBackendAlerts hook
  ↓ Message parsing
Alert state (Zustand)
  ↓ Notification
Browser notification + UI badge
```

### Charts (On-Demand)

```
User clicks coin → Modal opens
  ↓
ChartSection requests data
  ↓ fetchKlines(symbol, interval, limit)
Binance Futures API
  ↓ Candlestick[]
TradingChart component
  ↓ lightweight-charts library
Chart rendered with volume, VWAP
```

## Key Components

### useBackendData.ts (Primary Data Hook)

**Purpose**: Fetch and transform backend metrics into frontend `Coin` type

**Features**:
- TanStack Query for caching and automatic refetching
- 5-second polling interval (matches backend update frequency)
- Transforms 43 symbols from backend format
- Maps timeframe data (5m, 15m, 1h, 4h, 8h, 1d)
- Calculates price changes across multiple timeframes
- Exponential backoff on errors

**Type Transformation**:
```typescript
Backend: { symbol, timeframes: { "5m": { open, high, low, close, volume, vcp, rsi, macd, fibonacci } } }
         ↓
Frontend: { symbol, fullSymbol, lastPrice, vcp, rsi, macd, resistance1, support1, priceChange5m, ... }
```

### chartData.ts (Chart Data Service)

**Purpose**: Fetch historical candlestick data from Binance Futures API

**Why Separate from Backend**:
- Backend has only 48-hour retention (TimescaleDB optimization)
- Charts need 100-1500 candles for proper visualization
- Binance provides free, complete historical data
- On-demand fetching (only when user opens chart)

**CORS Handling**:
- Development: `allorigins.win` proxy
- Production: Direct API calls (same origin policy satisfied)

### useStore.ts (Global State)

**Managed State**:
- Current currency pair (USDT/TRY/FDUSD)
- Sorting preferences (field + direction)
- User configuration (theme, notifications, etc.)
- Alert rules and settings
- Watchlist

**Persistence**: Zustand middleware persists to localStorage

## Deleted Legacy Code (Week 2 Cleanup)

**31 Files Removed**:
- 14 API/data services (binanceApi, dataProcessor, futuresMetrics, etc.)
- 4 hooks (useMarketData 978 lines, useFuturesStreaming, etc.)
- 4 utils (indicators, ring buffers, sliding windows)
- 9 test files
- 4 backup files

**Replaced With**:
- Single 120-line `useBackendData.ts` hook
- Backend handles all calculations
- 5 temporary stubs (will be replaced with backend APIs)

## Performance Optimizations

1. **Virtual Scrolling**: `VirtualizedCoinTable` for 43 coins
2. **Memoization**: `useMemo` for filtered/sorted arrays
3. **Code Splitting**: React.lazy for modal components
4. **Debouncing**: Search input (300ms delay)
5. **TanStack Query**: Automatic caching, deduplication, background updates

## Testing Strategy

**Unit Tests**: Utility functions (format, sort, export)
**Integration Tests**: API services with mocked responses
**E2E Tests**: User workflows (filter, sort, alert creation)

**Current Coverage**: ~40% (target: 80%)

## Future Improvements

### Phase 3 (In Progress)
- [ ] Implement backend chart API (`/api/chart/klines`)
- [ ] Add backend alert history API
- [ ] Add backend webhook management API
- [ ] Remove temporary stubs
- [ ] Achieve 100% TypeScript compliance

### Phase 4 (Planned)
- [ ] Implement alert batching UI
- [ ] Add advanced filtering (multi-criteria)
- [ ] Improve chart interactions (drawing tools, indicators)
- [ ] Add export to PNG/PDF

## Dependencies

**Core**:
- React 18.3.1
- TypeScript 5.6.3
- Vite 5.4.21

**State & Data**:
- @tanstack/react-query 5.62.8
- zustand 5.0.2

**UI**:
- tailwindcss 3.4.17
- lightweight-charts 4.2.2 (charts)

**Utilities**:
- date-fns 4.1.0
- clsx 2.1.1

**Backend Integration**:
- @supabase/supabase-js 2.47.10
- websocket (browser native)

## Environment Variables

```bash
# Backend API (Production)
VITE_BACKEND_API_URL=https://api-gateway-production-f4ba.up.railway.app
VITE_BACKEND_WS_URL=wss://api-gateway-production-f4ba.up.railway.app

# Supabase (User authentication & sync)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Deployment

**Current**: Vercel (automatic deployment from `main` branch)
**Build Command**: `npm run build`
**Output**: `dist/` directory
**Bundle Size**: 71.84KB gzipped (target: <100KB)

## Migration Notes

**From Legacy (`fast.html`) to Current**:
1. All Binance API calls moved to `chartData.ts` (charts only)
2. Real-time data now comes from backend
3. Alert evaluation happens server-side
4. VCP/Fibonacci/RSI calculated by backend
5. Webhooks executed by backend (frontend only configures)

**Backward Compatibility**: None - this is a complete rewrite
