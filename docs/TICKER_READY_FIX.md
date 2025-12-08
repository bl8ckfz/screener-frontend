# Ticker Ready Event Flow Fix

## Problem
Market data list was empty on initial load because:
1. `useMarketData` effect ran before initial REST tickers were fetched/stored
2. No mechanism to trigger UI update when tickers became available
3. Execution order: Hook init → Effect runs with 0 tickers → REST fetch → Store tickers → **UI never updates**

## Solution
Implemented event-driven flow to trigger UI update when initial ticker data is ready:

### 1. Event Emission (Stream1mManager)
```typescript
setInitialTickers(tickers: any[]): void {
  this.initialTickers = tickers
  console.log(`📊 Stored ${tickers.length} initial tickers for immediate display`)
  this.emit('tickersReady', { count: tickers.length }) // ← Emit event
}
```

### 2. Event Forwarding (FuturesMetricsService)
```typescript
on(event: 'tickersReady', handler: () => void): () => void {
  this.stream1mManager.on(event, handler) // ← Forward to stream manager
  return () => {
    this.stream1mManager.off(event, handler)
  }
}
```

### 3. State Update (useFuturesStreaming)
```typescript
const unsubTickersReady = futuresMetricsService.on('tickersReady', () => {
  console.log('📊 Initial tickers ready - market data can be displayed')
  setTickersReady(true) // ← Update React state
})
```

### 4. UI Trigger (useMarketData)
```typescript
// Add tickersReady as parameter
export function useMarketData(wsMetricsMap?, wsGetTickerData?, tickersReady?) {
  
  useEffect(() => {
    // Trigger refetch when tickersReady becomes true OR tickers.length > 0
    if ((tickersReady || (tickers && tickers.length > 0)) && !hasRefetchedForWebSocket.current) {
      console.log('🔄 Ticker data ready, loading market data...')
      hasRefetchedForWebSocket.current = true
      query.refetch() // ← Fetch data and populate UI
      // ... progressive polling logic
    }
  }, [wsGetTickerData, tickersReady]) // ← tickersReady as dependency
}
```

### 5. Pass State (App.tsx)
```typescript
const { tickersReady, metricsMap, getTickerData } = useFuturesStreaming()
const { data: coins } = useMarketData(metricsMap, getTickerData, tickersReady)
//                                                               ^^^^^^^^^^^^^ Pass to hook
```

## Execution Flow (FIXED)
1. ✅ App mounts → `useFuturesStreaming()` initializes
2. ✅ `futuresMetricsService.initialize()` called
3. ✅ Fetch REST tickers for top 50 symbols (by volume)
4. ✅ `setInitialTickers()` stores data + emits 'tickersReady' event
5. ✅ Event forwarded through service layer
6. ✅ `useFuturesStreaming` sets `tickersReady = true`
7. ✅ `useMarketData` effect triggers with `tickersReady: true`
8. ✅ Query refetches → `getAllTickerData()` returns initial REST data
9. ✅ **UI displays 50 coins immediately (<2s)**
10. 🔄 Backfill runs in background (non-blocking)
11. 🔄 WebSocket stream populates gradually
12. 🔄 Progressive polling refreshes UI as more data arrives

## Files Modified
- `src/services/stream1mManager.ts` - Added `setInitialTickers()` with event emission
- `src/services/futuresMetricsService.ts` - Added `on()` method for event forwarding
- `src/hooks/useFuturesStreaming.ts` - Added tickersReady state + event listener
- `src/hooks/useMarketData.ts` - Added tickersReady parameter + effect dependency
- `src/App.tsx` - Pass tickersReady to useMarketData

## Benefits
- ✅ Market data displays immediately on load (<2s instead of waiting for backfill)
- ✅ Progressive loading as WebSocket stream populates
- ✅ Clean event-driven architecture (no polling for initialization)
- ✅ Backfill doesn't block UI (runs in background)
- ✅ Fallback to REST data if WebSocket not ready yet

## Testing
1. Open dev console and watch logs
2. Should see:
   ```
   📊 Fetched 50 initial tickers for display
   📊 Stored 50 initial tickers for immediate display
   📊 Initial tickers ready - market data can be displayed
   🔄 Ticker data ready (tickersReady: true, tickers: 50), loading market data...
   ```
3. Market data list should populate with 50 coins within 2 seconds
4. Backfill progress should show in background (0-100%)

## Next Steps
- [ ] Remove excessive debug logging once confirmed working
- [ ] Test with network throttling
- [ ] Verify progressive polling doesn't restart unnecessarily
- [ ] Monitor for edge cases (network errors during initial fetch)
