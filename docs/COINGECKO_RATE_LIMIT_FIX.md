# CoinGecko Rate Limit Fix (Phase 4.4.1)

**Date**: December 4, 2025  
**Issue**: Production 429 errors from CoinGecko API  
**Status**: ✅ Fixed

## Problem Analysis

### Observed Errors
```
GET https://api.coingecko.com/api/v3/coins/the-graph 
net::ERR_FAILED 429 (Too Many Requests)

Access to fetch has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present
```

### Root Cause
**Burst API Calls**: Every 5 minutes at boundary (00, 05, 10, 15...), we fetched klines for all 25 symbols:
- 25 symbols × market cap fetch = 25 CoinGecko API calls
- All calls made concurrently in batches of 5
- Rate limiter set to 30 calls/minute

**Math**:
- 25 calls in ~10-15 seconds (burst)
- CoinGecko free tier: 30 calls/minute
- Margin: 5 calls buffer (16% tolerance)
- **Too aggressive for production variability!**

## Solution Implemented

### 1. Extended Cache Duration
**Changed**: `CACHE_TTL` from 1 hour to **24 hours**

**Rationale**:
- Market cap changes slowly (typically <5% daily for established coins)
- Alerts don't need minute-by-minute market cap updates
- 24h cache means most calls are cache hits

**Impact**:
- First load: 25 API calls (one-time)
- Subsequent fetches: 0-1 calls (only new/expired coins)
- Daily refresh: ~1 call/hour for gradual cache renewal

### 2. Reduced Rate Limit
**Changed**: Rate limiter from 30 to **20 calls/minute**

**Rationale**:
- Provides 33% buffer for production variability
- Accounts for other requests (manual refreshes, new coins)
- Conservative approach prevents cascading failures

### 3. Lower Concurrency
**Changed**: Concurrency from 5 to **2** when fetching market caps

**Rationale**:
- Spreads API calls over longer time window
- Reduces burst intensity
- 25 symbols ÷ 2 concurrency = ~12-13 sequential batches
- At 2-3s per batch = 25-40s to fetch all (well under 60s window)

### 4. Better 429 Handling
**Added**: Attempt limit to 429 retry logic

**Before**:
```typescript
if (response.status === 429) {
  await sleep(waitTime)
  return this.fetchWithRetry(url, attempt) // ❌ Could retry forever
}
```

**After**:
```typescript
if (response.status === 429) {
  if (attempt >= this.retries) {
    throw new Error('CoinGecko rate limit exceeded')
  }
  await sleep(waitTime)
  return this.fetchWithRetry(url, attempt + 1) // ✅ Respects max retries
}
```

### 5. Improved Fallback Strategy
**Enhanced**: Use stale cache on failures

```typescript
catch (error) {
  // Return stale cached data if available (better than nothing for alerts)
  if (cached) {
    console.log(`📦 Using stale cache for ${symbol} (${hours}h old)`)
    return cached.marketCap
  }
  return null
}
```

## Expected Behavior After Fix

### First App Load (Cold Cache)
```
🔄 Fetching fresh klines data for 16:00 boundary...
📊 Fetching metrics for 25 symbols...
✅ Fetched market cap for BTCUSDT: $842,000,000,000
✅ Fetched market cap for ETHUSDT: $298,000,000,000
... (25 calls total over ~40-60 seconds)
✅ Fetched 25/25 metrics in 52000ms
```

### Subsequent Fetches (Warm Cache)
```
🔄 Fetching fresh klines data for 16:05 boundary...
📊 Fetching metrics for 25 symbols...
📦 Using cached market cap for BTCUSDT (bitcoin)
📦 Using cached market cap for ETHUSDT (ethereum)
... (0 CoinGecko calls - all cache hits)
✅ Fetched 25/25 metrics in 8200ms
```

### Cache Expiration (After 24 Hours)
```
🔄 Fetching fresh klines data for 16:00 boundary...
📊 Fetching metrics for 25 symbols...
📦 Using cached market cap for BTCUSDT (bitcoin)  // Still fresh
📦 Using cached market cap for ETHUSDT (ethereum) // Still fresh
✅ Fetched market cap for NEWCOINUSDT: $15,000,000 // New coin added
... (0-2 calls - mostly cache hits)
```

