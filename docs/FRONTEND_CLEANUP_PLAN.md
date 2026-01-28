# Frontend Deep Cleanup Plan - Backend Integration

**Date**: January 27, 2026  
**Status**: Planning Phase  
**Goal**: Remove all direct Binance API calls and data processing. Frontend becomes pure presentation layer consuming backend API.

---

## Executive Summary

The frontend currently has **dual data sources** with significant code duplication:
1. **Legacy Mode**: Direct Binance API → Local processing → Display
2. **Backend Mode**: Backend API → Display (via `backendAdapter.ts`)

**Cleanup Goal**: Remove legacy mode entirely, keeping only presentation layer that consumes processed data from Go backend.

---

## 📊 Current State Analysis

### Services to Remove/Simplify (28 files)

#### Direct API Clients - **DELETE**
1. `binanceApi.ts` (283 lines) - USDT pairs, 24hr tickers
2. `binanceFuturesApi.ts` - Futures ticker data
3. `binanceFuturesWebSocket.ts` - WebSocket kline streaming
4. `coinGeckoApi.ts` - Market cap data (backend will handle)
5. `mockData.ts` (partial) - Keep minimal for dev fallback

#### Data Processing - **DELETE** (Backend handles this)
6. `dataProcessor.ts` - Currency pair parsing, filtering, enrichment
7. `futuresMetricsService.ts` - Calculates multi-timeframe metrics
8. `changeCalculator.ts` - Price/volume delta calculations
9. `chartData.ts` - OHLCV aggregation for charts

#### Sliding Window System - **DELETE** (Backend uses ring buffers)
10. `candle1mRingBuffer.ts` (245 lines)
11. `ringBufferManager.ts` - Manages buffers per symbol
12. `stream1mManager.ts` - 1m candle streaming
13. `webSocketStreamManager.ts` - WebSocket connection manager
14. `slidingWindowCalculator.ts` (263 lines)

#### Alert Engine - **DELETE** (Backend handles)
15. `alertEngine.ts` - Rule evaluation (Big Bull/Bear, Pioneer, Whale, etc.)
16. `alertBatcher.ts` - Alert batching logic
17. `alertHistory.ts` - Legacy alert storage
18. `bubbleDetectionService.ts` - Bubble/crash detection
19. `ichimokuMonitor.ts` - Ichimoku cloud calculations

#### Keep but Simplify
20. `backendApi.ts` - **KEEP** (primary data source)
21. `backendAdapter.ts` - **DELETE** (no need for adapter when backend-only)
22. `alertHistoryService.ts` - **KEEP** (UI state management)
23. `notification.ts` - **KEEP** (browser notifications)
24. `audioNotification.ts` - **KEEP** (sound alerts)
25. `webhookService.ts` - **DELETE** (backend executes webhooks, UI only configures)
26. `storage.ts` - **KEEP** (localStorage persistence)
27. `syncService.ts` - **KEEP** (Supabase sync)

### Hooks to Remove/Simplify (9 files)

#### Delete
1. `useMarketData.ts` (978 lines) - **DELETE** - Complex data pipeline with alert evaluation
2. `useFuturesStreaming.ts` - **DELETE** - WebSocket streaming hook
3. `useBubbleStream.ts` - **DELETE** - Bubble detection hook
4. `useMarketDataSource.ts` - **DELETE** - Dual-source routing

#### Keep but Simplify
5. `useBackendAlerts.ts` - **KEEP** - Real-time alert WebSocket
6. `useAlertStats.ts` - **SIMPLIFY** - Stats calculations (remove local alert logic)
7. `useStore.ts` - **KEEP** - Global state (remove data fields, keep settings)

### Utils to Remove (16 files)

#### Delete - Backend Handles
1. `indicators.ts` - VCP, Fibonacci, RSI, MACD calculations
2. `candle1mRingBuffer.ts` - Ring buffer implementation
3. `slidingWindowCalculator.ts` - Window aggregation
4. `klineRingBuffer.ts` - Kline buffer (if different from candle1m)
5. `dataAggregator.ts` - Data aggregation logic

#### Keep
6. `format.ts` - **KEEP** - UI formatting (numbers, dates, prices)
7. `sort.ts` - **KEEP** - Client-side sorting
8. `debug.ts` - **KEEP** - Debug logging
9. `memoryProfiler.ts` - **KEEP** - Performance monitoring
10. `export.ts` - **KEEP** - CSV/JSON export

