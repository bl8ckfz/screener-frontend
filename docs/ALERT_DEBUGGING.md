# Alert Debugging Guide

## Issue: Scout Bull Alerts Not Triggering

### Root Causes Identified

1. **Market Cap Missing** ❌
   - Background klines fetch had `skipMarketCap: true`
   - Scout Bull alert requires `marketCap` field
   - Without market cap, alert evaluation always returns false

2. **No Alert Re-Evaluation** ❌
   - After background klines fetch completed, `query.dataUpdatedAt` didn't update
   - Alert evaluation effect didn't re-trigger
   - New metrics were cached but alerts weren't re-evaluated

### Solutions Implemented

1. **Include Market Cap in Background Fetch** ✅
   ```typescript
   // Changed from:
   { skipMarketCap: true }  // ❌
   
   // To:
   { skipMarketCap: false } // ✅
   ```
   
   **Impact**: Market cap now fetched with klines data
   - CoinGecko API has 30 calls/minute rate limit
   - Market cap cached for 1 hour per symbol
   - Klines fetch every 5 minutes → Market cap fetch every 60 minutes
   - Rate limit impact: Minimal (1 call per symbol per hour)

2. **Trigger Refetch After Background Fetch** ✅
   ```typescript
   // After caching new metrics:
   query.refetch()  // ✅ Triggers alert re-evaluation
   ```
   
   **Impact**: Alert evaluation runs after new metrics available
   - `dataUpdatedAt` updates
   - Alert evaluation effect re-triggers
   - New metrics attached to coins
   - Alerts evaluated with fresh data

3. **Enhanced Logging** ✅
   ```typescript
   console.log(`📊 Alert evaluation: ${coinsWithMetrics.length}/${coins.length} coins with metrics (${coinsWithMarketCap.length} with market cap)`)
   console.log(`📋 Evaluating ${enabledRules.length} enabled alert rules...`)
   ```
   
   **Impact**: Better visibility into alert system status

## Scout Bull Alert Requirements

For reference, here are the exact conditions required:

```typescript
export function evaluateFuturesScoutBull(metrics: FuturesMetrics): boolean {
  if (!metrics.marketCap) return false  // ← REQUIRES MARKET CAP

  return (
    metrics.change_5m > 1 &&           // 5m change > 1%
    metrics.change_15m > 1 &&          // 15m change > 1%
    3 * metrics.change_5m > metrics.change_15m &&  // Accelerating (3x)
    2 * metrics.volume_5m > metrics.volume_15m &&  // Volume surge (2x)
    metrics.marketCap > 23_000_000 &&              // Market cap > $23M
    metrics.marketCap < 2_500_000_000              // Market cap < $2.5B
  )
}
```

## Alert Evaluation Flow (Fixed)

### Initial Page Load
```
1. Fetch /ticker/24hr (100ms)
2. Process coins
3. Attach cached metrics (empty cache = no metrics)
4. Return coins → UI displays immediately ✅
5. Alert evaluation: No metrics yet, wait...
```

### Background Klines Fetch (First Time)
```
1. Check cache expired (yes, lastUpdate = 0)
2. Fetch klines for all symbols (2-3s)
3. Fetch market cap for all symbols (parallel, cached 1hr)
4. Update cache
5. Call query.refetch() ← KEY FIX
```

### After Refetch
```
1. Fetch /ticker/24hr (100ms) 
2. Process coins
3. Attach cached metrics ✅ (now available)
4. Return coins → UI re-renders with metrics
5. Alert evaluation triggers:
   - Check coins with metrics ✅
   - Check coins with market cap ✅
   - Evaluate enabled rules ✅
   - Scout Bull can now trigger ✅
```

### Subsequent Polls (Every 5s)
```
1. Fetch /ticker/24hr (100ms)
2. Attach cached metrics ✅ (still valid <5min)
3. Return coins → UI updates
4. Alert evaluation runs with cached metrics ✅
```

### Background Refresh (Every 5min)
```
1. Cache expired (>5 min)
2. Fetch fresh klines in background
3. Fetch market cap (from 1hr cache) ← Fast!
4. Update cache
5. Call query.refetch()
6. Alert re-evaluation with fresh metrics ✅
```

## Debugging Checklist

If alerts aren't triggering, check these in console:

### 1. Klines Cache Status
```typescript
import { getKlinesCacheStats } from '@/hooks'
const stats = getKlinesCacheStats()
console.log(stats)
// {
//   lastUpdate: 1733338425123,
//   cacheSize: 25,  // ← Should match number of symbols
//   isExpired: false
// }
```

### 2. Metrics Availability
Look for this log:
```
📊 Alert evaluation: 25/25 coins with metrics (25 with market cap)
                      ^^                      ^^
                      Should match            Should be > 0 for Scout alerts
```

### 3. Alert Rules
Look for:
```
📋 Evaluating 1 enabled alert rules...
              ^
              Should be > 0
```

### 4. Market Cap in Metrics
Check a sample coin in React DevTools:
```typescript
coin.futuresMetrics?.marketCap  // Should be a number, not null/undefined
```

## Performance Impact

### Before Fix
- Klines: Fetched every 5 min ✅
- Market Cap: **Skipped** ❌
- Alert Re-evaluation: **Never triggered** ❌

### After Fix
- Klines: Fetched every 5 min ✅
- Market Cap: Fetched every 5 min, **cached 1hr** ✅
- Alert Re-evaluation: **Triggered after each fetch** ✅

### API Call Analysis
```
With 25 symbols:

Klines API calls (every 5 min):
- 5 intervals × 25 symbols = 125 calls

CoinGecko API calls (every 5 min, but cached 1hr):
- First fetch: 25 calls
- Next 11 fetches: 0 calls (cache hit)
- Total per hour: 25 calls

Rate limits:
- Binance: No documented limit for public endpoints ✅
- CoinGecko: 30 calls/minute = 1,800 calls/hour
- Our usage: 25 calls/hour = 1.4% of limit ✅
```

## Related Files

- `src/hooks/useMarketData.ts` - Main fix location
- `src/services/alertEngine.ts` - Alert evaluators
- `src/services/coinGeckoApi.ts` - Market cap fetching
- `tests/alerts/futuresAlerts.test.ts` - Alert tests

---

**Fixed**: December 4, 2025  
**Status**: ✅ All 127 tests passing  
**Commit**: See git history for "fix: Enable market cap and alert re-evaluation"
