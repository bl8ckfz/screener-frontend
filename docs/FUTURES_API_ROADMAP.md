# Futures API Refactoring Roadmap

## Overview
Complete migration from Binance Spot API to Futures API with new alert system. This replaces the existing Spot-based data gathering and alert engine with multi-timeframe Futures data.

**Start Date**: December 4, 2025  
**Target Completion**: 3 weeks (December 25, 2025)  
**Current Status**: Week 2 - Alert Engine Integration Complete (59% - 49/83 tasks)

---

## Phase 1: API Clients Implementation (Week 1, Days 1-3) ✅

### 1.1 Binance Futures API Client ✅
**File**: `src/services/binanceFuturesApi.ts`

**Tasks**:
- [x] Create `BinanceFuturesApiClient` class
- [x] Implement `fetchKlines(symbol, interval, limit)` method
  - Endpoint: `GET /fapi/v1/klines`
  - Parameters: symbol (e.g., 'BTCUSDT'), interval ('5m', '15m', '1h', '8h', '1d'), limit (2)
  - Response parsing: Convert Binance array format to typed objects
- [x] Implement `fetchAllFuturesSymbols()` method
  - Endpoint: `GET /fapi/v1/exchangeInfo`
  - Filter: USDT-M futures only
- [x] Add error handling with exponential backoff
- [x] Add request timeout (10s)
- [x] Add CORS proxy support for development
- [x] Write unit tests with mocked responses (9 tests)

**Success Criteria**:
- ✅ Can fetch klines for all 5 intervals (5m, 15m, 1h, 8h, 1d)
- ✅ Handles API errors gracefully
- ✅ Tests pass with 80%+ coverage

---

### 1.2 CoinGecko API Client ✅
**File**: `src/services/coinGeckoApi.ts`

**Tasks**:
- [x] Create `CoinGeckoApiClient` class
- [x] Implement `fetchCoinData(coinId)` method
  - Endpoint: `GET /coins/{id}`
  - Extract: market_cap.usd
- [x] Implement symbol → CoinGecko ID mapping
  - Create `src/config/coinGeckoMapping.ts`
  - Add mappings for 100+ symbols (BTC → bitcoin, ETH → ethereum, etc.)
- [x] Add 1-hour cache for market cap data
- [x] Add rate limiting (30 calls/minute)
- [x] Write unit tests (12 tests)

**Success Criteria**:
- ✅ Can fetch market cap for any supported symbol
- ✅ Cache reduces API calls by 90%+
- ✅ Rate limiting prevents API bans

---

## Phase 2: Data Processing Service (Week 1, Days 4-5) ✅

### 2.1 Futures Metrics Service ✅
**File**: `src/services/futuresMetricsService.ts`

**Tasks**:
- [x] Create `FuturesMetricsService` class
- [x] Implement `fetchSymbolMetrics(symbol)` method
  - Fetch all 5 kline intervals in parallel
  - Calculate price changes: `((current - previous) / previous) * 100`
  - Extract volumes from quote asset
  - Fetch market cap with caching
  - Return `FuturesMetrics` object
- [x] Implement `fetchMultipleSymbolMetrics(symbols[])` method
  - Batch process with Promise.all
  - Add progress tracking
- [x] Add performance monitoring (logging with timestamps)
  - Target: <500ms per symbol ✅
- [x] Write unit tests for calculations (13 tests)

**Success Criteria**:
- ✅ Returns complete metrics for any USDT-M symbol
- ✅ Calculations match manual verification
- ✅ Performance target met

---

### 2.2 Type Definitions ✅
**File**: `src/types/api.ts`

**Tasks**:
- [x] Add `BinanceFuturesKline` interface
- [x] Add `ProcessedKlineData` interface
- [x] Add `FuturesMetrics` interface
- [x] Add `CoinGeckoMarketData` interface
- [x] Add `FuturesFilter` interface
- [x] Export types via barrel export in `src/types/index.ts`

---

## Phase 3: Alert Engine Integration (Week 2, Days 1-3)

### 3.1 Alert Type Definitions ✅
**File**: `src/types/alert.ts`

