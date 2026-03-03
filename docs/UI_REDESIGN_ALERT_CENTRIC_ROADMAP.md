# UI Redesign Roadmap - Alert History Centric Layout

**Created**: January 8, 2026  
**Target**: Phase 8 (Post-Testing)  
**Estimated Duration**: 3-4 weeks  
**Status**: Planning

---

## Executive Summary

**Current Pain Points:**
- Alert history is buried in a modal/dropdown (not prominent enough)
- CoinModal duplicates data that could be in a persistent side panel
- Chart and Alert Timeline only visible after clicking a coin
- Alert/Webhook configuration takes up valuable sidebar space
- Watchlist vs Main alerts not clearly separated visually

**Proposed Solution:**
Transform the app into an **Alert History Centric** layout where:
1. **Alert History Table** is the main content (replaces coin table priority)
2. **Watchlist alerts** always on top, visually separated from main alerts
3. **Chart + Alert Timeline** persistently visible at top (tracks selected coin)
4. **Right Side Panel** shows coin details (24h stats, Fib pivots, external tools)
5. **Settings Modal** houses Alert Config and Webhook Manager
6. Remove CoinModal entirely (data moved to side panel)

**Benefits:**
- Alert history becomes first-class citizen (matches user priority)
- Chart always visible (no clicking needed)
- Better use of screen real estate
- Clear visual separation of watchlist vs main alerts
- Cleaner, more focused interface

---

## Architecture Changes

### Current Layout Structure
```
<Layout>
  ├── LeftSidebar (Filters & Controls)
  │   ├── MarketSummary
  │   ├── WatchlistSelector
  │   └── LiveStatusBadge
  ├── MainContent
  │   ├── ViewToggle (Coins | Alerts)
  │   ├── SearchBar
  │   ├── CoinTable OR AlertHistoryTable (conditional)
  │   └── CoinModal (overlay)
  └── RightSidebar (Alert Configuration)
      ├── AlertConfig
      └── WebhookManager
```

### Proposed Layout Structure
```
<Layout>
  ├── LeftSidebar (Filters & Controls) [UNCHANGED]
  │   ├── MarketSummary
  │   ├── WatchlistSelector
  │   └── LiveStatusBadge
  ├── MainContent [MAJOR CHANGES]
  │   ├── ChartSection [NEW - PERSISTENT]
  │   │   ├── TradingChart (selected coin)
  │   │   └── AlertTimelineChart (selected coin)
  │   ├── SearchBar
  │   └── AlertHistoryTable [NEW LAYOUT]
  │       ├── WatchlistAlerts (top section)
  │       ├── Divider (visual separator)
  │       └── MainAlerts (bottom section)
  └── RightSidebar (Coin Details) [REPURPOSED]
      ├── CoinHeader (symbol, price, 24h change)
      ├── TechnicalIndicators (VCP, Fibonacci)
      ├── 24hStatistics (high, low, volume)
      └── ExternalLinks (CoinGlass, Aggr, Binance, TradingView)
```

**Key Differences:**
- `ViewToggle` removed (only one view now)
- `CoinTable` removed (focus on alert history)
- `CoinModal` removed (data moved to side panel)
- `AlertConfig` moved to settings modal
- Chart section always visible at top

---

## Mobile Experience Plan (≤768px)

**Goals:** keep alerts first-class, reduce horizontal scroll, and make chart/details reachable without long scrolls.

**Layout Strategy:**
- Replace tables with compact cards: primary line (symbol, price, change badge), secondary line (alert types, last alert, watchlist star). Expand-on-tap shows full metrics (P/WA, volume, VCP badge, alert list).
- Bottom sheet chart: tap on a card opens a slide-up chart/details sheet; swipe down or tap dimmer to close. Keeps list context visible.
- Condensed chrome: shrink header/footer padding and typography; collapse settings/theme/auth into a single icon cluster or kebab.
- Sticky filters: tab bar (Coins | Alerts) + horizontal pill filters (sentiment or alert type) under the header; search input with shorter placeholder and clear button.
- Column prioritization: hide low-priority fields on phones; merge metrics into secondary text; rely on badges/pills instead of columns.
- Touch targets: enforce 44px min height, generous row padding, and larger tap zones for watchlist stars and clear buttons.

