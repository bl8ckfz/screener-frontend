# Debug: Pioneer Bull Alert Not Disabling

## Issue
When disabling or deleting the Pioneer Bull alert, alerts continue to trigger.

## Debug Steps Added

### 1. Store Actions Logging
Added console.log statements to `toggleAlertRule` and `deleteAlertRule` in `useStore.ts`:
- Logs when a rule is toggled/deleted
- Logs the updated rules array with their enabled status

### 2. Alert Evaluation Logging
Added console.log statements to the alert evaluation effect in `useMarketData.ts`:
- Logs when the effect is triggered
- Logs all rules and their enabled status BEFORE filtering
- Logs only enabled rules AFTER filtering

## How to Test

1. Open browser DevTools console
2. Enable the Pioneer Bull alert
3. Wait for alerts to trigger (watch console)
4. Disable the Pioneer Bull alert
5. Watch console output:

Expected output when toggling OFF:
```
🔄 Toggling alert rule rule_xxx to DISABLED
📝 Updated rules: [{ id: 'rule_xxx', name: 'Pioneer Bull', enabled: false }]
🔄 Alert evaluation effect triggered { hasData: true, alertsEnabled: true, ... }
📊 Total alert rules: 1
📋 All rules: [{ id: 'rule_xxx', name: 'Pioneer Bull', enabled: false, type: 'pioneer_bull' }]
⚠️ No enabled alert rules
```

If you see alerts still triggering with `enabled: false`, then we have a state consistency issue.

## Potential Root Causes

### Theory 1: Race Condition
The data refresh interval (default 5s) might be firing an alert evaluation before the state update completes.

**Fix**: Ensure `alertRules` dependency in useEffect causes immediate re-evaluation when rules change.

### Theory 2: Stale Closure
The alert evaluation effect might be capturing a stale `alertRules` reference.

**Fix**: Verify all dependencies are in the dependency array: `[query.data, alertRules, alertSettings, addAlert]`

### Theory 3: Multiple Instances
Multiple tabs/windows might be running with different states.

**Fix**: Close all tabs and test in single tab.

### Theory 4: Persistence Lag
IndexedDB persistence might be slow, causing rules to revert.

**Fix**: Check if `partialize` in Zustand persist middleware includes `alertRules` (✅ it does - line 477 in useStore.ts).

### Theory 5: Cache Issue
React Query might be caching old data with old alert evaluations.

**Fix**: Alert evaluation happens in useEffect, not in queryFn, so this is unlikely.

## Next Steps

1. **Run the app**: `npm run dev`
2. **Open console**: F12 → Console tab
3. **Test the scenario**: Enable → Wait for alert → Disable → Check logs
4. **Analyze output**: Look for patterns in the console logs

If alerts still trigger with `enabled: false` in the logs, the issue is in `evaluateAlertRules` function or there's a timing bug.

If logs show `enabled: true` after you disabled it, the store update isn't working.

## Expected Fix

After adding these logs, we should be able to see exactly where the disconnect is:
- If the store updates correctly but alerts still fire → Bug in `evaluateAlertRules`
- If the store doesn't update → Bug in `toggleAlertRule`
- If logs show correct state but old alerts still show → Cached alert objects in UI

## Cleanup

Once the issue is identified and fixed, you can:
1. Remove the debug console.log statements
2. Delete this DEBUG_ALERT_TOGGLE.md file
3. Update docs/STATE.md with the fix