**Tasks**:
- [x] Add `FuturesAlertType` union type (10 alerts)
- [x] Add `FuturesAlertConfig` interface
- [x] Add `CombinedAlertType` union (Spot + Futures)
- [x] Update UI components to support both alert types
- [x] Ensure backward compatibility with existing alerts
- [x] Add `FUTURES_ALERT_LABELS` and `DEFAULT_FUTURES_ALERT_CONFIG` constants

---

### 3.2 Alert Evaluators ✅
**File**: `src/services/alertEngine.ts`

**Tasks**:
- [x] Implement `evaluateFuturesBigBull60(metrics)`
- [x] Implement `evaluateFuturesBigBear60(metrics)`
- [x] Implement `evaluateFuturesPioneerBull(metrics)`
- [x] Implement `evaluateFuturesPioneerBear(metrics)`
- [x] Implement `evaluateFutures5BigBull(metrics)`
- [x] Implement `evaluateFutures5BigBear(metrics)`
- [x] Implement `evaluateFutures15BigBull(metrics)`
- [x] Implement `evaluateFutures15BigBear(metrics)`
- [x] Implement `evaluateFuturesBottomHunter(metrics)`
- [x] Implement `evaluateFuturesTopHunter(metrics)`
- [x] Implement `evaluateAllFuturesAlerts(metrics)` aggregator
- [x] Write unit tests for each evaluator (20 tests, 100% passing)

**Success Criteria**:
- ✅ All 10 evaluators implemented
- ✅ Tests verify correct logic for edge cases
- ✅ Progressive validation, volume ratios, market cap bounds all implemented
- ⏳ Integration with notification system (deferred to Phase 3.3)

---

### 3.3 Alert UI Components ✅
**Files**: 
- `src/components/alerts/AlertConfig.tsx`
- `src/components/alerts/AlertHistory.tsx`
- `src/types/alert.ts`

**Tasks**:
- [x] Add `FUTURES_ALERT_PRESETS` constant with 10 preset configurations
- [x] Add futures alert preset selector UI
- [x] Update preset handler to support both legacy and futures
- [x] Update alert history dropdown with futures alerts
- [x] Add filtering by alert type (Futures vs Legacy)
- [x] Add visual distinction (green borders for futures)

---

## Phase 4: Remove Old System (Week 2, Days 4-5)

### 4.1 Deprecate Spot API Data Gathering
**Files to Modify**:
- `src/services/binanceApi.ts`
- `src/services/dataProcessor.ts`
- `src/hooks/useMarketData.ts`

**Tasks**:
- [ ] Replace Spot API calls with Futures API calls in `useMarketData`
- [ ] Update `BinanceApiClient` to use futures endpoints
- [ ] Remove/deprecate Spot-specific logic
- [ ] Update data refresh intervals if needed
- [ ] Test with real Futures data

**Migration Strategy**:
- Keep Spot API as fallback during transition
- Add feature flag to toggle between Spot/Futures
- Monitor for 1 week before full removal

---

### 4.2 Remove Old Alerts
**Files to Modify**:
- `src/services/alertEngine.ts`
- `src/types/alert.ts`
- `src/components/alerts/*`

**Tasks**:
- [ ] Identify all Spot-based alert types
- [ ] Mark as deprecated in UI with migration notice
- [ ] Disable creation of new Spot alerts
- [ ] Keep evaluation logic for existing alerts (backward compatibility)
- [ ] Add migration tool to convert Spot alerts to Futures alerts
- [ ] After 2 weeks: Remove Spot alert logic entirely

**Old Alerts to Remove/Replace**:
- Review existing alert types in `src/types/alert.ts`
- Map each to new Futures equivalent or mark for deletion
- Document mapping for user migration guide

---

## Phase 5: Testing & Optimization (Week 3, Days 1-3)

### 5.1 Integration Testing

**Tasks**:
- [ ] End-to-end test: Fetch metrics → Evaluate alerts → Display notifications
- [ ] Test with multiple symbols simultaneously
- [ ] Test error scenarios (API failures, rate limits, network issues)
- [ ] Test caching behavior
- [ ] Test performance under load (50+ symbols)
- [ ] Verify alert accuracy with historical data