**Phased Implementation:**
1) Mobile-only card view for CoinTable and AlertHistoryTable (keep desktop tables intact). Add feature flag for QA.
2) Bottom sheet for ChartSection + CoinDetails on mobile, preserving existing desktop grid.
3) Header/Footer compaction + sticky tab/filter row + refined spacing.
4) Interaction polish: swipe-to-favorite, focus outline, and reduced motion toggle.

**Acceptance Criteria:**
- No horizontal scrolling required for primary info on ≤768px.
- Chart/details accessible within one tap from any alert card.
- Table layout unchanged on ≥1024px.
- Lighthouse Mobile TTI unchanged or better; CLS < 0.1 on mobile.

---

## Phase Breakdown

### Phase 8.1: Component Refactoring (Week 1)

**Goal**: Prepare existing components for new layout without breaking current UI

#### Task 8.1.1: Extract Chart Section Component
**Files to Create:**
- `src/components/coin/ChartSection.tsx` (new wrapper)

**Requirements:**
- Wrap `TradingChart` + `AlertTimelineChart` in unified container
- Accept `selectedCoin` prop (Coin | null)
- Show placeholder state when no coin selected
- Responsive height (300px on mobile, 400px on desktop)
- Smooth transition when coin changes

**Implementation:**
```tsx
interface ChartSectionProps {
  selectedCoin: Coin | null
  onClose?: () => void // Optional deselect button
}

export function ChartSection({ selectedCoin, onClose }: ChartSectionProps) {
  // Fetch chart data when selectedCoin changes
  // Show both TradingChart and AlertTimelineChart
  // Display empty state when no coin selected
}
```

#### Task 8.1.2: Redesign AlertHistoryTable
**Files to Modify:**
- `src/components/alerts/AlertHistoryTable.tsx`

**Requirements:**
- Split data into two sections: watchlist alerts (top) and main alerts (bottom)
- Add visual separator (horizontal line + spacing)
- Watchlist section header: "Watchlist Alerts" badge
- Main section header: "All Alerts" badge
- Click handler to select coin (updates ChartSection + RightSidebar)
- Highlight selected row

**Data Flow:**
```tsx
interface AlertHistoryTableProps {
  stats: AlertStat[] // All alerts
  selectedSymbol?: string // Currently selected
  onAlertClick: (symbol: string, alert: AlertStat) => void
  onClearHistory: () => void
}

// Internal logic:
// 1. Filter stats into watchlistAlerts and mainAlerts
// 2. Render watchlist section first
// 3. Render divider
// 4. Render main alerts section
```

#### Task 8.1.3: Create Coin Details Side Panel
**Files to Create:**
- `src/components/coin/CoinDetailsPanel.tsx` (new)

**Requirements:**
- Extract content from `src/components/coin/CoinModal.tsx`:
  - Coin header (symbol, price, 24h change badge)
  - TechnicalIndicators component (already exists)
  - 24h Statistics (high, low, volume, quote volume)
  - ExternalLinks component (already exists)
- Scrollable when content overflows
- Sticky header
- Empty state when no coin selected

**Component Structure:**
```tsx
interface CoinDetailsPanelProps {
  coin: Coin | null
  onClose?: () => void // Optional deselect
}

export function CoinDetailsPanel({ coin, onClose }: CoinDetailsPanelProps) {
  if (!coin) return <EmptyState message="Select a coin to view details" />
  
  return (
    <div className="h-full overflow-y-auto">
      <CoinHeader coin={coin} onClose={onClose} />
      <div className="space-y-6 p-4">
        <Statistics24h coin={coin} />
        <TechnicalIndicators coin={coin} />
        <ExternalLinks coin={coin} />
      </div>
    </div>
  )
}
```

#### Task 8.1.4: Create Settings Modal
**Files to Create:**
- `src/components/settings/SettingsModal.tsx` (new)
- `src/components/settings/SettingsButton.tsx` (new - Header trigger)

**Requirements:**
- Modal dialog (similar to existing modals)
- Tabbed interface: "Alert Rules" | "Webhooks" | "General"
- Move `AlertConfig` component into "Alert Rules" tab
- Move `WebhookManager` into "Webhooks" tab
- Add "General" tab for future settings (theme, language, etc.)
- Keyboard shortcut: `Cmd/Ctrl + ,` to open

