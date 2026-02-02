# Alert Color Picker Implementation Roadmap

**Objective**: Implement a unified alert color system with UI configuration for all alert types, ensuring consistent colors across timeline, chart, alert history, and webhooks (when implemented).

**Estimated Time**: 8-10 hours (1-2 days)

---

## Current State Analysis

### Color Locations (4 files use hardcoded colors):
1. **`AlertTimelineChart.tsx`** - Timeline dots (10 alert types)
2. **`TradingChart.tsx`** - Chart markers with arrows/circles (10 alert types + purple override for hunters)
3. **`AlertBadges.tsx`** - Alert history badges (10 alert types)
4. **Webhooks**: Not yet implemented in frontend (exists in `/screener` repo)

### Current Color Scheme:
```typescript
{
  // Bullish (Green spectrum)
  futures_big_bull_60: '#14532d',      // Dark Green
  futures_pioneer_bull: '#a7f3d0',     // Light Teal
  futures_5_big_bull: '#84cc16',       // Lime Green
  futures_15_big_bull: '#16a34a',      // Medium Green
  futures_bottom_hunter: '#a855f7',    // Purple
  
  // Bearish (Red spectrum)
  futures_big_bear_60: '#7f1d1d',      // Dark Red
  futures_pioneer_bear: '#fce7f3',     // Light Pink
  futures_5_big_bear: '#f87171',       // Light Red
  futures_15_big_bear: '#dc2626',      // Medium Red
  futures_top_hunter: '#a855f7',       // Purple
}
```

---

## Phase 1: Type System & Constants (1-1.5 hours)

### 1.1 Create Alert Color Types
**File**: `src/types/alertColors.ts` (NEW)

```typescript
import type { FuturesAlertType } from './alert'

export interface AlertColorConfig {
  futures_big_bull_60: string
  futures_pioneer_bull: string
  futures_5_big_bull: string
  futures_15_big_bull: string
  futures_bottom_hunter: string
  futures_big_bear_60: string
  futures_pioneer_bear: string
  futures_5_big_bear: string
  futures_15_big_bear: string
  futures_top_hunter: string
}

export type AlertColorKey = keyof AlertColorConfig

export const DEFAULT_ALERT_COLORS: AlertColorConfig = {
  // Bullish
  futures_big_bull_60: '#14532d',
  futures_pioneer_bull: '#a7f3d0',
  futures_5_big_bull: '#84cc16',
  futures_15_big_bull: '#16a34a',
  futures_bottom_hunter: '#a855f7',
  
  // Bearish
  futures_big_bear_60: '#7f1d1d',
  futures_pioneer_bear: '#fce7f3',
  futures_5_big_bear: '#f87171',
  futures_15_big_bear: '#dc2626',
  futures_top_hunter: '#a855f7',
}

export const ALERT_COLOR_CATEGORIES = {
  bullish: [
    'futures_big_bull_60',
    'futures_15_big_bull',
    'futures_5_big_bull',
    'futures_pioneer_bull',
  ] as const,
  bearish: [
    'futures_big_bear_60',
    'futures_15_big_bear',
    'futures_5_big_bear',
    'futures_pioneer_bear',
  ] as const,
  hunter: [
    'futures_bottom_hunter',
    'futures_top_hunter',
  ] as const,
}

// Utility: Convert hex to Discord decimal color
export function hexToDiscordColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

// Utility: Validate hex color
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

// Utility: Get human-readable label for alert type
export function getAlertColorLabel(alertType: AlertColorKey): string {
  const labels: Record<AlertColorKey, string> = {
    futures_big_bull_60: '60 Big Bull',
    futures_pioneer_bull: 'Pioneer Bull',
    futures_5_big_bull: '5 Big Bull',
    futures_15_big_bull: '15 Big Bull',
    futures_bottom_hunter: 'Bottom Hunter',
    futures_big_bear_60: '60 Big Bear',
    futures_pioneer_bear: 'Pioneer Bear',
    futures_5_big_bear: '5 Big Bear',
    futures_15_big_bear: '15 Big Bear',
    futures_top_hunter: 'Top Hunter',
  }
  return labels[alertType]
}
```

