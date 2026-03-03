# Alert System Testing Guide

**Date**: November 28, 2025  
**Status**: Phase 6 Complete - Ready for Testing  
**Version**: 2.0.0

## Overview

The alert system has been fully implemented and integrated into the crypto screener. This guide provides instructions for testing all 8 legacy alert types against live Binance data.

---

## Prerequisites

### 1. Start Development Server
```bash
cd /home/yaro/fun/crypto/screener
npm run dev
```

### 2. Verify Settings
- Open browser to http://localhost:3000
- Check browser console for "Using mock data" message
  - If present: Set `USE_MOCK_DATA = false` in `src/services/mockData.ts`
- Ensure IndexedDB is enabled in browser

### 3. Configure Alert Settings
Navigate to alert settings (when UI is integrated) and verify:
- ✅ Alerts enabled: `true`
- ✅ Sound enabled: `false` (optional - can be noisy)
- ✅ Notifications enabled: `true`
- ✅ Max alerts per symbol: `5`
- ✅ Alert cooldown: `60` seconds
- ✅ Auto-dismiss after: `30` seconds

---

## Test Plan

### Phase 1: Smoke Tests (5 minutes)

**Objective**: Verify basic functionality works

1. **Create Test Rule**
   - Click "Add Rule" button
   - Select "Scout Bull" preset
   - Rule should appear in list with toggle enabled
   - Verify rule persists after page refresh (IndexedDB)

2. **Monitor Console**
   - Watch for evaluation logs: `🔔 Alert triggered: BTCUSDT - Scout Bull`
   - Should see "Failed to evaluate alerts" errors if any issues

3. **Check Notification Display**
   - Alerts should appear as toasts in top-right corner
   - Verify auto-dismiss countdown bar
   - Click X to dismiss manually

4. **Verify History Persistence**
   - Open browser DevTools → Application → IndexedDB
   - Check `crypto_screener_preferences` → `alert_history` key
   - Should contain triggered alerts

---

### Phase 2: Legacy Alert Types Testing (30 minutes)

Test each of the 8 legacy alert types from fast.html:

#### 1. Scout Bull Alert
**Conditions**: Strong bullish momentum
- Price/3m > 1.01
- Price/15m > 1.01
- Volume increasing
- Accelerating momentum

**Test Steps**:
1. Create Scout Bull rule
2. Watch for high-momentum coins (BTC, ETH during pumps)
3. Verify alert triggers during strong upward movement
4. Check message includes price ratios and volume data

**Expected Result**: Alert triggers on strong bull runs with increasing volume

---

#### 2. Scout Bear Alert
**Conditions**: Strong bearish momentum
- Price/3m < 0.99
- Price/15m < 0.99
- Volume increasing
- Accelerating downward momentum

**Test Steps**:
1. Create Scout Bear rule
2. Watch for high-momentum sell-offs
3. Verify alert triggers during sharp drops
4. Check message indicates bearish pressure

**Expected Result**: Alert triggers on strong sell-offs with volume spike

---

#### 3. Surge 5 Bull Alert
**Conditions**: 5-minute volume and price surge
- Price/3m > 1.006
- 3m volume delta > 100,000
- 5m volume delta > 50,000
- Ascending volume: 3m < 1m < 5m < current

**Test Steps**:
1. Create Surge 5 Bull rule
2. Monitor coins with sudden volume spikes
3. Verify 5-minute timeframe detection
4. Check volume delta calculations

**Expected Result**: Alert triggers on 5-minute bullish breakouts

---

#### 4. Surge 5 Bear Alert
**Conditions**: 5-minute volume and price drop
- Price/3m < 0.994
- 3m volume delta > 100,000
- 5m volume delta > 50,000
- Ascending volume pattern

**Test Steps**:
1. Create Surge 5 Bear rule
2. Watch for sudden sell pressure
3. Verify alert timing matches volume spikes
4. Confirm price drop threshold

**Expected Result**: Alert triggers on 5-minute bearish breakdowns

---

#### 5. 1Surge 5 Bull Alert
**Conditions**: 15-minute sustained bull run
- Price/3m > 1.006
- 15m volume delta > 400,000
- Volume ascending across multiple timeframes

**Test Steps**:
1. Create 1Surge 5 Bull rule
2. Monitor for sustained upward trends
3. Verify 15-minute timeframe used
4. Check larger volume threshold (400k)

**Expected Result**: Alert triggers on longer-term bullish moves

---

#### 6. 1Surge 5 Bear Alert
**Conditions**: 15-minute sustained decline
- Price/3m < 0.994
- 15m volume delta > 400,000
- Volume spike during decline

**Test Steps**:
1. Create 1Surge 5 Bear rule
2. Watch for prolonged sell-offs
3. Verify 15-minute timeframe detection
4. Confirm volume threshold met

**Expected Result**: Alert triggers on longer-term bearish moves

---

#### 7. Bottom Hunter Alert
**Conditions**: Potential reversal from bottom
- Price/15m < 0.994 (recent decline)
- Price/1m > 1.004 (recovery starting)
- Volume confirmation