**Implementation:**
```tsx
interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'alerts' | 'webhooks' | 'general'
}

export function SettingsModal({ isOpen, onClose, initialTab }: SettingsModalProps) {
  // Render tabs + content
  // Tab 1: <AlertConfig />
  // Tab 2: <WebhookManager />
  // Tab 3: <GeneralSettings /> (placeholder)
}
```

---

### Phase 8.2: Layout Integration (Week 2)

**Goal**: Wire new components into `src/App.tsx` without breaking functionality

#### Task 8.2.1: Update `src/App.tsx` State Management
**File**: `src/App.tsx`

**Changes Required:**
1. Remove `activeView` state (no more view toggle)
2. Add `selectedAlert` state (for tracking clicked alert)
3. Update `selectedCoin` logic to accept symbol from alert click
4. Add `isSettingsOpen` state for modal

**State Changes:**
```tsx
// REMOVE:
const activeView = useStore((state) => state.activeView)
const setActiveView = useStore((state) => state.setActiveView)

// ADD:
const [selectedAlert, setSelectedAlert] = useState<AlertStat | null>(null)
const [isSettingsOpen, setIsSettingsOpen] = useState(false)

// MODIFY:
// selectedCoin can now be set from alert click (find by symbol)
const handleAlertClick = (symbol: string, alert: AlertStat) => {
  const coin = coins?.find(c => c.symbol === symbol)
  if (coin) {
    setSelectedCoin(coin)
    setSelectedAlert(alert)
  }
}
```

#### Task 8.2.2: Rebuild Main Content Section
**File**: `src/App.tsx`

**Layout Changes:**
```tsx
<Layout>
  {/* Left Sidebar - UNCHANGED */}
  <LeftSidebar>...</LeftSidebar>

  {/* Main Content - NEW STRUCTURE */}
  <MainContent>
    {/* Chart Section - Always Visible */}
    <ChartSection 
      selectedCoin={selectedCoin}
      onClose={() => {
        setSelectedCoin(null)
        setSelectedAlert(null)
      }}
    />
    
    {/* Search Bar */}
    <SearchBar ref={searchInputRef} onSearch={setSearchQuery} />
    
    {/* Alert History Table - ONLY VIEW */}
    <AlertHistoryTable
      stats={filteredAlertStats}
      selectedSymbol={selectedCoin?.symbol}
      onAlertClick={handleAlertClick}
      onClearHistory={handleClearHistory}
    />
  </MainContent>

  {/* Right Sidebar - REPURPOSED */}
  <RightSidebar title="Coin Details">
    <CoinDetailsPanel 
      coin={selectedCoin}
      onClose={() => setSelectedCoin(null)}
    />
  </RightSidebar>
</Layout>
```

#### Task 8.2.3: Update Sidebar Components
**Files to Modify:**
- `src/components/layout/Sidebar.tsx` (update titles)
- `src/components/layout/Header.tsx` (add settings button)

**Header Changes:**
```tsx
// Add settings button next to user menu
<div className="flex items-center gap-3">
  <SettingsButton onClick={() => setIsSettingsOpen(true)} />
  <UserMenu />
</div>
```

#### Task 8.2.4: Remove Deprecated Components
**Files to Delete:**
- `src/components/controls/ViewToggle.tsx` (no longer needed)
- `src/components/coin/CoinTable.tsx` (if not used elsewhere)
- `src/components/coin/CoinModal.tsx` (replaced by side panel)

**Files to Update:**
- Remove ViewToggle imports from `src/App.tsx`
- Remove CoinModal imports and lazy loading
- Update barrel exports in `src/components/*/index.ts`

---

### Phase 8.3: Alert History Enhancements (Week 3)

**Goal**: Improve alert history UX with new layout advantages

#### Task 8.3.1: Implement Visual Separation
**File**: `src/components/alerts/AlertHistoryTable.tsx`

**Requirements:**
- Sticky section headers (stay visible during scroll)
- Different background colors for watchlist vs main sections
- Badge counts for each section
- Collapsible sections (optional - user preference)

