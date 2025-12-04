# API Optimization Strategy - Klines Caching

## Problem Statement

**Current Implementation** (Phase 4.3 - Suboptimal):
- Every 5 seconds: Fetch `/fapi/v1/ticker/24hr` + `/fapi/v1/klines` (5 intervals × 25+ coins)
- Total API calls: **~1,800 calls/minute** ❌
- Performance impact: 2-3 second delays per poll
- Risk: Binance rate limiting

## Key Insight

> **The smallest alert timeframe is 5 minutes (`change_5m`), so klines data doesn't need to be fetched more frequently than every 5 minutes.**

## Optimal Solution (Phase 4.4)

### Two-Tier Polling Strategy

```typescript
// FAST POLL (every 5 seconds)
- Endpoint: /fapi/v1/ticker/24hr
- Purpose: Real-time price/volume for screening display
- API calls: ~25 calls/poll

// SLOW POLL (every 5 minutes)
- Endpoint: /fapi/v1/klines (5m, 15m, 1h, 8h, 1d)
- Purpose: Historical data for alert evaluation
- API calls: ~125 calls/poll (but only once per 5 minutes!)
```

### API Call Reduction

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Calls per poll | 150 | 25 (avg) | 83% |
| Calls per minute | 1,800 | 302 | 83% |
| Poll duration | 2-3s | 150ms (avg) | 95% |

### Why This Works

1. **Alert Requirements**:
   - Smallest timeframe: 5 minutes
   - Klines granularity: 5 minutes
   - Alert accuracy: No loss (matches requirement)

2. **Display Requirements**:
   - Uses 24hr ticker data only
   - Updates every 5 seconds
   - No dependency on klines

3. **User Experience**:
   - Screen updates faster (no klines delay)
   - Alerts still accurate (5min freshness is sufficient)
   - No visible difference to users

## Implementation Plan

### Step 1: Add Caching State (useMarketData.ts)

```typescript
// Track last klines update timestamp
const lastKlinesUpdateRef = useRef<number>(0)
const cachedMetricsRef = useRef<Map<string, FuturesMetrics>>(new Map())

// Constants
const KLINES_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in ms
```

### Step 2: Conditional Klines Fetching

```typescript
// Inside useMarketData queryFn
const now = Date.now()
const timeSinceLastUpdate = now - lastKlinesUpdateRef.current
const shouldFetchKlines = timeSinceLastUpdate > KLINES_CACHE_DURATION

if (shouldFetchKlines) {
  console.log('🔄 Fetching fresh klines data...')
  
  const metricsArray = await futuresMetricsService.fetchMultipleSymbolMetrics(
    symbols,
    (progress) => {
      if (progress.completed % 10 === 0) {
        console.log(`📊 Fetched metrics: ${progress.completed}/${progress.total}`)
      }
    },
    { skipMarketCap: true }
  )
  
  lastKlinesUpdateRef.current = now
  
  // Update cache
  metricsArray.forEach(m => cachedMetricsRef.current.set(m.symbol, m))
  
  console.log(`✅ Cached ${metricsArray.length} futures metrics`)
} else {
  const minutesAgo = Math.round(timeSinceLastUpdate / 60000)
  console.log(`⏱️ Using cached klines (updated ${minutesAgo}m ago)`)
}

// Attach metrics from cache (works in both cases)
coins = coins.map(coin => ({
  ...coin,
  futuresMetrics: cachedMetricsRef.current.get(coin.fullSymbol)
}))
```

### Step 3: Cache Invalidation

```typescript
// Optional: Invalidate cache on user actions
const invalidateKlinesCache = () => {
  lastKlinesUpdateRef.current = 0
  cachedMetricsRef.current.clear()
  console.log('🗑️ Klines cache invalidated')
}

// Use cases:
// - User manually refreshes
// - Watchlist changes
// - Currency pair changes (if we add more pairs)
```

### Step 4: Monitoring & Debugging

```typescript
// Add cache stats to query metadata
const klinesStats = {
  lastUpdate: lastKlinesUpdateRef.current,
  cacheSize: cachedMetricsRef.current.size,
  nextUpdate: lastKlinesUpdateRef.current + KLINES_CACHE_DURATION,
  timeUntilNextUpdate: Math.max(0, lastKlinesUpdateRef.current + KLINES_CACHE_DURATION - Date.now())
}

// Log every 10 polls
if (pollCount % 10 === 0) {
  console.log('📊 Klines cache stats:', klinesStats)
}
```

## Testing Checklist

- [ ] Verify klines fetched on first poll
- [ ] Verify klines NOT fetched on subsequent polls (< 5 minutes)
- [ ] Verify klines re-fetched after 5-minute expiry
- [ ] Verify alerts still trigger correctly with cached data
- [ ] Verify cache survives multiple polls (no memory leaks)
- [ ] Verify cache invalidation works
- [ ] Profile API call count: Confirm ~300 calls/minute
- [ ] Profile poll duration: Confirm <200ms average

## Rollout Strategy

### Phase 1: Development
1. Implement caching in dev environment
2. Test with mock data
3. Verify cache behavior with console logs
4. Measure API call reduction

### Phase 2: Staging
1. Deploy to staging with real API
2. Monitor for 24 hours
3. Verify no Binance rate limit warnings
4. Confirm alerts still accurate

### Phase 3: Production
1. Deploy during low-traffic period
2. Monitor API call counts
3. Monitor alert accuracy
4. Roll back if issues detected

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| API calls/min | <350 | Console logs, API monitoring |
| Poll duration | <200ms avg | Performance profiling |
| Cache hit rate | >80% | Log cache hits vs misses |
| Alert accuracy | 100% | Compare with manual verification |
| User complaints | 0 | Support tickets, feedback |

## Risks & Mitigation

### Risk 1: Stale Alert Data
- **Risk**: 5-minute cache means alerts can be up to 5 minutes delayed
- **Mitigation**: This is by design - smallest alert timeframe IS 5 minutes
- **Impact**: None - matches user expectations

### Risk 2: Cache Memory Growth
- **Risk**: Map grows unbounded if symbols change
- **Mitigation**: Clear cache on watchlist/pair changes
- **Impact**: Low - max 100-200 entries in production

### Risk 3: Race Conditions
- **Risk**: Multiple components trigger klines fetch simultaneously
- **Mitigation**: Use module-level refs (shared across hook instances)
- **Impact**: Low - single query instance in app

## Related Documents

- `docs/FUTURES_API_ROADMAP.md` - Phase 4.4 tasks
- `src/hooks/useMarketData.ts` - Implementation file
- `src/services/futuresMetricsService.ts` - Klines fetching logic

---

**Last Updated**: December 4, 2025  
**Status**: Ready for implementation  
**Priority**: Critical (must complete before production deployment)