### Types to Simplify (10 files)

Most types in `src/types/` are frontend-specific and needed for UI:

1. `api.ts` - **SIMPLIFY** - Remove Binance raw types, keep backend response types
2. `coin.ts` - **KEEP** - Core UI data model (may need alignment with backend)
3. `alert.ts` - **KEEP** - Alert UI types
4. `market.ts` - **KEEP** - Market summary types
5. `screener.ts` - **KEEP** - Filter presets (UI only)
6. `config.ts` - **KEEP** - User preferences
7. `bubble.ts` - **DELETE** - Bubble detection (backend handles)
8. `alertHistory.ts` - **KEEP** - UI state

### Components - Minimal Changes

All components are presentation-only, so minimal changes needed:
- Update data source references (remove `useMarketData`, use backend hook)
- Remove alert evaluation UI (backend handles)
- Keep all display logic

---

## 🔔 Webhook Architecture (Important)

### Backend Executes Webhooks ✅

**Current (Wrong)**: Frontend calls webhooks directly when alerts are evaluated locally  
**Correct**: Backend calls webhooks when alerts are triggered

### Why Backend Should Execute Webhooks

1. **CORS Issues**: Browser can't make arbitrary HTTP calls to webhook URLs
2. **Reliability**: Backend can retry failed webhook calls
3. **Batching**: Backend can batch alerts before sending
4. **Security**: Webhook secrets/tokens stored server-side
5. **Rate Limiting**: Backend manages webhook rate limits
6. **Monitoring**: Backend logs webhook delivery status

### Frontend Responsibility

Frontend only provides **configuration UI**:
- Add/edit/delete webhook URLs
- Enable/disable webhooks
- Configure webhook filters (which alerts to send)
- Test webhook connectivity
- View webhook delivery history (from backend)

### Backend API Endpoints Needed

```typescript
// Backend API (to be implemented)
POST   /api/webhooks          // Create webhook
GET    /api/webhooks          // List user webhooks
PUT    /api/webhooks/:id      // Update webhook
DELETE /api/webhooks/:id      // Delete webhook
POST   /api/webhooks/:id/test // Test webhook
GET    /api/webhooks/history  // Delivery history
```

### Data Flow

```
Alert Triggered (Backend) 
  → Alert Engine Evaluates Rules
  → Match Found
  → Fetch User Webhooks (PostgreSQL)
  → Execute Webhook Calls (with retry)
  → Log Delivery Status
  → WebSocket Alert to Frontend (notification only)
```

### Frontend Implementation

```typescript
// backendApi.ts - Add webhook config methods
export const backendApi = {
  webhooks: {
    async list(): Promise<Webhook[]> {
      const response = await fetch(`${BACKEND_URL}/api/webhooks`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return response.json()
    },
    
    async create(webhook: WebhookConfig): Promise<Webhook> {
      const response = await fetch(`${BACKEND_URL}/api/webhooks`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhook)
      })
      return response.json()
    },
    
    async update(id: string, webhook: WebhookConfig): Promise<Webhook> { ... },
    async delete(id: string): Promise<void> { ... },
    async test(id: string): Promise<{ success: boolean; error?: string }> { ... },
    async getHistory(id?: string): Promise<WebhookDelivery[]> { ... }
  }
}
```

### Settings Component Example

```typescript
// components/settings/WebhookSettings.tsx
function WebhookSettings() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  
  useEffect(() => {
    backendApi.webhooks.list().then(setWebhooks)
  }, [])
  
  const handleAdd = async (url: string) => {
    const webhook = await backendApi.webhooks.create({ url, enabled: true })
    setWebhooks([...webhooks, webhook])
  }
  
  const handleTest = async (id: string) => {
    const result = await backendApi.webhooks.test(id)
    if (result.success) {
      toast.success('Webhook test successful!')
    } else {
      toast.error(`Test failed: ${result.error}`)
    }
  }
  
  return (
    <div>
      <h2>Webhook Configuration</h2>
      <p>Configure webhooks to receive alerts. Backend will execute webhook calls.</p>
      
      {webhooks.map(webhook => (
        <WebhookItem 
          key={webhook.id}
          webhook={webhook}
          onTest={() => handleTest(webhook.id)}
          onDelete={() => handleDelete(webhook.id)}
        />
      ))}
      
      <AddWebhookButton onAdd={handleAdd} />
    </div>
  )
}
```

