# Frontend Cleanup - Executive Summary

**Date**: January 27, 2026  
**Status**: Planning Complete - Ready for Implementation

---

## 🎯 Objective

Transform the frontend from a **dual-mode system** (Binance API + Backend API) into a **pure presentation layer** that only consumes processed data from the Go backend.

---

## 📊 Impact Summary

### Code Reduction
| Category | Before | After | Reduction |
|----------|--------|-------|-----------|
| **Services** | 28 files, ~4,500 lines | 9 files, ~1,100 lines | **75%** |
| **Hooks** | 9 files, ~2,000 lines | 5 files, ~400 lines | **80%** |
| **Utils** | 16 files, ~1,800 lines | 10 files, ~800 lines | **56%** |
| **Tests** | 50+ files, ~3,000 lines | 18 files, ~900 lines | **70%** |
| **Total** | ~11,300 lines | ~3,200 lines | **72%** |

### Bundle Size
- **Current**: 71.84 KB gzipped
- **Target**: 40-50 KB gzipped  
- **Reduction**: 30-40%

---

## 🗑️ What Gets Deleted (46+ files)

### 1. Direct API Clients (5 files)
All Binance and CoinGecko API calls handled by backend:
- `binanceApi.ts` - USDT pairs, 24hr tickers
- `binanceFuturesApi.ts` - Futures data
- `binanceFuturesWebSocket.ts` - WebSocket streaming
- `coinGeckoApi.ts` - Market cap
- `mockData.ts` - Most mock data

### 2. Data Processing (8 files)
Backend processes all candles, metrics, and indicators:
- `dataProcessor.ts` - Currency parsing, filtering
- `futuresMetricsService.ts` - Multi-timeframe metrics
- `changeCalculator.ts` - Price/volume deltas
- `chartData.ts` - OHLCV aggregation
- `candle1mRingBuffer.ts` - Ring buffer (245 lines)
- `slidingWindowCalculator.ts` - Window math (263 lines)
- `ringBufferManager.ts` - Buffer manager
- `stream1mManager.ts` - 1m candle streaming

### 3. Alert Engine (6 files)
Backend evaluates all alert rules AND executes webhooks:
- `alertEngine.ts` - Rule evaluation
- `alertBatcher.ts` - Batching logic
- `alertHistory.ts` - Legacy storage
- `bubbleDetectionService.ts` - Bubble detection
- `ichimokuMonitor.ts` - Ichimoku clouds
- `webhookService.ts` - Webhook execution (backend handles)

### 4. Complex Hooks (4 files)
Replaced with simple backend data hook:
- `useMarketData.ts` - **978 lines** → 50-line replacement
- `useFuturesStreaming.ts` - WebSocket management
- `useBubbleStream.ts` - Bubble streaming
- `useMarketDataSource.ts` - Dual-source routing

### 5. Technical Indicators (1 file)
Backend calculates VCP, Fibonacci, RSI, MACD:
- `utils/indicators.ts` - All indicator math

### 6. Helper Files
- `backendAdapter.ts` - No longer needed (backend-only)
- All backup files (`.backup`, `.backup2`)
- 10+ test files for deleted utilities

---

## ✅ What Gets Kept (Simplified)

### Primary Data Source
- `backendApi.ts` - REST API + WebSocket client
  - **Enhanced**: Add webhook configuration endpoints (CRUD)
  - Backend executes webhooks when alerts trigger
- **NEW**: `useBackendData.ts` - Simple polling hook (~50 lines)

### User Features
- `notification.ts` - Browser notifications
- `audioNotification.ts` - Sound alerts
- `useBackendAlerts.ts` - Real-time alert WebSocket
- Settings UI - Webhook configuration (add/edit/delete URLs)

**Note**: Frontend only provides webhook **configuration UI**. Backend executes webhook calls.

### UI Utilities
- `format.ts` - Number/date/price formatting
- `sort.ts` - Client-side sorting
- `debug.ts` - Debug logging
- `export.ts` - CSV/JSON export

### State Management
- `useStore.ts` - Zustand store (simplified)
- `storage.ts` - localStorage
- `syncService.ts` - Supabase sync

### All Components
Zero changes to presentation components (coin, market, controls, layout, etc.)

---

## 🔄 Data Flow Transformation

