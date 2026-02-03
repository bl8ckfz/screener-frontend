# Alert Cooldown & Toast UI Removal Plan

## Date: February 3, 2026

## Current State Analysis - CORRECTED

### Alert Cooldown Mechanism

**Location**: `screener/src/hooks/useMarketData.ts` (lines 479-508)

**Current Implementation**:
- ✅ **COOLDOWN IS FULLY IMPLEMENTED** in screener frontend
- ❌ **NOT IMPLEMENTED** in screener-frontend (uses backend API only, no local evaluation)
- The `alertSettings.alertCooldown: 60` setting **IS ACTIVELY USED**
- Local alert evaluation engine respects cooldown before triggering toasts

**Code Evidence** (`screener` repo):
```typescript
// screener/src/hooks/useMarketData.ts (lines 479-508)

// Check cooldown to prevent spam
const lastAlertTime = recentAlerts.current.get(symbol) || 0
const cooldownMs = alertSettings.alertCooldown * 1000

if (now - lastAlertTime < cooldownMs) {
  continue // Skip if in cooldown period
}

// Update cooldown tracker immediately to prevent batch duplicates
recentAlerts.current.set(symbol, now)

// Check max alerts per symbol
const symbolAlertCount = Array.from(recentAlerts.current.entries()).filter(
  ([sym]) => sym === symbol
).length

if (symbolAlertCount >= alertSettings.maxAlertsPerSymbol) {
  continue // Skip if reached max alerts for this symbol
}
```

**How It Works**:
- `recentAlerts` is a React useRef Map: `Map<symbol, lastAlertTimestamp>`
- Before triggering alert, checks if 60 seconds elapsed since last alert for that symbol
- **Prevents 13 alerts/minute** → Shows only 1 alert per minute per symbol
- Also enforces `maxAlertsPerSymbol: 5` limit across all recent alerts

**Why You Never See 13 Alerts/Minute** (screener-frontend):

The "cooldown effect" comes from **10-second HTTP polling**, NOT explicit cooldown logic:

1. **Backend**: Evaluates 13x/minute (every 5s) → Sends all 13 alerts via WebSocket
2. **Frontend WebSocket**: Receives all 13 alerts → Stores in local state (not displayed directly)
3. **Frontend HTTP**: Polls `alertHistory.getAllBySymbol()` every **10 seconds** (line 182 in AlertHeatmapTimeline.tsx)
4. **User Sees**: Only alerts from HTTP response, fetched every 10s (not real-time WebSocket)

**Code Evidence**:
```typescript
// screener-frontend/src/components/alerts/AlertHeatmapTimeline.tsx (line 177-184)
const backendAlertsQuery = useQuery({
  queryKey: ['backendAlerts', querySymbol],
  queryFn: () => alertHistory.getAllBySymbol(querySymbol),
  enabled: USE_BACKEND_API && !!querySymbol,
  staleTime: 10000, // Refresh every 10s to catch new alerts
  refetchInterval: 10000, // ← THIS IS THE "COOLDOWN"
  retry: 2,
})
```

**Conclusion**: 
- ❌ No explicit cooldown logic in screener-frontend
- ✅ 10-second HTTP polling creates natural batching/throttling
- Backend sends 13 alerts/min, but frontend only polls every 10s
- This explains why you never saw spam - the UI refreshes slowly enough to group alerts

**Toast Notifications**: Also don't show 13 alerts because:
1. `notificationEnabled: false` by default (toasts disabled)
2. Even if enabled, WebSocket alerts aren't connected to toast system (onAlert callback only logs)
3. Toasts would need explicit connection to WebSocket data to show real-time

### Toast Notification System

**Location**: `src/components/alerts/AlertNotification.tsx`

**Current Implementation**:

1. **AlertNotificationToast Component** (lines 13-152)
   - Individual toast with auto-dismiss timer
   - Uses `autoDismissAfter` setting (default: 30s)
   - Fade-out animation on dismiss
   - Sound notification via Web Audio API