**Implementation:**
```tsx
// Watchlist section - green accent
<div className="bg-green-900/10 border-l-4 border-green-500">
  <div className="sticky top-0 bg-gray-900 px-4 py-2 flex justify-between">
    <Badge variant="success">
      Watchlist Alerts ({watchlistAlerts.length})
    </Badge>
    <Button size="sm" onClick={toggleWatchlistSection}>
      {watchlistCollapsed ? 'Expand' : 'Collapse'}
    </Button>
  </div>
  {!watchlistCollapsed && <AlertRows alerts={watchlistAlerts} />}
</div>

{/* Divider */}
<div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent my-4" />

// Main section - blue accent
<div className="bg-blue-900/10 border-l-4 border-blue-500">
  <div className="sticky top-0 bg-gray-900 px-4 py-2">
    <Badge variant="info">
      All Alerts ({mainAlerts.length})
    </Badge>
  </div>
  <AlertRows alerts={mainAlerts} />
</div>
```

#### Task 8.3.2: Add Inline Actions
**File**: `src/components/alerts/AlertHistoryTable.tsx`

**Requirements:**
- Quick actions on hover/selection:
  - "View Chart" (select coin)
  - "Add to Watchlist" (if not in watchlist)
  - "Create Alert Rule" (pre-fill from this alert)
  - "Dismiss" (remove from history)
- Keyboard shortcuts: `Enter` to select, `D` to dismiss

#### Task 8.3.3: Enhanced Filtering
**File**: `src/components/alerts/AlertHistory.tsx` or embedded in table

**Requirements:**
- Filter by source: All | Watchlist Only | Main Only (tabs)
- Filter by severity: All | Critical | High | Medium | Low
- Filter by timeframe: 1h | 24h | 7d | 30d | All
- Filter by alert type: All | Bulls | Bears | Hunters | Custom
- Search by symbol (existing)

**UI Location:**
- Toolbar above table (below search bar)
- Chips/pills for active filters
- "Clear Filters" button

---

### Phase 8.4: Chart Integration & Sync (Week 3-4)

**Goal**: Ensure chart updates smoothly when alerts clicked

#### Task 8.4.1: Chart Data Fetching
**File**: `src/components/coin/ChartSection.tsx`

**Requirements:**
- Auto-fetch chart data when `selectedCoin` changes
- Show loading state during fetch
- Cache chart data per symbol (React Query)
- Error state if chart data fails to load
- Keep alert markers synced with alert history

**Implementation:**
```tsx
const { data: chartData, isLoading } = useQuery({
  queryKey: ['chartData', selectedCoin?.fullSymbol],
  queryFn: () => fetchChartData(selectedCoin!.fullSymbol),
  enabled: !!selectedCoin,
  staleTime: 5 * 60 * 1000, // 5 minutes
})

const { data: alertsForChart } = useQuery({
  queryKey: ['alertHistory', selectedCoin?.symbol],
  queryFn: () => alertHistory.getBySymbol(selectedCoin!.symbol),
  enabled: !!selectedCoin,
})
```

#### Task 8.4.2: Alert Timeline Highlighting
**File**: `src/components/coin/AlertTimelineChart.tsx`

**Requirements:**
- Highlight selected alert in timeline (if `selectedAlert` provided)
- Scroll timeline to show selected alert timestamp
- Draw vertical line at alert timestamp
- Tooltip shows full alert details on hover

#### Task 8.4.3: Responsive Chart Heights
**Files**: `src/components/coin/ChartSection.tsx`

**Requirements:**
- Desktop: 400px chart + 150px timeline = 550px total
- Tablet: 300px chart + 120px timeline = 420px total
- Mobile: 250px chart + 100px timeline = 350px total
- Collapsible toggle to hide timeline (more chart space)

---

### Phase 8.5: Settings Modal Implementation (Week 4)

**Goal**: Complete settings modal with all configuration options

#### Task 8.5.1: Alert Rules Tab
**File**: `src/components/settings/SettingsModal.tsx`

**Requirements:**
- Embed `<AlertConfig />` component as-is
- Add bulk actions: "Enable All" | "Disable All" | "Reset to Defaults"
- Export/Import rules as JSON
- Search/filter rules by name or type

#### Task 8.5.2: Webhooks Tab
**File**: `src/components/settings/SettingsModal.tsx`

**Requirements:**
- Embed `<WebhookManager />` component as-is
- Add webhook routing preview (show which alerts go where)
- Test all webhooks button (batch test)
- Webhook logs/history (last 10 deliveries)

#### Task 8.5.3: General Settings Tab
**File**: `src/components/settings/GeneralSettings.tsx` (new)