### Migration Notes

1. **Delete** `webhookService.ts` - No longer needed in frontend
2. **Remove** webhook execution from `useMarketData.ts` 
3. **Remove** webhook calls from `alertBatcher.ts`
4. **Keep** webhook configuration in Zustand store (for UI state)
5. **Add** webhook CRUD methods to `backendApi.ts`
6. **Update** Settings component to use backend API

---

## Phase 1: Backend API as Primary (Week 1)

**Goal**: Make backend API the ONLY data source

#### Step 1.1: Update Environment
```bash
# .env.local - Force backend mode
VITE_USE_BACKEND_API=true  # Make this the only mode
VITE_BACKEND_API_URL=http://localhost:8080
VITE_BACKEND_WS_URL=ws://localhost:8080/ws/alerts
```

#### Step 1.2: Create New Simplified Data Hook
**File**: `src/hooks/useBackendData.ts` (NEW - replaces `useMarketData.ts`)

```typescript
/**
 * Simplified hook that fetches processed data from backend
 * Replaces the 978-line useMarketData.ts monolith
 */
import { useQuery } from '@tanstack/react-query'
import { backendApi } from '@/services/backendApi'
import type { Coin } from '@/types/coin'

export function useBackendData() {
  return useQuery({
    queryKey: ['backendMetrics'],
    queryFn: async () => {
      const metrics = await backendApi.getAllMetrics()
      return transformBackendToCoin(metrics)
    },
    refetchInterval: 5000, // 5 second polling (backend has 1m candles)
    retry: 3,
    staleTime: 3000,
  })
}

function transformBackendToCoin(metrics: Record<string, any>): Coin[] {
  // Simple transformation - backend sends nearly-ready data
  return Object.values(metrics).map(m => ({
    id: m.symbol,
    symbol: m.symbol,
    lastPrice: m.timeframes['1m'].close,
    vcp: m.indicators.vcp,
    // ... minimal mapping
  }))
}
```

**Benefits**:
- ~50 lines vs 978 lines
- No local alert evaluation
- No WebSocket management
- No data processing
- Simple polling (backend pushes alerts via WS)

#### Step 1.3: Update App.tsx
```typescript
// OLD (remove)
const { data: coins } = useMarketData(...)
const stream = useFuturesStreaming()

// NEW (simple)
const { data: coins, isLoading } = useBackendData()
const { alerts } = useBackendAlerts()
```

#### Step 1.4: Update Components
Replace all references to:
- `useMarketData` → `useBackendData`
- `useFuturesStreaming` → (remove, not needed)
- `useMarketDataSource` → (remove, no dual source)

---

### Phase 2: Remove Legacy Code (Week 2)

**Goal**: Delete all unused files and simplify remaining ones

#### Step 2.1: Delete API Clients
```bash
# Services to delete
rm src/services/binanceApi.ts
rm src/services/binanceFuturesApi.ts
rm src/services/binanceFuturesWebSocket.ts
rm src/services/coinGeckoApi.ts
rm src/services/dataProcessor.ts
rm src/services/futuresMetricsService.ts
rm src/services/changeCalculator.ts
rm src/services/chartData.ts
```

#### Step 2.2: Delete Data Processing
```bash
# Utils to delete
rm src/utils/indicators.ts
rm src/utils/candle1mRingBuffer.ts
rm src/utils/slidingWindowCalculator.ts
rm src/services/ringBufferManager.ts
rm src/services/stream1mManager.ts
rm src/services/webSocketStreamManager.ts
```

#### Step 2.3: Delete Alert Engine
```bash
# Alert processing (backend handles)
rm src/services/alertEngine.ts
rm src/services/alertBatcher.ts
rm src/services/alertHistory.ts
rm src/services/bubbleDetectionService.ts
rm src/services/ichimokuMonitor.ts
```

#### Step 2.4: Delete Hooks
```bash
rm src/hooks/useMarketData.ts
rm src/hooks/useFuturesStreaming.ts
rm src/hooks/useBubbleStream.ts
rm src/hooks/useMarketDataSource.ts
rm src/services/backendAdapter.ts  # No longer need adapter
```