2. **AlertNotificationContainer Component** (lines 229-328)
   - Manages toast queue
   - Limits to 5 visible toasts: `const visibleAlerts = activeAlerts.slice(-5)`
   - Positioned top-right corner
   - Controlled by `alertSettings.notificationEnabled` (default: **disabled**)
   - Sound controlled by `alertSettings.soundEnabled` (default: **disabled**)

**Data Flow**:
```
Backend WebSocket → useBackendAlerts → handleAlert() 
                                     ↓
                             transformBackendAlert()
                                     ↓
                          useStore.addAlert(alert)
                                     ↓
                          activeAlerts array updated
                                     ↓
                     AlertNotificationContainer renders
                                     ↓
                        Shows last 5 toasts only
```

**Key Files**:
- `src/components/alerts/AlertNotification.tsx` (370 lines)
- `src/hooks/useBackendAlerts.ts` (221 lines)
- `src/hooks/useStore.ts` - manages `activeAlerts` array (line 326)
- `src/App.tsx` - renders `<AlertNotificationContainer />` (line 84)

## Problem Statement

### Issue 1: Misleading Cooldown Setting
- User sees `alertCooldown: 60` in settings
- Expects cooldown behavior but none exists
- Settings UI may show toggle that does nothing

### Issue 2: Toast Spam with High-Frequency Alerts
- 13 alerts/minute = 13 toasts
- Even with 5-toast limit, UI gets cluttered
- Auto-dismiss at 30s means 6.5 toasts stack up
- User can't see chart/table behind toasts

### Issue 3: Redundant Alert Display
- Toast notifications (top-right)
- Alert Timeline Chart (heatmap + dots)
- Alert History Table (grouped)
- TradingView Chart markers
- **Too many representations** of same data

## Implementation Plan

### Phase 1: Make Alert Cooldown Configurable ⚙️

**Goal**: Implement actual cooldown logic or remove setting entirely

#### Option A: Implement Cooldown Logic (Recommended)

**Files to Modify**:
1. `src/hooks/useBackendAlerts.ts`
2. `src/hooks/useStore.ts`
3. `src/components/settings/AlertConfig.tsx` (if exists)

**Changes**:

```typescript
// NEW: src/utils/alertCooldown.ts
export class AlertCooldownManager {
  private lastAlertTime = new Map<string, number>()
  
  shouldAllow(symbol: string, type: string, cooldownSeconds: number): boolean {
    const key = `${symbol}:${type}`
    const now = Date.now()
    const lastTime = this.lastAlertTime.get(key)
    
    if (!lastTime || now - lastTime >= cooldownSeconds * 1000) {
      this.lastAlertTime.set(key, now)
      return true
    }
    
    return false
  }
  
  clear() {
    this.lastAlertTime.clear()
  }
}

// MODIFY: src/hooks/useBackendAlerts.ts
const cooldownManager = new AlertCooldownManager()

const handleAlert = useCallback((backendAlert: BackendAlert) => {
  const alertSettings = useStore.getState().alertSettings
  
  // Check cooldown
  if (!cooldownManager.shouldAllow(
    backendAlert.symbol, 
    backendAlert.rule_type, 
    alertSettings.alertCooldown
  )) {
    debug.log('🔇 Alert suppressed by cooldown:', backendAlert.symbol)
    return
  }
  
  const alert = transformBackendAlert(backendAlert)
  setAlerts((prev) => [alert, ...prev])
  onAlertRef.current?.(alert)
}, [transformBackendAlert])
```

**Benefits**:
- ✅ Honors existing `alertCooldown` setting
- ✅ Prevents toast spam (1 toast per minute per symbol+type)
- ✅ User-configurable (0 = disabled, 60 = 1 min, etc.)
- ✅ Still logs all alerts to history

**Drawbacks**:
- ⚠️ Discards 12 out of 13 alerts (lost in frontend)
- ⚠️ Alert History will show gaps

#### Option B: Remove Cooldown Setting

**Files to Modify**:
1. `src/types/alert.ts` - remove `alertCooldown` field
2. `src/hooks/useStore.ts` - remove from `alertSettings`
3. Any settings UI components