**Requirements:**
- Theme selector (dark/light - future)
- Language selector (EN/TR - future)
- Notification preferences:
  - Browser notifications ON/OFF
  - Sound ON/OFF
  - Sound volume slider
  - Alert cooldown duration
- Data management:
  - Clear alert history
  - Clear cache
  - Export all data
  - Import data
- About section (version, build date, links)

---

### Phase 8.6: Cleanup & Polish (Week 4)

**Goal**: Remove old code, fix bugs, polish UX

#### Task 8.6.1: Remove Unused Code
**Files to Review:**
- Delete `ViewToggle` component and references
- Delete `CoinModal` component and lazy load logic
- Remove `activeView` from Zustand store (`src/hooks/useStore.ts`)
- Clean up unused imports in `src/App.tsx`
- Update barrel exports

#### Task 8.6.2: Update Keyboard Shortcuts
**File**: `src/hooks/useKeyboardShortcuts.ts` usage in `src/App.tsx`

**Changes:**
- Remove shortcuts related to modal (Escape for modal close)
- Add `Cmd/Ctrl + ,` for settings
- Add `Cmd/Ctrl + K` for search (existing)
- Update ShortcutHelp modal with new shortcuts

#### Task 8.6.3: Responsive Design Testing
**Testing Checklist:**
- [ ] Desktop (1920x1080) - all panels visible
- [ ] Laptop (1366x768) - sidebars collapsible
- [ ] Tablet (768px) - single column, chart reduced
- [ ] Mobile (375px) - stacked layout, minimal chrome

#### Task 8.6.4: Accessibility Audit
**Requirements:**
- Keyboard navigation: Tab through all interactive elements
- Focus indicators: Visible focus states on all controls
- ARIA labels: Alert table has proper table semantics
- Color contrast: All text meets WCAG AA standards
- Screen reader: Test with VoiceOver/NVDA

#### Task 8.6.5: Performance Optimization
**Checks:**
- Memoize AlertHistoryTable row rendering
- Virtualize table if >1000 rows (react-window)
- Lazy load chart data (only when coin selected)
- Debounce search input
- Profile re-renders with React DevTools

---

## Technical Specifications

### Component File Structure (Post-Refactor)

```
src/components/
├── alerts/
│   ├── AlertHistoryTable.tsx [MODIFIED - split sections]
│   ├── AlertHistory.tsx [MODIFIED - enhanced filters]
│   ├── AlertConfig.tsx [MOVED to settings]
│   ├── WebhookManager.tsx [MOVED to settings]
│   └── ...
├── coin/
│   ├── ChartSection.tsx [NEW - wrapper]
│   ├── CoinDetailsPanel.tsx [NEW - replaces modal]
│   ├── TradingChart.tsx [UNCHANGED]
│   ├── AlertTimelineChart.tsx [MODIFIED - highlighting]
│   ├── TechnicalIndicators.tsx [UNCHANGED]
│   ├── ExternalLinks.tsx [UNCHANGED]
│   ├── CoinModal.tsx [DELETE]
│   ├── CoinTable.tsx [DELETE or DEPRECATE]
│   └── ...
├── settings/
│   ├── SettingsModal.tsx [NEW]
│   ├── SettingsButton.tsx [NEW]
│   ├── GeneralSettings.tsx [NEW]
│   └── index.ts [NEW barrel export]
├── controls/
│   ├── ViewToggle.tsx [DELETE]
│   └── ...
└── layout/
    ├── Header.tsx [MODIFIED - add settings button]
    ├── Sidebar.tsx [MODIFIED - update titles]
    └── ...
```

### State Management Changes

**Zustand Store (`src/hooks/useStore.ts`):**
```typescript
// REMOVE:
activeView: 'coins' | 'alerts'
setActiveView: (view) => void

// ADD:
isSettingsOpen: boolean
setSettingsOpen: (open: boolean) => void
selectedAlertId: string | null // Track selected alert
setSelectedAlertId: (id: string | null) => void

// KEEP:
currentWatchlistId: string | null
alertRules: AlertRule[]
alertSettings: AlertSettings
// ... all existing alert/watchlist state
```