**Checklist**:
- [ ] Create `src/types/alertColors.ts`
- [ ] Define `AlertColorConfig` interface
- [ ] Export `DEFAULT_ALERT_COLORS` constant
- [ ] Add helper functions (hex conversion, validation, labels)
- [ ] Export from `src/types/index.ts`

---

## Phase 2: Store Integration (1 hour)

### 2.1 Update AppConfig Type
**File**: `src/types/config.ts`

```typescript
import type { AlertColorConfig } from './alertColors'

export interface AppConfig {
  // ... existing fields
  
  // Alert color customization
  alertColors?: AlertColorConfig // Optional for backward compatibility
}
```

### 2.2 Update Zustand Store
**File**: `src/hooks/useStore.ts`

```typescript
import { DEFAULT_ALERT_COLORS, type AlertColorConfig } from '@/types/alertColors'

interface AppState {
  // ... existing fields
  alertColors: AlertColorConfig
  
  // ... existing actions
  updateAlertColors: (colors: Partial<AlertColorConfig>) => void
  resetAlertColors: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // ... existing state
      alertColors: DEFAULT_ALERT_COLORS,
      
      // ... existing actions
      updateAlertColors: (colors) =>
        set((state) => ({
          alertColors: { ...state.alertColors, ...colors },
        })),
      
      resetAlertColors: () =>
        set({ alertColors: DEFAULT_ALERT_COLORS }),
    }),
    {
      name: STORAGE_KEYS.CONFIG,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

**Checklist**:
- [ ] Add `alertColors` to AppConfig type
- [ ] Add `alertColors` to Zustand store state
- [ ] Implement `updateAlertColors` action
- [ ] Implement `resetAlertColors` action
- [ ] Verify localStorage persistence works

---

## Phase 3: Component Refactoring (2-2.5 hours)

### 3.1 Update AlertTimelineChart
**File**: `src/components/coin/AlertTimelineChart.tsx`

```typescript
import { useStore } from '@/hooks/useStore'

export function AlertTimelineChart({ symbol, height }: AlertTimelineChartProps) {
  const alertColors = useStore((state) => state.alertColors)
  
  // Remove hardcoded ALERT_TYPE_COLORS, use alertColors directly
  // const ALERT_TYPE_COLORS = { ... } ❌
  
  // Use alertColors from store ✅
  <div
    className="w-2.5 h-2.5 rounded-full"
    style={{ backgroundColor: alertColors[type] || '#3b82f6' }}
  />
}
```

### 3.2 Update TradingChart
**File**: `src/components/coin/TradingChart.tsx`

```typescript
import { useStore } from '@/hooks/useStore'

export function TradingChart({ data, alerts, ... }: TradingChartProps) {
  const alertColors = useStore((state) => state.alertColors)
  
  // Remove hardcoded ALERT_MARKER_COLORS
  const getAlertMarkerStyle = (alertType: string) => {
    const normalizedKey = alertType.startsWith('futures_') ? alertType : `futures_${alertType}`
    const color = alertColors[normalizedKey as AlertColorKey] || '#3b82f6'
    
    // ... rest of logic
  }
}
```

### 3.3 Update AlertBadges
**File**: `src/components/alerts/AlertBadges.tsx`

```typescript
import { useStore } from '@/hooks/useStore'

export function AlertBadges({ alertTypes, maxVisible, latestAlertType }: AlertBadgesProps) {
  const alertColors = useStore((state) => state.alertColors)
  
  const getAlertBadge = (type: CombinedAlertType, isLatest: boolean) => {
    const normalizedType = type.startsWith('futures_') ? type : `futures_${cleanType}`
    const baseColor = alertColors[normalizedType as AlertColorKey] || '#3b82f6'
    
    // ... rest of logic
  }
}
```

**Checklist**:
- [ ] Remove hardcoded `ALERT_TYPE_COLORS` from all 3 components
- [ ] Replace with `useStore` hook to get `alertColors`
- [ ] Add fallback color (`#3b82f6` blue) for unknown types
- [ ] Test that all components render correctly