**Benefits**:
- ✅ Honest about functionality
- ✅ No misleading settings
- ✅ All alerts preserved

**Drawbacks**:
- ⚠️ No toast spam protection

#### Option C: Backend-Side Cooldown (Already Exists but Disabled)

**Evidence**: Backend `internal/alerts/engine.go`
```go
// Line 357-374: Deduplication DISABLED
func (e *Engine) isDuplicate(...) bool {
  return false // Always returns false
}
```

**Action**: Enable backend deduplication instead of frontend

**Benefits**:
- ✅ Single source of truth
- ✅ Consistent across all frontends
- ✅ Reduces WebSocket traffic
- ✅ Database only stores unique alerts

**Changes Required**: Backend codebase
- Enable `isDuplicate()` function
- Add configurable cooldown window (e.g., 60 seconds)
- Store last alert time per `{symbol}:{rule_type}` in Redis

**Recommendation**: **Option C (Backend Cooldown)** - most architecturally sound

---

### Phase 2: Make Toast Notifications Configurable 🔕

**Goal**: Add granular control over toast behavior

#### Changes Required:

**1. Extend AlertSettings Type**

```typescript
// src/types/alert.ts
export interface AlertSettings {
  // ... existing fields
  
  // NEW: Toast notification controls
  toastEnabled: boolean                 // Master switch for toasts
  toastAutoDismiss: boolean             // Enable/disable auto-dismiss
  toastAutoDismissAfter: number         // Seconds (0 = never)
  toastMaxVisible: number               // Max toasts on screen (1-10)
  toastPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  toastSoundEnabled: boolean            // Sound for toasts specifically
  
  // DEPRECATED (keep for backwards compat)
  autoDismissAfter: number              // Alias for toastAutoDismissAfter
  soundEnabled: boolean                 // Global sound (used by other components)
}
```

**2. Update AlertNotificationContainer**

```typescript
// src/components/alerts/AlertNotification.tsx
export function AlertNotificationContainer() {
  const { activeAlerts, alertSettings, dismissAlert } = useStore()
  
  // NEW: Check toast-specific enable flag
  if (!alertSettings.toastEnabled) return null
  
  // NEW: Use configurable max visible
  const visibleAlerts = activeAlerts.slice(-alertSettings.toastMaxVisible)
  
  // NEW: Use configurable position
  const positionClasses = {
    'top-right': 'top-0 right-0',
    'top-left': 'top-0 left-0',
    'bottom-right': 'bottom-0 right-0',
    'bottom-left': 'bottom-0 left-0',
  }[alertSettings.toastPosition]
  
  return (
    <div className={`fixed ${positionClasses} ...`}>
      {visibleAlerts.map((alert) => (
        <AlertNotificationToast
          key={alert.id}
          alert={alert}
          onDismiss={dismissAlert}
          autoDismissAfter={
            alertSettings.toastAutoDismiss 
              ? alertSettings.toastAutoDismissAfter 
              : 0
          }
        />
      ))}
    </div>
  )
}
```

**3. Settings UI Component**

