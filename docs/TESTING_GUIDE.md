# Testing Guide - Frontend

## Testing After Week 2 Cleanup

After deleting 31 legacy files and integrating with the backend, the following test procedure ensures the application works correctly.

## ✅ Manual Testing Checklist

### 1. Backend Connection

**Verify backend is accessible**:
```bash
curl https://api-gateway-production-f4ba.up.railway.app/api/health
# Expected: {"status":"ok","timestamp":"...","uptime":"..."}

curl https://api-gateway-production-f4ba.up.railway.app/api/metrics/ | jq '.[0]'
# Expected: JSON object with symbol, timeframes, metrics
```

**Check frontend connection**:
1. Open browser DevTools → Network tab
2. Start dev server: `npm run dev`
3. Navigate to `http://localhost:3000`
4. Look for XHR request to `/api/metrics/` every 5 seconds
5. Verify response contains 43 symbols

### 2. Data Display

**Coin Table**:
- [ ] Table shows 43 rows (one per symbol)
- [ ] VCP column populated with numbers (not 0 or null)
- [ ] Price column shows current prices
- [ ] RSI column shows values 0-100
- [ ] MACD column shows numbers
- [ ] 24H Vol column shows non-zero values
- [ ] Fibonacci columns (R1, S1, etc.) show calculated values

**Timeframe Selectors**:
- [ ] Click "5m" button → Price Change % updates
- [ ] Click "1h" button → Different % values shown
- [ ] Click "4h" button → Different % values shown
- [ ] All timeframes: 5m, 15m, 1h, 4h, 8h, 1d

### 3. Sorting

**Test sorting functionality**:
- [ ] Click "VCP" header → Table sorts descending (highest VCP first)
- [ ] Click "VCP" again → Sorts ascending (lowest first)
- [ ] Click "Price" header → Sorts by price
- [ ] Click "RSI" header → Sorts by RSI
- [ ] Sort indicator (↑/↓) appears in column header

### 4. Filtering & Search

**Currency Pair Filter**:
- [ ] Select "USDT" → Shows only USDT pairs (BTC/USDT, ETH/USDT, etc.)
- [ ] Select "TRY" → Shows TRY pairs (if available)
- [ ] Select "All" → Shows all 43 symbols

**Search**:
- [ ] Type "BTC" in search → Shows only BTC* symbols
- [ ] Type "ETH" → Shows ETH* symbols
- [ ] Clear search → All symbols visible

### 5. Charts (Modal)

**Open coin detail modal**:
1. [ ] Click any row in table
2. [ ] Modal opens with coin details
3. [ ] Chart loads (may take 5-10 seconds in dev due to CORS proxy)
4. [ ] Candlestick chart displays
5. [ ] Volume bars visible at bottom
6. [ ] Timeframe buttons work: 1m, 5m, 15m, 1h, 4h, 1d

**Chart interactions**:
- [ ] Mouse hover shows crosshair with OHLCV data
- [ ] Zoom in/out with mouse wheel
- [ ] Pan chart by dragging
- [ ] Switch intervals → Chart updates with new data

### 6. Market Summary

**Aggregated stats**:
- [ ] Total Coins: Shows 43 (or filtered count)
- [ ] Bullish %: Shows percentage
- [ ] Bearish %: Shows percentage
- [ ] Neutral %: Shows percentage
- [ ] Percentages add up to ~100%

### 7. Export

**CSV Export**:
1. [ ] Click "Export CSV" button
2. [ ] File downloads: `crypto-screener-YYYY-MM-DD.csv`
3. [ ] Open in spreadsheet → Contains all columns
4. [ ] Data matches table display

**JSON Export**:
1. [ ] Click "Export JSON" button
2. [ ] File downloads: `crypto-screener-YYYY-MM-DD.json`
3. [ ] Open in text editor → Valid JSON
4. [ ] Contains all coin data with all fields

### 8. Alerts (WebSocket)

**Test alert connection**:
1. [ ] Open DevTools → Console
2. [ ] Look for "WebSocket connected" message
3. [ ] Look for "Subscribed to alerts" message
4. [ ] No WebSocket error messages