---

## Phase 4: Color Picker UI Component (2-3 hours)

### 4.1 Create ColorPicker Component
**File**: `src/components/settings/ColorPicker.tsx` (NEW)

```typescript
import { useState, useRef, useEffect } from 'react'
import { isValidHexColor } from '@/types/alertColors'

interface ColorPickerProps {
  label: string
  value: string
  onChange: (color: string) => void
  showPreview?: boolean
}

export function ColorPicker({ label, value, onChange, showPreview = true }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isValid, setIsValid] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleChange = (newValue: string) => {
    setInputValue(newValue)
    const valid = isValidHexColor(newValue)
    setIsValid(valid)
    if (valid) {
      onChange(newValue)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {showPreview && (
        <div
          className="h-8 w-8 rounded border-2 border-gray-600 shadow-sm"
          style={{ backgroundColor: isValid ? inputValue : '#888' }}
        />
      )}
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {label}
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="#14532d"
            className={`font-mono text-sm px-3 py-1.5 rounded border bg-gray-800 text-gray-100 ${
              isValid ? 'border-gray-600' : 'border-red-500'
            }`}
            maxLength={7}
          />
          <input
            type="color"
            value={isValid ? inputValue : '#888888'}
            onChange={(e) => handleChange(e.target.value)}
            className="h-9 w-16 cursor-pointer rounded border border-gray-600"
          />
        </div>
        {!isValid && (
          <p className="text-xs text-red-400 mt-1">Invalid hex color</p>
        )}
      </div>
    </div>
  )
}
```

### 4.2 Create AlertColorSettings Component
**File**: `src/components/settings/AlertColorSettings.tsx` (NEW)

```typescript
import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { ColorPicker } from './ColorPicker'
import { Button } from '@/components/ui'
import { 
  DEFAULT_ALERT_COLORS, 
  ALERT_COLOR_CATEGORIES,
  getAlertColorLabel,
  hexToDiscordColor,
  type AlertColorKey 
} from '@/types/alertColors'

export function AlertColorSettings() {
  const alertColors = useStore((state) => state.alertColors)
  const updateAlertColors = useStore((state) => state.updateAlertColors)
  const resetAlertColors = useStore((state) => state.resetAlertColors)
  const [expandedCategory, setExpandedCategory] = useState<'bullish' | 'bearish' | 'hunter' | null>('bullish')

  const handleColorChange = (alertType: AlertColorKey, color: string) => {
    updateAlertColors({ [alertType]: color })
  }

  const handleResetAll = () => {
    if (confirm('Reset all alert colors to defaults?')) {
      resetAlertColors()
    }
  }

  const renderColorGroup = (
    title: string,
    category: keyof typeof ALERT_COLOR_CATEGORIES,
    emoji: string
  ) => {
    const isExpanded = expandedCategory === category
    const alertTypes = ALERT_COLOR_CATEGORIES[category]

    return (
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setExpandedCategory(isExpanded ? null : category)}
          className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-750 flex items-center justify-between"
        >
          <span className="font-semibold text-gray-200">
            {emoji} {title}
          </span>
          <span className="text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </span>
        </button>
        
        {isExpanded && (
          <div className="p-4 space-y-4 bg-gray-900/50">
            {alertTypes.map((alertType) => (
              <ColorPicker
                key={alertType}
                label={getAlertColorLabel(alertType)}
                value={alertColors[alertType]}
                onChange={(color) => handleColorChange(alertType, color)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Alert Colors</h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleResetAll}
        >
          Reset All
        </Button>
      </div>

      <p className="text-sm text-gray-400">
        Customize alert colors used in timeline, charts, and history.
      </p>

      <div className="space-y-3">
        {renderColorGroup('Bullish Alerts', 'bullish', '🐂')}
        {renderColorGroup('Bearish Alerts', 'bearish', '🐻')}
        {renderColorGroup('Hunter Alerts', 'hunter', '🎣')}
      </div>

      {/* Discord Preview (optional) */}
      <div className="mt-6 p-4 bg-gray-800 rounded border border-gray-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Discord Colors (Decimal)</h4>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div>Bull: {hexToDiscordColor(alertColors.futures_15_big_bull)}</div>
          <div>Bear: {hexToDiscordColor(alertColors.futures_15_big_bear)}</div>
          <div>Hunter: {hexToDiscordColor(alertColors.futures_bottom_hunter)}</div>
        </div>
      </div>
    </div>
  )
}
```