```typescript
// NEW: src/components/settings/ToastSettings.tsx
export function ToastSettings() {
  const { alertSettings, updateAlertSettings } = useStore()
  
  return (
    <div className="space-y-4">
      <h3>Toast Notifications</h3>
      
      {/* Master Switch */}
      <Toggle
        label="Enable Toast Notifications"
        checked={alertSettings.toastEnabled}
        onChange={(enabled) => updateAlertSettings({ toastEnabled: enabled })}
        description="Show alert toasts in corner of screen"
      />
      
      {alertSettings.toastEnabled && (
        <>
          {/* Auto-dismiss */}
          <Toggle
            label="Auto-dismiss Toasts"
            checked={alertSettings.toastAutoDismiss}
            onChange={(enabled) => updateAlertSettings({ toastAutoDismiss: enabled })}
          />
          
          {alertSettings.toastAutoDismiss && (
            <Slider
              label="Auto-dismiss After (seconds)"
              value={alertSettings.toastAutoDismissAfter}
              min={5}
              max={120}
              step={5}
              onChange={(value) => updateAlertSettings({ toastAutoDismissAfter: value })}
            />
          )}
          
          {/* Max visible */}
          <Slider
            label="Maximum Visible Toasts"
            value={alertSettings.toastMaxVisible}
            min={1}
            max={10}
            onChange={(value) => updateAlertSettings({ toastMaxVisible: value })}
          />
          
          {/* Position */}
          <Select
            label="Toast Position"
            value={alertSettings.toastPosition}
            options={[
              { value: 'top-right', label: 'Top Right' },
              { value: 'top-left', label: 'Top Left' },
              { value: 'bottom-right', label: 'Bottom Right' },
              { value: 'bottom-left', label: 'Bottom Left' },
            ]}
            onChange={(value) => updateAlertSettings({ toastPosition: value })}
          />
          
          {/* Sound */}
          <Toggle
            label="Toast Sound"
            checked={alertSettings.toastSoundEnabled}
            onChange={(enabled) => updateAlertSettings({ toastSoundEnabled: enabled })}
          />
        </>
      )}
    </div>
  )
}
```

**Benefits**:
- ✅ User can disable toasts completely
- ✅ Configurable auto-dismiss behavior
- ✅ Adjustable max visible count
- ✅ Flexible positioning
- ✅ Backwards compatible with existing settings

---

### Phase 3: Remove Toast UI Completely 🗑️

**Goal**: Remove toast notifications entirely, rely on other visualizations

#### Option A: Complete Removal

**Files to Delete**:
1. ❌ `src/components/alerts/AlertNotification.tsx` (370 lines)

**Files to Modify**:
1. `src/components/alerts/index.ts` - remove exports
2. `src/App.tsx` - remove `<AlertNotificationContainer />` import/usage (line 84)
3. `src/hooks/useStore.ts` - remove `activeAlerts` array (optional)
4. `src/types/alert.ts` - remove toast-related fields from `AlertSettings`

**Changes**:

```typescript
// src/App.tsx
// REMOVE:
import { AlertNotificationContainer } from '@/components/alerts'

// REMOVE from JSX:
<AlertNotificationContainer />

// src/hooks/useStore.ts
// REMOVE or KEEP for other uses:
activeAlerts: [] as Alert[],

// If keeping, comment out usage:
addAlert: (alert) => {
  // alertHistory.addToHistory(alert) // Still save to history
  // set((state) => ({ activeAlerts: [...state.activeAlerts, alert] })) // Don't add to activeAlerts
}

// src/types/alert.ts - REMOVE toast fields:
export interface AlertSettings {
  enabled: boolean
  // soundEnabled: boolean  // Keep for other alert sounds
  // notificationEnabled: boolean  // REMOVE or rename
  browserNotificationEnabled: boolean
  webhookEnabled: boolean
  // ... other fields, REMOVE toast-specific ones
}
```

**Benefits**:
- ✅ Cleaner UI - no toast clutter
- ✅ Users rely on Alert Heatmap Timeline (comprehensive view)
- ✅ Reduced code complexity (~370 lines removed)
- ✅ No toast spam issues

**Drawbacks**:
- ⚠️ No real-time visual notification (unless browser notifications enabled)
- ⚠️ Users must check Alert Timeline manually
- ⚠️ Breaking change for users who like toasts

#### Option B: Soft Removal (Disable by Default)

**Changes**:
```typescript
// src/hooks/useStore.ts
alertSettings: {
  // ... other settings
  notificationEnabled: false,  // Already disabled by default ✅
  toastEnabled: false,         // NEW: Explicit toast disable (if implementing Phase 2)
}
```

**Benefits**:
- ✅ Toasts hidden by default
- ✅ Advanced users can re-enable in settings
- ✅ No breaking changes
- ✅ Code remains for those who want it

**Drawbacks**:
- ⚠️ Code maintenance burden
- ⚠️ Clutters codebase