**Local Component State (`src/App.tsx`):**
```typescript
// KEEP:
const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null)
const [searchQuery, setSearchQuery] = useState('')

// ADD:
const [selectedAlert, setSelectedAlert] = useState<AlertStat | null>(null)

// REMOVE:
// activeView (now in store as isSettingsOpen)
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     App.tsx (Main)                       │
│  - selectedCoin: Coin | null                             │
│  - selectedAlert: AlertStat | null                       │
│  - filteredAlertStats: AlertStat[]                       │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
     ┌───────▼────────┐          ┌────────▼────────┐
     │  ChartSection  │          │ AlertHistory    │
     │  - TradingChart│          │   Table         │
     │  - Timeline    │          │ - Watchlist     │
     │  [selectedCoin]│◄─────────┤ - Divider       │
     └────────────────┘          │ - Main Alerts   │
                                 │ [onAlertClick]──┼──┐
                                 └─────────────────┘  │
                                                      │
                    ┌─────────────────────────────────┘
                    │ (click alert)
                    ▼
          ┌─────────────────────┐
          │ CoinDetailsPanel    │
          │ - 24h Stats         │
          │ - Indicators        │
          │ - Fib Pivots        │
          │ - External Links    │
          │ [selectedCoin]      │
          └─────────────────────┘
```

---

## Migration Strategy

### Development Approach
1. **Feature Branch**: `feature/ui-redesign-alert-centric`
2. **Incremental Commits**: One phase at a time
3. **No Backward Compatibility**: Clean break from old UI
4. **Testing**: Manual testing after each phase + automated tests for critical flows
5. **Review Checkpoint**: After Phase 8.2 (layout integration)

### Rollback Plan
- Git tag before starting: `v7-pre-redesign`
- Keep old components in `src/components/_deprecated/` until Phase 8.6
- Emergency rollback: revert to tag if critical bugs found

### User Communication
- Document new UI in `README.md` (with screenshots)
- Add "What's New" modal on first load after update
- Keyboard shortcuts help updated
- Video tutorial (optional)

---

## Testing Checklist

### Functional Tests
- [ ] Alert history table loads with correct data
- [ ] Watchlist alerts appear above main alerts
- [ ] Visual divider is present and styled correctly
- [ ] Clicking alert selects coin and updates chart
- [ ] Right sidebar shows coin details for selected coin
- [ ] Chart updates when different alert clicked
- [ ] Settings modal opens/closes correctly
- [ ] Alert config in settings works (enable/disable rules)
- [ ] Webhook manager in settings works (add/edit/test)
- [ ] Search filters alert history correctly
- [ ] Filters (severity, timeframe, type) work correctly
- [ ] Keyboard shortcuts work (`Cmd+,` for settings, etc.)

### Visual Regression Tests
- [ ] Desktop layout matches design
- [ ] Tablet layout adapts correctly
- [ ] Mobile layout is usable
- [ ] Dark theme consistent throughout
- [ ] Hover states work on interactive elements
- [ ] Loading states display correctly
- [ ] Empty states show when no data

### Performance Tests
- [ ] Table renders <100ms with 1000+ alerts
- [ ] Chart loads <500ms on coin selection
- [ ] No memory leaks after repeated selections
- [ ] Smooth scrolling in alert history
- [ ] Settings modal opens instantly

---

## Success Metrics

### User Experience
- **Goal**: Alert history is primary focus (>70% of screen time)
- **Metric**: Reduced clicks to view alert details (from 2-3 to 1)
- **Metric**: Chart visible 100% of time (vs on-demand in modal)

### Performance
- **Goal**: Faster alert inspection workflow
- **Metric**: Time to view alert + chart < 2 seconds
- **Metric**: Settings access < 1 second (keyboard shortcut)

### Code Quality
- **Goal**: Remove 500+ lines of deprecated code
- **Metric**: Delete CoinModal (267 lines)
- **Metric**: Delete ViewToggle (50 lines)
- **Metric**: Simplify `src/App.tsx` by 100+ lines

---

## Future Enhancements (Post-Redesign)

### Phase 8.7: Advanced Features (Future)
- Multi-coin chart comparison (overlay 2-3 coins)
- Alert replay (step through history with chart)
- Heatmap view (alert density over time)
- Alert correlation analysis (which alerts triggered together)
- Custom dashboard layouts (save user preferences)
- Export alert history to PDF/Excel
- Alert rules marketplace (share/import rules)

### Phase 8.8: Mobile App (Future)
- React Native wrapper for iOS/Android
- Push notifications for alerts
- Simplified mobile-first UI
- Offline mode with sync