**Checklist**:
- [ ] Create `ColorPicker.tsx` with text input + native color picker
- [ ] Add validation for hex colors
- [ ] Create `AlertColorSettings.tsx` with grouped sections
- [ ] Implement expand/collapse for each category
- [ ] Add "Reset All" button with confirmation
- [ ] Add Discord decimal preview (for future webhook use)

---

## Phase 5: Settings Modal Integration (1 hour)

### 5.1 Add Tab to SettingsModal
**File**: `src/components/settings/SettingsModal.tsx`

```typescript
import { AlertColorSettings } from './AlertColorSettings'

type SettingsTab = 'general' | 'display' | 'alerts' | 'colors' | 'advanced'

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'display', label: 'Display', icon: '🎨' },
    { id: 'alerts', label: 'Alerts', icon: '🔔' },
    { id: 'colors', label: 'Colors', icon: '🎨' },  // NEW TAB
    { id: 'advanced', label: 'Advanced', icon: '🔧' },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded ${
              activeTab === tab.id ? 'bg-accent text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'colors' && <AlertColorSettings />}
      {/* ... other tabs */}
    </Modal>
  )
}
```

**Checklist**:
- [ ] Add 'colors' tab to SettingsModal
- [ ] Import and render `AlertColorSettings` component
- [ ] Test tab navigation works
- [ ] Ensure modal scrolling works with color picker

---

## Phase 6: Testing & Validation (1-1.5 hours)

### 6.1 Manual Testing Checklist
- [ ] Change bull color → verify timeline dots update
- [ ] Change bear color → verify chart markers update
- [ ] Change hunter color → verify badges update
- [ ] Test all 10 alert types update correctly
- [ ] Verify invalid hex colors show error
- [ ] Test "Reset All" button restores defaults
- [ ] Verify colors persist after page refresh
- [ ] Test expand/collapse animation smooth
- [ ] Check native color picker works on Chrome/Firefox/Safari

### 6.2 Edge Cases
- [ ] Test with very light colors (white, yellow) - ensure text readable
- [ ] Test with very dark colors (black) - ensure visible on dark bg
- [ ] Test localStorage quota (10 colors × 7 chars = 70 bytes - negligible)
- [ ] Test migration from old localStorage without `alertColors` field

### 6.3 Responsive Design
- [ ] Mobile: Color pickers stack vertically
- [ ] Tablet: Settings modal width appropriate
- [ ] Desktop: Settings modal max-width constrained

---

## Phase 7: Documentation & Future Prep (1 hour)

### 7.1 Update Documentation
**File**: `docs/DESIGN_SYSTEM.md`

```markdown
## Alert Colors

Alert colors are user-configurable and stored in localStorage. Default values:

- **Bullish Alerts** (Green spectrum): Dark → Light
  - 60 Big Bull: `#14532d`
  - 15 Big Bull: `#16a34a`
  - 5 Big Bull: `#84cc16`
  - Pioneer Bull: `#a7f3d0`

- **Bearish Alerts** (Red spectrum): Dark → Light
  - 60 Big Bear: `#7f1d1d`
  - 15 Big Bear: `#dc2626`
  - 5 Big Bear: `#f87171`
  - Pioneer Bear: `#fce7f3`