**Recommendation**: **Option B (Disable by Default)** - less risky

#### Option C: Replace with Subtle Indicator

**Concept**: Instead of toasts, show subtle badge/indicator

```typescript
// NEW: src/components/alerts/AlertIndicator.tsx
export function AlertIndicator() {
  const activeAlerts = useStore((state) => state.activeAlerts)
  const recentAlerts = activeAlerts.filter(
    a => Date.now() - a.timestamp < 60000 // Last minute
  )
  
  if (recentAlerts.length === 0) return null
  
  return (
    <div className="fixed top-4 right-4 z-40">
      <div className="flex items-center gap-2 bg-red-500/90 text-white px-3 py-2 rounded-lg shadow-lg">
        <span className="animate-pulse">🔔</span>
        <span className="font-semibold">{recentAlerts.length} new alerts</span>
        <button className="text-xs underline">View</button>
      </div>
    </div>
  )
}
```

**Benefits**:
- ✅ Non-intrusive notification
- ✅ Click to view Alert Timeline
- ✅ Shows count, not individual toasts
- ✅ Auto-hides after 1 minute

---

## Migration Strategy

### Recommended Phased Approach

#### Week 1: Backend Cooldown (Prerequisite)
1. Enable backend `isDuplicate()` function
2. Add configurable cooldown (default: 60s)
3. Store last alert time in Redis per `{symbol}:{rule_type}`
4. Deploy to production
5. Monitor: Alerts reduced from 13/min to 1/min ✅

#### Week 2: Frontend Cooldown Configuration (Phase 1)
1. Implement `AlertCooldownManager` utility
2. Integrate into `useBackendAlerts` hook
3. Add UI toggle in settings: "Enable Alert Cooldown (Frontend)"
4. Default: **disabled** (backend handles it)
5. Use case: Override backend cooldown if needed

#### Week 3: Toast Configuration (Phase 2)
1. Extend `AlertSettings` with toast-specific fields
2. Update `AlertNotificationContainer` to respect new settings
3. Add `ToastSettings` component to settings page
4. Default: `toastEnabled: false` (disabled by default)
5. Document in UI: "Use Alert Timeline for comprehensive alert view"

#### Week 4: Toast Removal (Phase 3 - Optional)
1. **Decision Point**: Gather user feedback on Weeks 1-3
2. If toasts unused (<5% enable rate), proceed with removal
3. Otherwise, keep disabled by default

### Rollback Plan

**If Backend Cooldown Breaks**:
- Disable backend `isDuplicate()` (set to `return false`)
- Frontend receives all 13 alerts again
- Enable frontend cooldown as fallback

**If Users Complain About No Toasts**:
- Re-enable `toastEnabled: true` by default
- Add prominent settings link in Alert Timeline
- Consider Option C (Subtle Indicator) as compromise

---

## Testing Checklist

### Backend Cooldown
- [ ] Single alert per symbol+type per minute (no duplicates)
- [ ] Alert history shows 1 record per minute (not 13)
- [ ] Redis keys expire after cooldown period
- [ ] Multiple symbols don't interfere (BTCUSDT + ETHUSDT both work)
- [ ] Backend restart preserves cooldown state (Redis persistence)

### Frontend Cooldown
- [ ] WebSocket receives 13 alerts, but only 1 shown
- [ ] Cooldown timer resets correctly
- [ ] Settings toggle works (enable/disable)
- [ ] Clear button resets cooldown manager
- [ ] Multiple browser tabs share cooldown state (if localStorage-backed)

### Toast Configuration
- [ ] Disable toasts completely (`toastEnabled: false`)
- [ ] Auto-dismiss works with custom timing
- [ ] Max visible limit enforced (1-10 toasts)
- [ ] Position changes apply immediately
- [ ] Sound toggle works independently
- [ ] Settings persist across page reloads

### Toast Removal
- [ ] No console errors after removal
- [ ] Alert Timeline still receives alerts
- [ ] Alert History still populated
- [ ] TradingChart markers still appear
- [ ] Alert Heatmap Timeline shows all alerts
- [ ] Browser notifications still work (if enabled)