---

### 5.2 Performance Optimization

**Tasks**:
- [ ] Profile API call performance
- [ ] Optimize parallel requests (tune concurrency)
- [ ] Optimize cache hit rate
- [ ] Reduce bundle size if needed
- [ ] Add monitoring/logging for production

**Performance Targets**:
- Fetch metrics: <500ms per symbol
- Alert evaluation: <50ms per alert
- Cache hit rate: >80%
- API error rate: <1%

---

### 5.3 Documentation

**Tasks**:
- [ ] Update README with Futures API changes
- [ ] Create user migration guide (Spot → Futures alerts)
- [ ] Document new alert types with examples
- [ ] Update API documentation
- [ ] Add troubleshooting guide
- [ ] Update architecture diagrams

---

## Phase 6: Deployment (Week 3, Days 4-5)

### 6.1 Pre-Deployment Checklist

- [ ] All tests passing (unit + integration)
- [ ] Performance targets met
- [ ] Error handling verified
- [ ] Documentation complete
- [ ] User migration guide ready
- [ ] Rollback plan prepared

---

### 6.2 Deployment Strategy

**Stage 1: Beta Release**
- [ ] Deploy with feature flag (Futures API disabled by default)
- [ ] Enable for 10% of users
- [ ] Monitor errors, performance, user feedback
- [ ] Iterate based on feedback

**Stage 2: Full Release**
- [ ] Enable Futures API for all users
- [ ] Display migration notice for Spot alerts
- [ ] Monitor system health for 48 hours

**Stage 3: Cleanup**
- [ ] After 2 weeks: Remove Spot API code
- [ ] Remove feature flags
- [ ] Archive old alert types
- [ ] Final documentation update

---

## Risk Mitigation

### High-Risk Areas

1. **API Rate Limits**
   - Risk: Binance/CoinGecko bans due to excessive requests
   - Mitigation: Implement conservative rate limiting, caching, exponential backoff

2. **Data Accuracy**
   - Risk: Incorrect calculations lead to false alerts
   - Mitigation: Extensive unit tests, manual verification, gradual rollout

3. **Performance Degradation**
   - Risk: Slower than Spot API due to multiple endpoints
   - Mitigation: Parallel requests, caching, performance monitoring

4. **User Confusion**
   - Risk: Users don't understand Futures vs Spot difference
   - Mitigation: Clear migration guide, in-app notifications, support documentation

---

## Success Metrics

### Technical Metrics
- API response time: <500ms (p95)
- Alert accuracy: 100% (manual verification)
- Test coverage: >80%
- Error rate: <1%
- Cache hit rate: >80%

### User Metrics
- Alert adoption: >50% of active users enable ≥1 Futures alert
- Migration completion: >80% users migrate from Spot alerts within 2 weeks
- User complaints: <5 related to Futures migration

---

## Dependencies

### External APIs
- Binance Futures API (no authentication required for public endpoints)
- CoinGecko API (free tier sufficient, consider paid tier if needed)

### Internal Components
- Existing alert notification system
- Existing state management (Zustand)
- Existing UI components (Alert Config, Badges, History)

### Development Tools
- TypeScript 5.x
- Vitest for testing
- TanStack Query for data fetching

---

## Timeline Summary

| Week | Phase | Days | Key Deliverables |
|------|-------|------|------------------|
| 1 | Phase 1-2 | 5 | API clients, metrics service, types |
| 2 | Phase 3-4 | 5 | Alert integration, old system removal |
| 3 | Phase 5-6 | 5 | Testing, optimization, deployment |

**Total Duration**: 15 working days (3 weeks)

---

## Next Steps

1. Review this roadmap with team
2. Confirm timeline and resource allocation
3. Create GitHub issues for each task
4. Begin Phase 1: API Clients Implementation
5. Set up progress tracking (use this document as checklist)

---

## Notes

- This roadmap assumes full-time dedicated work
- Adjust timeline if working part-time or with other priorities
- Each phase has dependencies - cannot parallelize beyond phase boundaries
- Feature flag approach allows safe rollback at any point
- Keep FUTURES_API_IMPLEMENTATION_PLAN.md as technical reference