---

## Dependencies & Risks

### Dependencies
- **Phase 7 Complete**: All tests passing (current phase)
- **No Breaking Changes**: Alert system API must remain stable
- **TanStack Query**: Existing cache strategy must support new data flow

### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| User resistance to new UI | High | Beta test with users, gather feedback |
| Chart performance issues | Medium | Lazy load, cache aggressively |
| Mobile layout complexity | Medium | Start with desktop, iterate on mobile |
| Alert data not loading | High | Extensive testing, fallback to old UI |
| Keyboard shortcuts conflict | Low | Document clearly, make configurable |

---

## Approval & Sign-off

**Stakeholders:**
- [ ] Development Team Lead
- [ ] UX/UI Designer (if applicable)
- [ ] Beta Testers (3-5 users)

**Timeline:**
- Week 1: Phase 8.1 (Component Refactoring)
- Week 2: Phase 8.2 (Layout Integration)
- Week 3: Phase 8.3-8.4 (Enhancements + Chart Sync)
- Week 4: Phase 8.5-8.6 (Settings + Polish)

**Go/No-Go Decision**: After Phase 8.2 review

---

## Appendix: Wireframes

### Desktop Layout (1920x1080)
```
┌────────────────────────────────────────────────────────────────┐
│ Header: Logo | Title | [Settings] [User Menu]                  │
├──────────┬──────────────────────────────────────┬──────────────┤
│ Left     │         Main Content Area            │ Right        │
│ Sidebar  │                                      │ Sidebar      │
│          │  ┌────────────────────────────────┐  │              │
│ Filters  │  │ TradingChart (400px)           │  │ Coin Details │
│ Controls │  │ [Selected Coin: BTC/USDT]      │  │              │
│ Market   │  └────────────────────────────────┘  │ Header       │
│ Summary  │  ┌────────────────────────────────┐  │ BTC/USDT     │
│          │  │ AlertTimelineChart (150px)     │  │ $45,123      │
│ Watchlist│  └────────────────────────────────┘  │ +2.34%       │
│ Selector │                                      │              │
│          │  [Search Bar: Filter alerts...]      │ 24h Stats    │
│          │                                      │ High: ...    │
│ Live     │  Alert History Table                 │ Low: ...     │
│ Status   │  ┌──────────────────────────────┐   │ Volume: ...  │
│          │  │ [WATCHLIST ALERTS] (3)       │   │              │
│          │  │ ├─ BTC  Scout Bull   12:34  │   │ VCP: 0.234   │
│          │  │ ├─ ETH  Bottom Hunter 12:30  │   │              │
│          │  │ └─ SOL  Surge 5 Bull   12:25  │   │ Fib Pivots   │
│          │  │─────────────────────────────│   │ R1: ...      │
│          │  │ [ALL ALERTS] (47)            │   │ P:  ...      │
│          │  │ ├─ DOGE Surge 60 Bull   12:20  │   │ S1: ...      │
│          │  │ ├─ ADA  Scout Bear   12:15  │   │              │
│          │  │ ├─ ... (more rows)           │   │ External     │
│          │  │ └─ ... (scroll)              │   │ [CoinGlass]  │
│          │  └──────────────────────────────┘   │ [Aggr.trade] │
│          │                                      │ [Binance]    │
│          │  [Clear History]                     │ [TradingView]│
└──────────┴──────────────────────────────────────┴──────────────┘
```

### Mobile Layout (375px)
```
┌─────────────────────┐
│ Header: ☰ Title [⚙] │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ TradingChart    │ │
│ │ (250px)         │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ Timeline (100px)│ │
│ └─────────────────┘ │
│                     │
│ [Search...]         │
│                     │
│ Alert History       │
│ ┌─────────────────┐ │
│ │[WATCHLIST] (2)  │ │
│ │ BTC Scout Bull │ │
│ │ ETH Bottom Hunt │ │
│ ├─────────────────┤ │
│ │[ALL ALERTS] (20)│ │
│ │ DOGE 60 Bull    │ │
│ │ ADA Scout Bear │ │
│ │ ... (scroll)    │ │
│ └─────────────────┘ │
│                     │
│ (Sidebar overlays)  │
└─────────────────────┘
```

---

**END OF ROADMAP**