---

## Files Summary

### Files to Modify

**Phase 1 (Backend)**:
- `/home/yaro/fun/crypto/screener-backend/internal/alerts/engine.go`
- `/home/yaro/fun/crypto/screener-backend/pkg/redis/` (add cooldown manager)

**Phase 1 (Frontend - Option A)**:
- NEW: `src/utils/alertCooldown.ts`
- MODIFY: `src/hooks/useBackendAlerts.ts`
- MODIFY: `src/components/settings/AlertConfig.tsx` (if exists)

**Phase 2**:
- MODIFY: `src/types/alert.ts` (+toast fields)
- MODIFY: `src/hooks/useStore.ts` (default settings)
- MODIFY: `src/components/alerts/AlertNotification.tsx` (use new settings)
- NEW: `src/components/settings/ToastSettings.tsx`

**Phase 3 (Option A)**:
- DELETE: `src/components/alerts/AlertNotification.tsx`
- MODIFY: `src/components/alerts/index.ts`
- MODIFY: `src/App.tsx`
- MODIFY: `src/hooks/useStore.ts`
- MODIFY: `src/types/alert.ts`

**Phase 3 (Option C)**:
- NEW: `src/components/alerts/AlertIndicator.tsx`
- MODIFY: `src/App.tsx` (replace toast with indicator)

### Estimated Effort

- **Backend Cooldown**: 4 hours (implement + test)
- **Frontend Cooldown**: 2 hours (if needed)
- **Toast Configuration**: 4 hours (UI + logic)
- **Toast Removal**: 1 hour (delete + cleanup)
- **Testing**: 4 hours (all phases)
- **Documentation**: 2 hours

**Total**: ~17 hours (~2-3 days)

---

## Recommendations

### Immediate Actions (This Week)

1. ✅ **Enable Backend Cooldown** (Option C, Phase 1)
   - Most impact with least effort
   - Reduces 13 alerts/min → 1 alert/min
   - Single source of truth
   - Benefits all frontends (web, mobile, etc.)

2. ✅ **Keep Toasts Disabled by Default** (Already Done)
   - `notificationEnabled: false` in `useStore.ts`
   - Users who want toasts can enable manually
   - Alert Heatmap Timeline is superior visualization

3. ✅ **Document Alert Visualization Options**
   - Update README with alert display methods
   - Explain why toasts are disabled
   - Guide users to Alert Timeline/Heatmap

### Future Considerations (Next Month)

4. ⏳ **Implement Toast Configuration UI** (Phase 2)
   - Give power users control
   - Low priority since toasts disabled

5. ⏳ **Monitor Toast Usage** (Analytics)
   - Track how many users enable toasts
   - If <5% adoption after 1 month → consider removal (Phase 3)

6. ⏳ **Consider Alert Indicator** (Phase 3, Option C)
   - Replace toasts with subtle badge
   - Less intrusive, still notifies users
   - Click to open Alert Timeline

### Long-Term Vision

- **Alert Timeline** = Primary UI for all alerts
- **Alert Heatmap** = Intensity view for high-frequency patterns
- **TradingChart Markers** = Contextual alerts on price action
- **Browser Notifications** = Optional real-time alerts (requires permission)
- **Toast Notifications** = Deprecated/removed

---

## Conclusion

**Current State**: 
- ❌ No frontend cooldown (misleading setting exists)
- ✅ Toasts disabled by default
- ✅ Alert Heatmap Timeline handles 13 alerts/min gracefully

**Recommended Path**:
1. Enable backend cooldown (13 → 1 alert/min)
2. Remove unused frontend `alertCooldown` setting
3. Keep toasts disabled (current state)
4. Add subtle alert indicator if needed
5. Remove toast code after 3 months if unused

**Priority**: **Backend Cooldown > Remove Setting > Toast Removal**

The Alert Heatmap Timeline (just implemented) is the **superior solution** for displaying high-frequency alerts. Toast notifications are redundant and should remain disabled.