### Before (Dual Mode)
```
Binance API → WebSocket → Ring Buffers → Sliding Windows → 
  Indicators → Alert Engine → UI

OR

Backend API → Adapter → Transform → UI
```

### After (Backend Only)
```
Backend API → Simple Transform → UI
               ↓
         WebSocket Alerts
```

**Complexity Reduction**: ~70% fewer code paths

---

## 🚀 Migration Timeline

### Week 1: Backend Integration
- **Day 1**: Create `useBackendData` hook
- **Day 2-3**: Update App.tsx and components
- **Day 4-5**: Integration testing

### Week 2: Cleanup
- **Day 1-2**: Delete legacy services/hooks/utils
- **Day 3**: Simplify type system
- **Day 4-5**: Update configuration

### Week 3: Optimization
- **Day 1-2**: Bundle optimization
- **Day 3-4**: Documentation
- **Day 5**: Final testing

---

## 📋 Key Files to Review

### Planning Documents
- **`FRONTEND_CLEANUP_PLAN.md`** - Complete 400-line implementation plan
- `docs/ROADMAP.md` - Current project roadmap
- `docs/STATE.md` - Current state tracking

### Current Integration
- `docs/INTEGRATION_COMPLETE.md` - Phase 8 backend integration
- `docs/BACKEND_ADAPTER.md` - Adapter pattern (to be removed)

### Backend Documentation
- `../screener-backend/docs/ROADMAP.md` - Backend implementation
- `../screener-backend/.github/copilot-instructions.md` - Backend patterns

---

## ⚠️ Critical Changes

### Environment Variables
**BEFORE** (15+ variables):
```bash
VITE_BINANCE_API_URL=...
VITE_BINANCE_FUTURES_API_URL=...
VITE_CORS_PROXY=...
VITE_COINGECKO_API_URL=...
VITE_USE_BACKEND_API=...  # Feature flag
# ... etc
```

**AFTER** (5 variables):
```bash
# Backend API (required)
VITE_BACKEND_API_URL=http://localhost:8080
VITE_BACKEND_WS_URL=ws://localhost:8080/ws/alerts

# Supabase (optional)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Main Hook Replacement
**BEFORE** (`useMarketData.ts` - 978 lines):
```typescript
const { data: coins } = useMarketData(
  binanceStream.metricsMap,
  binanceStream.getTickerData,
  binanceStream.tickersReady,
  binanceStream.lastUpdate
)
```

**AFTER** (`useBackendData.ts` - 50 lines):
```typescript
const { data: coins, isLoading } = useBackendData()
```

---

## ✨ Benefits

### For Developers
1. **70% less code** to maintain
2. **Single source of truth** (backend)
3. **Simpler data flow**
4. **Faster onboarding**
5. **Easier testing**

### For Users
1. **Faster load times** (smaller bundle)
2. **More reliable** (backend handles complexity)
3. **Consistent data** (no client-side drift)
4. **Better performance** (backend optimized)

### For Infrastructure
1. **Backend scales** (not limited by browser)
2. **Centralized caching** (TimescaleDB)
3. **Better monitoring** (backend metrics)
4. **Rate limit safety** (backend manages API calls)

---

## 🎯 Success Criteria

- [ ] Zero Binance API calls from frontend
- [ ] 70%+ code reduction achieved
- [ ] 30%+ bundle size reduction
- [ ] All features working (alerts, charts, filters)
- [ ] Zero TypeScript errors
- [ ] 80%+ test coverage
- [ ] Performance maintained (<100ms render)
- [ ] Documentation updated

---

## 📞 Next Actions

1. **Review** this plan with stakeholders
2. **Approve** cleanup approach
3. **Start** Week 1, Day 1 implementation
4. **Track** progress in `FRONTEND_CLEANUP_PLAN.md`
5. **Test** incrementally after each deletion

---

## 🔗 Related Links

- **Full Plan**: [FRONTEND_CLEANUP_PLAN.md](./FRONTEND_CLEANUP_PLAN.md)
- **Backend Repo**: `../screener-backend/`
- **Integration Docs**: [INTEGRATION_COMPLETE.md](./INTEGRATION_COMPLETE.md)

---

**Ready to Start**: Yes ✅  
**Risk Level**: Medium (mitigated with testing and rollback)  
**Estimated Duration**: 3 weeks  
**Team Impact**: Reduced complexity, better maintainability