- **Hunter Alerts**: Purple
  - Bottom/Top Hunter: `#a855f7`

### Customization
Users can customize colors via Settings → Colors tab. Changes apply to:
- Timeline chart dots
- Trading chart markers
- Alert history badges
- Webhook embeds (when implemented)
```

### 7.2 Add Webhook Color Support (Future)
**File**: `src/services/webhookService.ts` (when implemented)

```typescript
import { useStore } from '@/hooks/useStore'
import { hexToDiscordColor } from '@/types/alertColors'

export async function sendDiscordAlert(alert: Alert) {
  const alertColors = useStore.getState().alertColors
  const hexColor = alertColors[alert.type as AlertColorKey]
  const discordColor = hexToDiscordColor(hexColor)
  
  const embed = {
    color: discordColor,
    title: `${alert.symbol} - ${alert.type}`,
    // ... rest of embed
  }
  
  await fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify({ embeds: [embed] })
  })
}
```

**Checklist**:
- [ ] Update `DESIGN_SYSTEM.md` with color documentation
- [ ] Add comments in code explaining color system
- [ ] Create helper for webhook color conversion (for future Phase 4 of watchlist roadmap)

---

## Phase 8: Polish & Optimization (1 hour)

### 8.1 Performance Optimization
- [ ] Memoize color lookups if needed (unlikely with 10 colors)
- [ ] Debounce color changes to avoid excessive re-renders (300ms delay)
- [ ] Use CSS variables instead of inline styles (optional, more complex)

### 8.2 UX Improvements
- [ ] Add tooltips to color pickers explaining usage
- [ ] Show preview of how color looks on dark background
- [ ] Add "Copy color" button next to each picker
- [ ] Add keyboard shortcuts (Cmd+R to reset)

### 8.3 Accessibility
- [ ] Ensure color pickers have proper labels for screen readers
- [ ] Add color contrast warnings for very light/dark colors
- [ ] Test with high contrast mode

**Checklist**:
- [ ] Add tooltips to explain color usage
- [ ] Add color preview on dark background
- [ ] Test keyboard navigation in settings modal
- [ ] Verify WCAG AA contrast ratios for text on colored backgrounds

---

## Implementation Order

**Week 1 (8-10 hours)**:
1. **Day 1 Morning** (3-4 hours): Phases 1-2 (Types + Store)
2. **Day 1 Afternoon** (2-3 hours): Phase 3 (Component Refactoring)
3. **Day 2 Morning** (2-3 hours): Phase 4 (Color Picker UI)
4. **Day 2 Afternoon** (2-3 hours): Phases 5-8 (Integration + Testing + Polish)

---

## Success Criteria

✅ All 10 alert types have configurable colors  
✅ Colors persist across page refreshes  
✅ Colors update in real-time across all components  
✅ Settings UI is intuitive and responsive  
✅ Reset button works correctly  
✅ Invalid colors are rejected with clear error messages  
✅ Discord/Telegram webhook colors use same config (when implemented)  
✅ Zero breaking changes to existing functionality  

---

## Future Enhancements (Post-MVP)

- **Color Themes**: Pre-defined color schemes (Classic, Pastel, High Contrast)
- **Export/Import**: Share color configs via JSON
- **Per-Alert Brightness**: Adjust opacity for less important alerts
- **Gradient Backgrounds**: Animated gradients for hunter alerts
- **Color Accessibility**: Auto-suggest WCAG-compliant alternatives
- **Sync to Backend**: Save colors to Supabase for cross-device sync

---

## Related Roadmaps

- **USER_WATCHLIST_WEBHOOK_ROADMAP.md** - Phase 4 (Webhook Execution) will use these colors
- **DESIGN_SYSTEM.md** - Color system documentation
- **STATE.md** - Phase 7+ enhancement tracking

---

**Last Updated**: February 2, 2026  
**Status**: Planning Phase  
**Owner**: Frontend Team