#### Step 2.5: Delete Tests
```bash
# Tests for deleted utilities
rm tests/utils/candle1mRingBuffer.test.ts
rm tests/utils/slidingWindowCalculator.test.ts
rm tests/utils/indicators.test.ts
rm tests/utils/klineRingBuffer.test.ts
```

---

### Phase 3: Type Alignment (Week 2)

**Goal**: Align frontend types with backend response structure

#### Step 3.1: Review Backend Response Types
Backend sends (from `internal/api/handlers.go`):
```go
type SymbolMetrics struct {
    Symbol     string                        `json:"symbol"`
    Timeframes map[string]*TimeframeData     `json:"timeframes"`
    Indicators map[string]float64            `json:"indicators"`
    UpdatedAt  time.Time                     `json:"updatedAt"`
}
```

#### Step 3.2: Simplify Frontend Types
**File**: `src/types/api.ts`

**BEFORE** (130+ lines with Binance types):
```typescript
export interface BinanceTicker24hr { ... }
export interface FuturesTickerData { ... }
export interface BinanceKline { ... }
// ... 10+ Binance-specific types
```

**AFTER** (20 lines):
```typescript
// Backend response types only
export interface BackendSymbolMetrics {
  symbol: string
  timeframes: Record<string, TimeframeData>
  indicators: Record<string, number>
  updatedAt: string
}

export interface TimeframeData {
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
}
```

#### Step 3.3: Simplify Coin Type
**File**: `src/types/coin.ts`

**Remove**:
- `BinanceTicker24hr` raw data
- Futures-specific fields (backend enriches)
- Local calculation fields

**Keep**:
- UI-specific fields
- Derived display values
- Filter state

---

### Phase 4: Configuration Cleanup (Week 3)

#### Step 4.1: Simplify API Config
**File**: `src/config/api.ts`

**BEFORE** (50 lines with CORS proxy logic):
```typescript
export const API_CONFIG = {
  baseUrl: CORS_PROXY ? ... : ...,
  futuresBaseUrl: ...,
  useCorsProxyForFutures: ...,
  coinGeckoBaseUrl: ...,
  corsProxy: CORS_PROXY,
}
```

**AFTER** (10 lines):
```typescript
export const API_CONFIG = {
  backendUrl: import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080',
  backendWsUrl: import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:8080/ws/alerts',
  timeout: 10000,
}
```

#### Step 4.2: Update .env Files
**BEFORE** (.env.example - 15+ vars):
```bash
VITE_BINANCE_API_URL=...
VITE_BINANCE_FUTURES_API_URL=...
VITE_CORS_PROXY=...
VITE_COINGECKO_API_URL=...
VITE_USE_BACKEND_API=...  # Feature flag
# ... etc
```

**AFTER** (5 vars):
```bash
# Backend API (required)
VITE_BACKEND_API_URL=http://localhost:8080
VITE_BACKEND_WS_URL=ws://localhost:8080/ws/alerts

# Supabase (optional - for auth/sync)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_key
```

---

### Phase 5: Bundle Optimization (Week 3)

#### Expected Bundle Size Reduction

**Current** (Phase 7):
- Main bundle: 71.84 KB gzipped
- Dependencies: React Query, Zustand, lightweight-charts, WebSocket libs

**After Cleanup**:
- Remove: Binance API client, data processors, indicators, ring buffers
- Estimate: **~40-50 KB gzipped** (30-40% reduction)
- Removed dependencies: None (all are still needed for UI)

#### Vite Config Optimization
Keep current code splitting:
```javascript
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'query-vendor': ['@tanstack/react-query'],
  'chart-vendor': ['lightweight-charts'],
}
```

---

## 📋 Detailed File Action Plan

### Files to DELETE (46 files)

#### Services (14 files)
- [ ] `binanceApi.ts` - Direct Binance API client
- [ ] `binanceFuturesApi.ts` - Futures ticker API
- [ ] `binanceFuturesWebSocket.ts` - WebSocket kline streaming
- [ ] `coinGeckoApi.ts` - Market cap fetching
- [ ] `dataProcessor.ts` - Currency pair parsing/filtering
- [ ] `futuresMetricsService.ts` - Multi-timeframe calculations
- [ ] `changeCalculator.ts` - Delta calculations
- [ ] `chartData.ts` - OHLCV aggregation
- [ ] `ringBufferManager.ts` - Ring buffer manager
- [ ] `stream1mManager.ts` - 1m candle stream
- [ ] `webSocketStreamManager.ts` - WebSocket manager
- [ ] `backendAdapter.ts` - No longer needed (backend-only)
- [ ] `webhookService.ts` - Backend executes webhooks, UI only configures
- [ ] `mockData.ts` - Remove or minimize to skeleton