**Test Steps**:
1. Create Bottom Hunter rule
2. Look for oversold coins recovering
3. Verify catches early reversal signals
4. Check timeframe combination (15m + 1m)

**Expected Result**: Alert triggers on potential bottom reversals

---

#### 8. Top Hunter Alert
**Conditions**: Potential top/distribution
- Price/15m > 1.006 (recent pump)
- Slowing momentum
- Distribution patterns

**Test Steps**:
1. Create Top Hunter rule
2. Watch coins after strong runs
3. Verify catches distribution signals
4. Check for momentum slowdown detection

**Expected Result**: Alert triggers on potential tops

---

### Phase 3: Anti-Spam Testing (10 minutes)

**Objective**: Verify cooldown and limit mechanisms work

#### Test 3.1: Cooldown System
1. Create Scout Bull rule
2. Find volatile coin (e.g., BTCUSDT)
3. Wait for first alert to trigger
4. Within 60 seconds, verify NO duplicate alerts
5. After 60 seconds, verify alerts can trigger again

**Expected**: Only 1 alert per symbol per 60 seconds

#### Test 3.2: Max Alerts Per Symbol
1. Lower cooldown to 5 seconds (via settings)
2. Set max alerts to 3
3. Monitor highly volatile coin
4. Verify stops after 3rd alert
5. Reset by clearing `recentAlerts` (page refresh)

**Expected**: Maximum 3 alerts per symbol per session

#### Test 3.3: Notification Queue
1. Create multiple alert rules (all 8 types)
2. Wait for market volatility
3. Trigger many alerts simultaneously
4. Verify only 5 visible toasts at once
5. Older alerts dismissed as new ones arrive

**Expected**: Max 5 toasts displayed simultaneously

---

### Phase 4: Performance Testing (15 minutes)

**Objective**: Measure impact on refresh cycle

#### Test 4.1: Baseline Performance
1. Disable all alert rules
2. Monitor data refresh (every 5 seconds)
3. Check browser DevTools Performance tab
4. Record baseline refresh time

**Expected**: ~200-500ms per refresh

#### Test 4.2: With Alerts Enabled
1. Enable all 8 legacy alert rules
2. Monitor 25+ coin pairs (USDT pair)
3. Check refresh time with alerts
4. Compare to baseline

**Expected**: <100ms overhead for alert evaluation

#### Test 4.3: Memory Usage
1. Run for 5 minutes with all alerts enabled
2. Monitor browser memory (DevTools Memory tab)
3. Check for memory leaks
4. Verify IndexedDB size stays reasonable

**Expected**: 
- Memory stable (no leaks)
- IndexedDB < 10MB for 1000 alerts

---

### Phase 5: History & Export Testing (10 minutes)

#### Test 5.1: History Viewer
1. Navigate to Alert History component
2. Verify all triggered alerts appear
3. Test filters:
   - Time range (1h, 24h, 7d, 30d, all)
   - Alert type dropdown
   - Severity filter
   - Search by symbol
4. Test sorting:
   - By timestamp
   - By symbol
   - By severity

**Expected**: All filters and sorting work correctly

#### Test 5.2: Export Functionality
1. Trigger several alerts (5-10)
2. Click "Export CSV"
3. Verify CSV file downloads with correct data
4. Click "Export JSON"
5. Verify JSON structure is valid
6. Open exported files to validate content

**Expected**: 
- CSV properly formatted with headers
- JSON valid and readable
- All alert fields included

#### Test 5.3: Clear History
1. Click "Clear 7+ days old"
2. Verify only recent alerts remain
3. Click "Clear 30+ days old"
4. Click "Clear All" (with confirmation)
5. Verify history is empty

**Expected**: History management works without errors

---

## Comparison with fast.html

### Test 6: Legacy Behavior Verification (20 minutes)

**Objective**: Ensure alerts match original fast.html logic

1. **Open fast.html** in separate browser tab
2. **Enable same alert types** in both apps
3. **Monitor same coin pair** (e.g., BTCUSDT/USDT)
4. **Compare alert triggers**:
   - Timing (should match within 5-10 seconds)
   - Message content
   - Threshold values
   - Timeframe references

**Validation Checklist**:
- ✅ Scout alerts trigger on same conditions
- ✅ Big alerts match volume thresholds
- ✅ Hunter alerts catch same reversals
- ✅ Alert messages are informative
- ✅ Severity levels appropriate

**Known Differences**:
- New app has better notification UI
- New app persists history to IndexedDB
- New app has configurable cooldown/limits
- Fast.html alerts may be more aggressive (no cooldown)

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Acceptable | Warning |
|--------|--------|------------|---------|
| Alert evaluation time | <50ms | <100ms | >100ms |
| Total refresh cycle | <500ms | <1000ms | >1000ms |
| Memory usage (5 min) | <50MB | <100MB | >100MB |
| IndexedDB size (1000 alerts) | <5MB | <10MB | >10MB |
| Alert latency | <1s | <5s | >5s |

