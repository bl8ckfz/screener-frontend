# Phase 8 Integration - Complete Implementation Guide

## ✅ Completed Steps

### Step 1: Backend API Client ✅
- Created `src/services/backendApi.ts` (269 lines)
- REST methods: health, metrics, settings, alert history
- WebSocket client with auto-reconnection
- Feature flag support

### Step 2: Environment Configuration ✅
- Updated `.env.example` with backend variables
- Added feature flags for gradual rollout

### Step 3: Backend Adapter ✅
- Created `src/services/backendAdapter.ts` (370 lines)
- Transparent routing between backend/Binance APIs
- Data transformation: SymbolMetrics → Coin type
- Automatic fallback on errors

### Step 4: WebSocket Alert Hook ✅
- Created `src/hooks/useBackendAlerts.ts` (233 lines)
- Real-time alert streaming from backend
- Auto-reconnection with exponential backoff
- Integration with notification system

### Step 5: Status Component ✅
- Created `src/components/ui/BackendStatus.tsx`
- Shows active data source (Backend/Binance)
- WebSocket connection status
- Health check monitoring

## 🎯 Integration Instructions

### Option A: Full Backend Integration (Recommended for Testing)

This integrates both REST API (data fetching) and WebSocket (alerts).

**1. Configure Environment**

```bash
cd ~/fun/crypto/screener-frontend
cp .env.example .env.local
```

Edit `.env.local`:
```bash
# Enable backend mode
VITE_USE_BACKEND_API=true
VITE_BACKEND_API_URL=http://localhost:8080
VITE_BACKEND_WS_URL=ws://localhost:8080/ws/alerts

# Keep existing Supabase config
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_key
```

**2. Add Backend Alerts Hook to App.tsx**

Add import:
```typescript
import { useBackendAlerts } from '@/hooks'
```

Add hook call (inside App component, after existing hooks):
```typescript
// Backend WebSocket alerts (only active when VITE_USE_BACKEND_API=true)
const {
  isConnected: backendWsConnected,
  alerts: backendAlerts,
  error: backendWsError
} = useBackendAlerts({
  enabled: true, // Will check feature flag internally
  autoConnect: true,
  onAlert: (alert) => {
    debug.log('🚨 Backend alert:', alert.symbol, alert.ruleType)
  }
})
```

**3. Add Status Badge to UI**

In App.tsx, add import:
```typescript
import { BackendStatus } from '@/components/ui/BackendStatus'
```

Add component (e.g., in the header/toolbar):
```tsx
<BackendStatus wsConnected={backendWsConnected} />
```

**4. Update Data Fetching (Optional - Phase 8.2)**

*Note: This step is optional for now. The existing `useMarketData` and `useFuturesStreaming` 
hooks will continue to work. This shows how to migrate to backend data source.*

```typescript
// Current: Uses Binance API
const { data: coins } = useMarketData(...)

// Future: Use backend adapter
import { fetchAllCoins } from '@/services/backendAdapter'

const { data: coins } = useQuery({
  queryKey: ['coins'],
  queryFn: fetchAllCoins,
  refetchInterval: 5000,
})
```

### Option B: Alerts-Only Integration (Non-Breaking)

If you only want to test WebSocket alerts without changing data fetching:

**1. Configure Environment (Alerts Only)**
```bash
VITE_USE_BACKEND_API=false  # Keep existing data source
VITE_BACKEND_WS_URL=ws://localhost:8080/ws/alerts
```

**2. Add Hook to App.tsx**
```typescript
import { useBackendAlerts } from '@/hooks'

// Inside App component
const { isConnected, alerts } = useBackendAlerts({
  enabled: true,
  autoConnect: true
})
```

This gives you real-time alerts from backend without changing data fetching.

## 🧪 Testing Steps

### 1. Start Backend Services

```bash
cd ~/fun/crypto/screener-backend

# Terminal 1: Data Collector
make run-data-collector

# Terminal 2: Metrics Calculator
make run-metrics-calculator

# Terminal 3: Alert Engine
make run-alert-engine

# Terminal 4: API Gateway
make run-api-gateway
```

### 2. Verify Backend Health

```bash
curl http://localhost:8080/api/health
# Should return: {"status":"ok","database":"ok","nats":"ok"}

curl http://localhost:8080/api/metrics/BTCUSDT | jq
# Should return metrics data
```

### 3. Start Frontend

```bash
cd ~/fun/crypto/screener-frontend
npm run dev
```

### 4. Verification Checklist

**With VITE_USE_BACKEND_API=false (Baseline)**:
- [ ] App loads normally
- [ ] Coin data displays
- [ ] Existing alerts work
- [ ] No console errors
- [ ] Status badge shows "Binance API"