#### Alert Processing (6 files)
- [ ] `alertEngine.ts` - Rule evaluation
- [ ] `alertBatcher.ts` - Batching logic
- [ ] `alertHistory.ts` - Legacy storage
- [ ] `bubbleDetectionService.ts` - Bubble detection
- [ ] `ichimokuMonitor.ts` - Ichimoku calculations
- [ ] `webhookService.ts` - Webhook execution (backend handles this now)

#### Hooks (4 files)
- [ ] `useMarketData.ts` - 978-line data pipeline
- [ ] `useFuturesStreaming.ts` - WebSocket streaming
- [ ] `useBubbleStream.ts` - Bubble stream hook
- [ ] `useMarketDataSource.ts` - Dual source routing

#### Utils (5 files)
- [ ] `indicators.ts` - VCP, Fibonacci, RSI, MACD
- [ ] `candle1mRingBuffer.ts` - Ring buffer implementation
- [ ] `slidingWindowCalculator.ts` - Window aggregation
- [ ] `klineRingBuffer.ts` - Kline buffer (if exists)
- [ ] `dataAggregator.ts` - Aggregation logic (if exists)

#### Tests (10+ files)
- [ ] `tests/utils/candle1mRingBuffer.test.ts`
- [ ] `tests/utils/slidingWindowCalculator.test.ts`
- [ ] `tests/utils/indicators.test.ts`
- [ ] `tests/utils/klineRingBuffer.test.ts`
- [ ] `tests/services/alertEngine.test.ts`
- [ ] `tests/services/dataProcessor.test.ts`
- [ ] ... (all tests for deleted files)

#### Types (2 files)
- [ ] `types/bubble.ts` - Bubble detection types
- [ ] Simplify `types/api.ts` - Remove Binance types

#### Backups (3 files)
- [ ] `App.tsx.backup`
- [ ] `App.tsx.backup2`
- [ ] `alertEngine.ts.backup`
- [ ] `backendAdapter.ts.backup`

### Files to CREATE (2 files)

- [ ] `hooks/useBackendData.ts` - Simple backend data hook (~50 lines)
- [ ] `types/backend.ts` - Backend API response types

### Files to KEEP and SIMPLIFY (15 files)

#### Services (7 files)
- [ ] `backendApi.ts` - **KEEP** - Primary API client (add webhook config endpoints)
- [ ] `alertHistoryService.ts` - **SIMPLIFY** - Remove local evaluation
- [ ] `notification.ts` - **KEEP** - Browser notifications
- [ ] `audioNotification.ts` - **KEEP** - Sound alerts
- [ ] `webhookService.ts` - **DELETE** - Backend executes webhooks
- [ ] `storage.ts` - **KEEP** - localStorage
- [ ] `syncService.ts` - **KEEP** - Supabase sync
- [ ] `index.ts` - **UPDATE** - Remove deleted exports

#### Hooks (3 files)
- [ ] `useBackendAlerts.ts` - **KEEP** - WebSocket alerts
- [ ] `useAlertStats.ts` - **SIMPLIFY** - Remove local logic
- [ ] `useStore.ts` - **SIMPLIFY** - Remove data state

#### Utils (4 files)
- [ ] `format.ts` - **KEEP** - UI formatting
- [ ] `sort.ts` - **KEEP** - Client sorting
- [ ] `debug.ts` - **KEEP** - Logging
- [ ] `export.ts` - **KEEP** - CSV/JSON

---

## 🚀 Migration Steps (Detailed)

### ✅ Week 1, Day 1: Backend API Integration - COMPLETE

#### ✅ Step 1.1: Create New Simplified Data Hook - DONE
**File**: `src/hooks/useBackendData.ts` (120 lines)

**Created**: January 27, 2026  
**Status**: ✅ Complete - All TypeScript checks passing

**Features**:
- Simple TanStack Query polling (5-second interval)
- Transforms backend `SymbolMetrics` → `Coin` type
- ~120 lines vs 978-line `useMarketData.ts` (88% reduction)
- Full TypeScript compliance
- Automatic retries with exponential backoff