**Note**: Backend alert generation requires actual market conditions. Manual alert testing requires backend configuration.

### 9. Responsive Design

**Test at different widths**:
- [ ] Desktop (1920px): All columns visible
- [ ] Laptop (1366px): Table scrolls horizontally if needed
- [ ] Tablet (768px): Responsive layout works
- [ ] Mobile (375px): Touch interactions work, table usable

### 10. Error Handling

**Backend offline test**:
1. [ ] Stop backend or use invalid URL in .env.local
2. [ ] Frontend shows "No data available" or loading state
3. [ ] No console errors (graceful degradation)
4. [ ] Reconnect → Data loads automatically

**Chart API failure**:
1. [ ] Open modal
2. [ ] If chart fails to load, error message appears
3. [ ] Retry button works (if implemented)

## 🧪 Automated Testing

### Run Test Suite

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test useBackendData.test.ts
```

### Expected Test Results

After Week 2 cleanup, tests may need updates. Priority tests:

- [ ] `format.test.ts` - Number/date formatting utilities
- [ ] `sort.test.ts` - Sorting algorithms
- [ ] `export.test.ts` - CSV/JSON export
- [ ] `useBackendData.test.ts` - Backend integration
- [ ] `useMarketStats.test.ts` - Market aggregation

### Coverage Goals

- **Target**: 80% coverage
- **Current**: ~40% (needs improvement)
- **Priority**: Hook tests, utility tests, component snapshot tests

## 🔍 TypeScript Validation

**Must pass with 0 errors**:
```bash
npm run type-check
```

Expected output:
```
✓ Type checking complete
  0 errors
```

**Common type issues**:
- Missing null checks
- Incorrect prop types
- Missing imports
- Type narrowing needed

## 🐛 Known Issues (Acceptable for Phase 2)

1. **Ichimoku/VWAP disabled**: Charts show candlesticks + volume only
   - Calculation functions return null/empty
   - Will be re-enabled in Phase 3 if needed

2. **Stub components**: 5 temporary stubs in place
   - `alertHistoryStub.ts`
   - `webhookStubs.ts`
   - `backendAdapterStub.ts`
   - `useBubbleStreamStub.ts`
   - `chart.ts` (deprecated)
   - Will be replaced with backend APIs later

3. **Alert history not persistent**: Uses stub
   - Backend API not implemented yet
   - LocalStorage caching works

4. **Webhook testing**: Uses stub data
   - Backend webhook execution not implemented
   - UI configuration works

## 📝 Test Report Template

```markdown
## Test Session Report

**Date**: [DATE]
**Tester**: [NAME]
**Environment**: Dev/Prod
**Backend Status**: Online/Offline
**Browser**: Chrome/Firefox/Safari [VERSION]

### Results
- [ ] Backend Connection: PASS / FAIL
- [ ] Data Display: PASS / FAIL
- [ ] Sorting: PASS / FAIL
- [ ] Filtering: PASS / FAIL
- [ ] Charts: PASS / FAIL
- [ ] Market Summary: PASS / FAIL
- [ ] Export: PASS / FAIL
- [ ] Alerts: PASS / FAIL
- [ ] Responsive: PASS / FAIL
- [ ] TypeScript: PASS / FAIL

### Issues Found
1. [Issue description]
2. [Issue description]

### Notes
[Additional observations]
```

## 🚀 Pre-Deployment Checklist

Before deploying to production:

- [ ] All manual tests pass
- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run lint` passes with 0 warnings
- [ ] `npm run build` succeeds
- [ ] `npm run preview` works correctly
- [ ] Backend health check passes
- [ ] Environment variables set in Vercel
- [ ] Test on production backend URL
- [ ] Cross-browser testing complete
- [ ] Mobile testing complete
- [ ] Performance audit: Lighthouse score >90

## 🔗 Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [WEEK2_CLEANUP_COMPLETE.md](./WEEK2_CLEANUP_COMPLETE.md) - Cleanup details
- [ROADMAP.md](./ROADMAP.md) - Development phases
