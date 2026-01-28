# Week 2 Cleanup Complete - January 27, 2026

## Summary

Successfully deleted **31 legacy files** and created **5 temporary stubs** during backend migration.

## Files Deleted (31 total)

### Services (14 files)
- ✅ binanceFuturesWebSocket.ts
- ✅ changeCalculator.ts
- ✅ coinGeckoApi.ts
- ✅ futuresMetricsService.ts
- ✅ ringBufferManager.ts
- ✅ stream1mManager.ts
- ✅ webSocketStreamManager.ts
- ✅ chartData.ts
- ✅ alertEngine.ts
- ✅ alertBatcher.ts
- ✅ alertHistory.ts
- ✅ bubbleDetectionService.ts
- ✅ ichimokuMonitor.ts
- ✅ webhookService.ts

### Hooks (4 files)
- ✅ useMarketData.ts (978 lines → replaced with 120-line useBackendData.ts)
- ✅ useFuturesStreaming.ts
- ✅ useBubbleStream.ts
- ✅ useMarketDataSource.ts

### Utils (4 files)
- ✅ candle1mRingBuffer.ts
- ✅ indicators.ts
- ✅ klineRingBuffer.ts
- ✅ slidingWindowCalculator.ts

### Tests (9 files)
- ✅ tests/integration/alertPipeline.test.ts
- ✅ tests/services/binanceFuturesWebSocket.ticker.test.ts
- ✅ tests/services/binanceFuturesWebSocket.test.ts
- ✅ tests/services/binanceFuturesApi.test.ts
- ✅ tests/alerts/futuresAlerts.test.ts
- ✅ tests/utils/klineRingBuffer.test.ts
- ✅ tests/utils/candle1mRingBuffer.test.ts
- ✅ tests/utils/indicators.test.ts
- ✅ tests/utils/slidingWindowCalculator.test.ts

### Backup Files (4 files)
- ✅ src/App.tsx.backup2
- ✅ src/App.tsx.backup
- ✅ src/services/alertEngine.ts.backup
- ✅ src/services/backendAdapter.ts.backup

## Files Created (5 stubs)

Temporary stubs to maintain TypeScript compilation during migration:

1. **src/types/chart.ts** (85 lines)
   - Types: KlineInterval, Candlestick, IchimokuData
   - Stubs: fetchKlines(), calculateIchimoku(), calculateWeeklyVWAP()
   - TODO: Replace with backend chart API

2. **src/services/webhookStubs.ts** (21 lines)
   - Stubs: testDiscordWebhook(), testTelegramWebhook(), isValidDiscordWebhookUrl()
   - TODO: Backend will execute webhooks

3. **src/services/alertHistoryStub.ts** (60 lines)
   - Stub class: AlertHistoryStub with all methods
   - TODO: Replace with backend alert history API

4. **src/hooks/useBubbleStreamStub.ts** (30 lines)
   - Stub hook: useBubbleStream()
   - TODO: Backend will detect bubbles via WebSocket

5. **src/services/backendAdapterStub.ts** (18 lines)
   - Stubs: isUsingBackend(), checkBackendHealth()
   - TODO: Remove when backend is only source

## Known Issues

### Chart Components (19 TypeScript errors)
Chart-related components have compilation errors because:
- Old API expected 4 params: `fetchKlines(symbol, pair, interval, limit)`
- New stub expects 3 params: `fetchKlines(symbol, interval, limit)`
- Old API returned `{ candlesticks: [] }`
- New stub returns `Candlestick[]` directly

**Decision**: Accept these errors temporarily. Chart functionality will be re-implemented when backend provides chart data API.

**Affected Files**:
- src/components/coin/ChartContainer.tsx (10 errors)
- src/components/coin/ChartSection.tsx (6 errors)
- src/components/coin/TradingChart.tsx (3 errors)

## Active Services (Kept)

1. **backendApi.ts** - Primary data source (HTTP + WebSocket)
2. **storage.ts** - LocalStorage/IndexedDB
3. **alertHistoryService.ts** - UI state management
4. **notification.ts** - Browser notifications
5. **audioNotification.ts** - Sound alerts
6. **syncService.ts** - Supabase sync

## Impact

### Code Reduction
- **Before**: ~11,300 lines of service code
- **After**: ~3,200 lines (stubs temporary)
- **Reduction**: **~70%** (as planned)

### Bundle Size
- Target: <500KB (currently 71.84KB gzipped ✅)
- Expect further reduction when stubs are removed

### Next Steps (Week 3)

1. **Implement Backend Chart API**
   - Add `/api/chart/klines` endpoint to Go backend
   - Add Ichimoku calculation endpoint
   - Fix chart component calls

2. **Implement Backend Alert History**
   - Add `/api/alerts/history` endpoints
   - Remove alertHistoryStub.ts

3. **Implement Backend Webhooks**
   - Add `/api/webhooks` CRUD endpoints
   - Add webhook testing endpoint
   - Remove webhookStubs.ts

4. **Clean Up Stubs**
   - Delete all 5 stub files
   - Update components to use real backend APIs
   - Achieve 0 TypeScript errors

5. **Documentation**
   - Update README.md with new architecture
   - Document backend API endpoints
   - Create migration guide for future reference

## Lessons Learned

1. **Incremental Deletion**: Deleting files incrementally with TypeScript checks prevented cascading errors
2. **Stub Strategy**: Creating temporary stubs allowed compilation during migration without implementing all features
3. **Chart Complexity**: Chart components have deep dependencies - should be Phase 3 work, not cleanup phase
4. **Testing Impact**: Deleted 9 test files - will need new integration tests against backend

## Files Modified

- `src/hooks/index.ts` - Removed legacy exports, added useBackendData
- `src/utils/index.ts` - Removed indicator exports
- `src/services/index.ts` - Cleaned up exports, documented deletions
- `src/App.tsx` - Simplified to single data source
- 7 component files - Added TODO comments for backend implementation