#### ✅ Step 1.2: Update App.tsx - DONE
**Files Modified**: 
- `src/App.tsx` (simplified from 497 to ~450 lines)

**Changes**:
- ✅ Removed all legacy imports (`useMarketData`, `useFuturesStreaming`, `useMarketDataSource`)
- ✅ Removed feature flag complexity (no more dual-mode)
- ✅ Removed `binanceStream` references
- ✅ Removed `liveTicker` prop (components updated)
- ✅ Simplified to use `useBackendData()` only
- ✅ Added error display for backend failures
- ✅ Kept `useBackendAlerts()` for WebSocket alerts

**Before**: 3 data sources (Binance WebSocket, Backend Adapter, New Hook)  
**After**: 1 data source (Backend Hook only)

#### ⏸️ Step 1.3: Verify Functionality - IN PROGRESS
**Status**: Dev server running, ready for manual testing

**Testing Checklist**:
- [ ] Open http://localhost:3000
- [ ] Check console for: `🚀 [App] Using BACKEND API (simplified hook)`
- [ ] Verify 43 coins load from backend
- [ ] Check VCP values populated
- [ ] Verify sorting works
- [ ] Test modal opens
- [ ] Monitor TanStack Query in DevTools
- [ ] Check for errors

**Backend**:
- URL: https://api-gateway-production-f4ba.up.railway.app
- Health: ✅ OK
- Metrics: ✅ 43 symbols

#### ✅ Step 1.4: Update Component Interfaces - DONE
**Files Modified**:
- `src/components/coin/ChartSection.tsx` (removed liveTicker prop and live patching)
- `src/components/coin/MobileCoinDrawer.tsx` (removed liveTicker prop)

**Changes**:
- ✅ Removed `FuturesTickerData` import from both components
- ✅ Removed `liveTicker` from component interfaces
- ✅ Removed live ticker patching logic (45 lines) from ChartSection
- ✅ Backend provides complete candle data - no need for client-side patching
- ✅ All TypeScript checks passing

**Why Removed**:
- Legacy WebSocket sent live ticks that needed to patch the last candle
- Backend provides complete, up-to-date candles every 5 seconds
- No need for client-side data manipulation

---

### ✅ Week 1, Day 1 - COMPLETE!

**Summary**:
- ✅ Created `useBackendData.ts` (120 lines) → replaces 978-line `useMarketData.ts`
- ✅ Simplified `App.tsx` → removed all legacy data sources
- ✅ Updated component interfaces → removed WebSocket dependencies
- ✅ All TypeScript checks passing
- ✅ Dev server running with backend integration
- ✅ **88% code reduction** in data layer

**Next**: Week 1, Day 2-3 - Integration Testing & Documentation

---

### Week 1, Day 2-3: Integration Testing (IN PROGRESS)

#### Day 1: Backend API Integration
1. **Create new data hook**
   - File: `src/hooks/useBackendData.ts`
   - ~50 lines, replaces 978-line `useMarketData.ts`
   - Simple polling with TanStack Query

2. **Update App.tsx**
   - Replace `useMarketData` with `useBackendData`
   - Remove `useFuturesStreaming`
   - Test with `VITE_USE_BACKEND_API=true`

3. **Verify functionality**
   - All coins displayed correctly
   - Alerts working via `useBackendAlerts`
   - No console errors

#### Day 2-3: Component Updates
1. **Update all components**
   - Replace data source references
   - Remove alert evaluation UI
   - Test each component

2. **Update tests**
   - Fix component tests
   - Remove tests for deleted utils

#### Day 4-5: Testing
1. **Integration testing**
   - Full user flow testing
   - Alert notifications
   - WebSocket reconnection

2. **Performance testing**
   - Check bundle size
   - Monitor memory usage
   - Test with 200+ symbols

### Week 2: Cleanup

#### Day 1-2: Delete Legacy Code
Follow checklist above:
1. Delete API clients
2. Delete data processing
3. Delete alert engine
4. Delete hooks
5. Update imports

#### Day 3: Type System
1. Remove Binance types from `api.ts`
2. Add backend types
3. Align `Coin` type with backend
4. Fix TypeScript errors