**With VITE_USE_BACKEND_API=true (Backend Mode)**:
- [ ] App loads normally
- [ ] Coin data displays (from backend)
- [ ] Status badge shows "Backend API" (green dot)
- [ ] WebSocket shows "Connected" (green dot)
- [ ] Console shows `[BackendAdapter] Using backend API`
- [ ] Alerts appear in real-time
- [ ] No console errors
- [ ] Data matches Binance mode (spot check prices)

### 5. Performance Testing

**Measure Data Load Time**:
```javascript
// In browser console
console.time('dataLoad')
// Trigger data refresh
console.timeEnd('dataLoad')

// Binance API: ~8.6s for 43 symbols
// Backend API: <1s for 43 symbols
```

**Check Network Tab**:
- Binance mode: 43+ requests to binance API
- Backend mode: 1 request to localhost:8080

## 🔄 Rollback Strategy

If any issues occur:

**Instant Rollback**:
```bash
# Edit .env.local
VITE_USE_BACKEND_API=false
```

Refresh browser - app reverts to Binance API immediately, no code changes needed.

**Persistent Rollback**:
```bash
# Remove or comment out backend integration code
git stash  # If uncommitted
# or
git revert <commit>
```

## 🐛 Troubleshooting

### Backend API Not Responding

**Symptoms**: Status badge red, console shows connection errors

**Solutions**:
```bash
# Check backend services
ps aux | grep "data-collector\|metrics-calculator\|alert-engine\|api-gateway"

# Check logs
tail -f logs/api-gateway.log

# Restart services
make run-api-gateway
```

### WebSocket Won't Connect

**Symptoms**: WS status shows "Disconnected", no alerts

**Solutions**:
```bash
# Check WebSocket endpoint
wscat -c ws://localhost:8080/ws/alerts

# Check firewall
sudo ufw status
sudo ufw allow 8080

# Check browser console for CORS errors
# API Gateway has CORS enabled by default
```

### Data Mismatch Between Modes

**Symptoms**: Prices different between backend and Binance modes

**Possible Causes**:
- Backend data collector not running
- TimescaleDB data stale
- Transformation logic bug

**Debugging**:
```bash
# Check backend data freshness
psql crypto_user@localhost:5432/crypto -c "SELECT symbol, time FROM candles_1m ORDER BY time DESC LIMIT 5;"

# Compare raw responses
curl http://localhost:8080/api/metrics/BTCUSDT | jq .timeframes.\"1m\"
# vs Binance API price
```

### Build Errors

**Symptoms**: TypeScript compilation errors

**Solutions**:
```bash
# Clear cache and rebuild
rm -rf node_modules/.vite
npm run dev

# Check for missing dependencies
npm install @tanstack/react-query @supabase/supabase-js

# Verify types
npx tsc --noEmit
```

## 📊 Monitoring

### Console Logs to Watch

**Backend Adapter**:
```
[BackendAdapter] Using backend API for data fetching
[BackendAdapter] Fetched 43 coins from backend
```

**WebSocket Hook**:
```
🔌 Connecting to backend WebSocket...
✅ Backend WebSocket connected
🔔 Backend alert received: BTCUSDT
```

**Health Checks**:
```
✅ Backend API health: ok
🔌 Backend WebSocket: connected
```

### Performance Metrics

Expected improvements with backend:
- **Initial load**: 8.6s → <1s (8.6x faster)
- **Network requests**: 43 → 1 (97.7% reduction)
- **Client CPU**: ~200ms calculations → 0ms (server-side)
- **Alert latency**: 5s polling → <100ms WebSocket

## 🎯 Next Steps (Phase 8.2)

1. **Migrate `useMarketData` to use `backendAdapter`**
   - Replace Binance API calls with `fetchAllCoins()`
   - Update data processing pipeline
   - Test with both modes

2. **User Settings Integration**
   - Wire up settings modal to backend
   - Implement JWT auth middleware
   - Test save/load settings flow

3. **Alert Rules Management**
   - Create/update/delete rules via backend
   - Sync with PostgreSQL metadata DB
   - Real-time rule updates

4. **Production Deployment**
   - Deploy backend to Azure Container Apps
   - Update frontend environment variables
   - Configure CDN/SSL
   - Monitor performance

## 📝 Summary

**What We Built**:
- ✅ Complete backend API client (REST + WebSocket)
- ✅ Transparent adapter with feature flag
- ✅ WebSocket alert streaming hook
- ✅ Status monitoring component
- ✅ Environment configuration
- ✅ Rollback strategy

**Integration Status**:
- ✅ Backend services ready
- ✅ Frontend code ready
- ⏳ Integration in App.tsx (3 lines to add)
- ⏳ Testing both modes

**Time to Production**:
- Local testing: 5 minutes (add 3 lines to App.tsx)
- Full integration: 1 hour (migrate useMarketData)
- Cloud deployment: 2-3 hours (Azure setup)

**Risk Level**: ✅ Very Low
- Feature flag for instant rollback
- No breaking changes
- Fallback to Binance API on errors
- Gradual rollout capability