### Actual Results (To Be Filled)

| Metric | Result | Status | Notes |
|--------|--------|--------|-------|
| Alert evaluation time | ___ ms | ⏳ | |
| Total refresh cycle | ___ ms | ⏳ | |
| Memory usage (5 min) | ___ MB | ⏳ | |
| IndexedDB size | ___ MB | ⏳ | |
| Alert latency | ___ s | ⏳ | |
| Alerts triggered (30 min) | ___ | ⏳ | |
| False positives | ___ | ⏳ | |
| Missed alerts (vs fast.html) | ___ | ⏳ | |

---

## Known Issues & Limitations

### Current Limitations

1. **No UI Integration Yet**
   - Alert components created but not integrated into main Layout
   - Need to add AlertNotificationContainer to App.tsx
   - Need to add AlertConfig and AlertHistory to sidebar/modal

2. **Legacy Alert Logic Approximation**
   - Some fast.html conditions use complex JavaScript logic
   - New implementation may have slight timing differences
   - Volume calculations may vary due to precision

3. **Desktop Notifications**
   - Browser desktop notifications not yet implemented
   - Only in-app toast notifications currently

4. **Sound Customization**
   - Only basic sine wave beeps
   - No custom sound files or volume control

### Future Enhancements

- [ ] Desktop browser notifications (Notification API)
- [ ] Custom sound files for different alert types
- [ ] Alert rules import/export
- [ ] Alert backtesting against historical data
- [ ] Machine learning for alert optimization
- [ ] Telegram/Discord webhook integration
- [ ] Alert rule templates marketplace

---

## Troubleshooting

### Issue: No Alerts Triggering

**Possible Causes**:
1. Alert settings disabled globally
2. No alert rules created or all disabled
3. Coins don't meet condition thresholds
4. Using mock data (not live Binance data)

**Solution**:
- Check `alertSettings.enabled === true`
- Verify at least one rule with `enabled: true`
- Monitor console for evaluation logs
- Set `USE_MOCK_DATA = false`

---

### Issue: Too Many Alerts (Spam)

**Possible Causes**:
1. Cooldown set too low
2. Max alerts per symbol too high
3. Alert conditions too lenient
4. Multiple rules triggering same coin

**Solution**:
- Increase cooldown to 60+ seconds
- Reduce max alerts to 3-5
- Tighten thresholds (e.g., 1.01 → 1.02)
- Disable redundant rules

---

### Issue: Alerts Not Persisting

**Possible Causes**:
1. IndexedDB disabled in browser
2. Incognito/private mode
3. Browser storage quota exceeded
4. Storage service errors

**Solution**:
- Enable IndexedDB in browser settings
- Use normal browser window
- Clear old history data
- Check console for storage errors

---

### Issue: Performance Degradation

**Possible Causes**:
1. Too many coins being monitored (25+)
2. Too many alert rules (10+)
3. Complex alert conditions
4. Memory leak in alert history

**Solution**:
- Limit to 10-15 coin pairs
- Reduce to 3-5 active rules
- Disable unused alert types
- Clear old history regularly

---

## Test Completion Checklist

### Functional Tests
- [ ] All 8 legacy alert types tested individually
- [ ] Alerts trigger on correct conditions
- [ ] Notifications display properly
- [ ] History persists to IndexedDB
- [ ] Export CSV works
- [ ] Export JSON works
- [ ] Clear history functions work
- [ ] Filters work correctly
- [ ] Sorting works correctly
- [ ] Search works correctly

### Performance Tests
- [ ] Alert evaluation < 100ms
- [ ] Total refresh cycle < 1000ms
- [ ] Memory usage stable
- [ ] No memory leaks detected
- [ ] IndexedDB size reasonable

### Anti-Spam Tests
- [ ] Cooldown prevents duplicates
- [ ] Max alerts limit enforced
- [ ] Notification queue limited to 5
- [ ] Auto-dismiss works correctly

### Integration Tests
- [ ] Alerts work with live Binance data
- [ ] Behavior matches fast.html
- [ ] No errors in console
- [ ] UI responsive during alerts
- [ ] Page refresh preserves rules

### Cross-Browser Tests
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile browsers (optional)

---

## Sign-Off

**Tester**: _______________  
**Date**: _______________  
**Result**: ⏳ PENDING / ✅ PASSED / ❌ FAILED  

**Notes**:
```
(Add any observations, issues found, or recommendations here)
```

---

## Next Steps After Testing

1. **If PASSED**:
   - Mark Task 8 complete
   - Update ROADMAP.md Phase 6 status
   - Integrate UI components into Layout
   - Create user documentation
   - Prepare for Phase 7 (QA & Optimization)

2. **If FAILED**:
   - Document all issues found
   - Create bug fixes in alertEngine.ts
   - Re-test failed scenarios
   - Update this document with learnings

3. **Phase 7 Preview**:
   - End-to-end testing
   - User acceptance testing
   - Performance optimization
   - Bug fixes and polish
   - Production deployment prep