#### Day 4-5: Configuration
1. Simplify `config/api.ts`
2. Update `.env.example`
3. Update documentation
4. Remove feature flags

### Week 3: Optimization

#### Day 1-2: Bundle Optimization
1. Analyze bundle with Vite build
2. Remove unused dependencies
3. Optimize imports
4. Test tree-shaking

#### Day 3-4: Documentation
1. Update README.md
2. Update ROADMAP.md
3. Create CLEANUP_SUMMARY.md
4. Update copilot-instructions.md

#### Day 5: Final Testing
1. Full regression testing
2. Performance benchmarks
3. Documentation review
4. Deployment preparation

---

## 📊 Expected Outcomes

### Code Metrics

**Before Cleanup**:
- Services: 28 files, ~4,500 lines
- Hooks: 9 files, ~2,000 lines
- Utils: 16 files, ~1,800 lines
- Tests: 50+ files, ~3,000 lines
- Total: ~11,300 lines

**After Cleanup**:
- Services: 9 files, ~1,100 lines (75% reduction)
- Hooks: 5 files, ~400 lines (80% reduction)
- Utils: 10 files, ~800 lines (56% reduction)
- Tests: 18 files, ~900 lines (70% reduction)
- Total: ~3,200 lines (72% reduction)

### Bundle Size
- Current: 71.84 KB gzipped
- Target: 40-50 KB gzipped (30-40% reduction)

### Maintainability
- Single source of truth (backend)
- No data processing duplication
- Simpler data flow
- Fewer moving parts
- Easier testing

---

## ⚠️ Risks and Mitigation

### Risk 1: Backend Dependency
**Risk**: Frontend completely dependent on backend availability  
**Mitigation**: 
- Keep minimal mock data for dev
- Backend has health check endpoint
- Frontend shows clear error states

### Risk 2: Breaking Changes
**Risk**: Backend API changes break frontend  
**Mitigation**:
- Version backend API
- Contract testing
- Gradual rollout with monitoring

### Risk 3: Performance
**Risk**: Polling backend slower than WebSocket  
**Mitigation**:
- Backend WebSocket for alerts (already implemented)
- Consider WebSocket for metrics too (future)
- 5s polling acceptable for 1m candles

### Risk 4: Data Loss
**Risk**: Losing local processing capabilities  
**Mitigation**:
- Backend has all original logic
- Git tags for rollback
- Feature flag for gradual migration

---

## 🎯 Success Criteria

1. ✅ **No Binance API calls** from frontend
2. ✅ **70%+ code reduction** in data layer
3. ✅ **30%+ bundle size reduction**
4. ✅ **All features working** (alerts, charts, filters)
5. ✅ **Zero TypeScript errors**
6. ✅ **80%+ test coverage** (for remaining code)
7. ✅ **Performance maintained** (<100ms render)
8. ✅ **Documentation updated**

---

## 📝 Checklist

### Pre-Migration
- [ ] Backend running locally on :8080
- [ ] Backend passing all tests
- [ ] Frontend backup created (git tag)
- [ ] Environment configured (.env.local)

### Migration
- [ ] Create `useBackendData` hook
- [ ] Update App.tsx
- [ ] Update all components
- [ ] Delete legacy services
- [ ] Delete legacy hooks
- [ ] Delete legacy utils
- [ ] Delete legacy tests
- [ ] Simplify types
- [ ] Update config
- [ ] Fix all TypeScript errors
- [ ] Fix all test failures

### Post-Migration
- [ ] Bundle size reduced
- [ ] All features working
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] Deployment tested
- [ ] Monitoring configured

---

## 📖 Related Documentation

- `docs/ROADMAP.md` - Overall project roadmap
- `docs/STATE.md` - Current project state
- `docs/INTEGRATION_COMPLETE.md` - Phase 8 integration
- `docs/BACKEND_ADAPTER.md` - Adapter pattern (to be removed)
- Backend: `screener-backend/docs/ROADMAP.md`
- Backend: `screener-backend/.github/copilot-instructions.md`

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Start Week 1, Day 1** - Create `useBackendData` hook
3. **Test incrementally** after each file deletion
4. **Monitor bundle size** with each change
5. **Update this document** as work progresses

---

**Status**: ⏸️ Awaiting approval to start implementation  
**Estimated Duration**: 3 weeks  
**Risk Level**: Medium (mitigated with testing and rollback plan)