## API Call Comparison

### Before Fix
| Time Window | Binance Calls | CoinGecko Calls | Total |
|-------------|---------------|-----------------|-------|
| Per 5 min   | 125 (klines)  | 25 (market cap) | 150   |
| Per hour    | 1,500         | 300             | 1,800 |
| Per day     | 36,000        | 7,200           | 43,200|

**Risk**: 300 CoinGecko calls/hour exceeds 30/min limit during bursts ❌

### After Fix  
| Time Window | Binance Calls | CoinGecko Calls | Total |
|-------------|---------------|-----------------|-------|
| Per 5 min   | 125 (klines)  | 0-1 (cached)    | ~125  |
| Per hour    | 1,500         | 0-5             | ~1,505|
| Per day     | 36,000        | 25-100          | ~36,100|

**Safety**: ~25 calls/day = 0.017 calls/min (well under limit) ✅

## Testing Results

### Unit Tests
```bash
npm test -- --run
✅ Test Files: 10 passed (10)
✅ Tests: 127 passed (127)
```

### Type Checking
```bash
npm run type-check
✅ TypeScript compilation successful
```

### Production Monitoring
**After deployment, monitor for**:
- ✅ No more 429 errors in console
- ✅ Cache hit rate >95% after initial load
- ✅ Klines fetch completes in <60s (vs 2-3s blocking before)
- ✅ Alerts still trigger correctly (market cap available)

## Files Modified

1. **src/services/coinGeckoApi.ts**
   - Increased `CACHE_TTL` to 24 hours
   - Reduced rate limit to 20 calls/minute
   - Added attempt limit to 429 retry logic
   - Improved error logging

2. **src/services/futuresMetricsService.ts**
   - Reduced concurrency from 5 to 2 when `skipMarketCap: false`
   - Maintains concurrency of 5 when `skipMarketCap: true`

3. **tests/services/coinGeckoApi.test.ts**
   - Updated test expectations: `maxCalls` = 20 (was 30)

4. **docs/FUTURES_API_ROADMAP.md**
   - Documented CoinGecko optimization strategy
   - Added to Phase 4.4 benefits section

## Rollout Plan

1. ✅ **Phase 1**: Code changes committed (commit 2746a92)
2. ✅ **Phase 2**: Documentation updated (commit 8c18d88)  
3. ✅ **Phase 3**: Pushed to remote (main branch)
4. ⏳ **Phase 4**: Deploy to production (Vercel auto-deploy)
5. ⏳ **Phase 5**: Monitor for 24 hours (verify no 429s)

## Success Criteria

- ✅ All tests passing (127/127)
- ✅ Type check clean
- ⏳ No 429 errors in production console
- ⏳ Cache hit rate >90% after warm-up
- ⏳ Alert system continues working (Scout Bull, etc.)
- ⏳ Klines fetch time <60s for all symbols

## Notes

**Why 24 hours vs shorter**:
- Market cap is not time-sensitive for alert evaluation
- Scout Bull alert cares about $300M+ threshold - doesn't need hourly updates
- Longer cache = more stability, fewer API dependencies

**Why 20 calls/min vs 30**:
- Production variability: Other features may use CoinGecko
- User actions: Manual refresh, watchlist changes
- Network delays: Retry logic can cause call bursts
- Conservative = reliable

**Why concurrency 2 vs 1**:
- 1 = Too slow (25 symbols × 2-3s = 50-75s)
- 2 = Balanced (25 symbols ÷ 2 = 12-13 batches = 25-40s)
- 5 = Too fast (causes burst, triggers rate limit)

## Related Issues

- **Phase 4.4**: Original API optimization (boundary-aligned klines)
- **Alert Debugging**: Scout Bull requires market cap field
- **Non-blocking Fetch**: UI doesn't wait for klines (instant display)

---

**Status**: Ready for production ✅
**Next Steps**: Monitor deployment, adjust if needed
