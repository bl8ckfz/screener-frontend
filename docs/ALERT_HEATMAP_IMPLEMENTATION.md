# Alert Heatmap Timeline Implementation

## Overview

The **AlertHeatmapTimeline** component provides a visual representation of alert frequency using intensity-based heatmaps. This solves the problem of displaying high-frequency alerts (13 alerts/minute) in a clear, non-cluttered way.

## Component Location

```
src/components/alerts/AlertHeatmapTimeline.tsx
```

## Implementation Date

February 3, 2026

## Design Pattern: Hybrid Heatmap + Expandable Detail

The component combines two visualization approaches:

### 1. Collapsed View (Heatmap Bar)
- Shows alert intensity as color brightness
- Each cell represents a 1-minute bucket
- Color intensity scales with alert count:
  - Light gray: 0 alerts
  - Medium intensity: 1-3 alerts
  - High intensity: 4-6 alerts
  - Maximum intensity: 7-10 alerts
  - Brightest: 11+ alerts
- Displays total count and alerts/minute rate

### 2. Expanded View (Individual Alerts)
- Click to expand and see all individual alerts
- Lists every alert with timestamp, price, and % change
- Shows detailed metrics:
  - Total count
  - Alert rate (alerts/min)
  - High-frequency warning (>10 alerts/min)
- Sorted newest to oldest

## Key Features

### Alert Grouping
- Groups by alert type (Pioneer Bull, 60 Big Bull, etc.)
- Creates 1-minute time buckets
- Preserves all individual alert records

### Color Coding
- Matches existing AlertBadges and AlertTimelineChart colors
- Green shades: Bullish alerts
- Red/Pink shades: Bearish alerts
- Purple: Hunter alerts (bottom/top)

### Data Source
- Backend API: Fetches from `/api/v1/alert-history`
- Local fallback: Uses `alertHistoryService` from localStorage
- Auto-refresh: Polls every 10 seconds for new alerts

### Performance
- Memoized calculations for bucket aggregation
- Efficient rendering with React optimizations
- Max height scroll for expanded view (max-h-64)

## Integration Points

### ChartSection Component
Location: `src/components/coin/ChartSection.tsx`

The component is integrated alongside the existing AlertTimelineChart:

```tsx
{/* Alert Heatmap Timeline - NEW */}
<AlertHeatmapTimeline 
  symbol={selectedCoin.symbol} 
  fullSymbol={selectedCoin.fullSymbol}
  timeRange={60 * 60 * 1000} // 1 hour
/>

{/* Alert Timeline Chart - Original */}
<AlertTimelineChart symbol={selectedCoin.symbol} height={150} />
```

## Props Interface

```typescript
interface AlertHeatmapTimelineProps {
  symbol: string          // Normalized symbol (e.g., 'BTC')
  fullSymbol?: string     // Full symbol with pair (e.g., 'BTCUSDT')
  timeRange?: number      // Time range in ms (default: 1 hour)
}
```

## Example Scenarios

### Scenario 1: Pioneer Bear - 13 Alerts in 1 Minute
**Collapsed View:**
```
Pioneer Bear [13 alerts] 13.0/min
░░░░░░░░░░░░░░░░░░░░░░░░░░░░█░░░░░░░░░░░░░░░░░░░░░░
                           ↑ (13 alerts at 0:45)
```

**Expanded View:**
Shows all 13 individual alerts with timestamps:
- 0:45:55 - $42,350 (+2.3%)
- 0:45:50 - $42,348 (+2.2%)
- ... (11 more)
- 0:45:00 - $42,320 (+2.1%)

### Scenario 2: Multiple Alert Types
```
60 Big Bull [8 alerts] 8.0/min
░░░▓▓██▓░░░░░░░░░░░░░░░

Pioneer Bull [5 alerts] 5.0/min
░░░░░░░░░░░░▓██░░░░░░░░

Bottom Hunter [2 alerts] 2.0/min
░░░░░░░•░░░░░░░•░░░░░░░
```

## Visual Design

### Color Intensity Mapping
```typescript
const getIntensityColor = (count: number, alertType: string): string => {
  if (count === 0) return 'bg-gray-900/5'
  if (count === 1) return colors[0]     // Very light
  if (count <= 3) return colors[1]      // Light
  if (count <= 6) return colors[2]      // Medium
  if (count <= 10) return colors[3]     // Bright
  return colors[4]                       // Maximum
}
```

### Alert Type Colors
Matches existing color scheme from AlertBadges.tsx:
- `futures_big_bull_60`: Dark green (#14532d)
- `futures_pioneer_bull`: Light emerald (#a7f3d0)
- `futures_5_big_bull`: Lime (#84cc16)
- `futures_15_big_bull`: Green (#16a34a)
- `futures_bottom_hunter`: Purple (#a855f7)
- `futures_big_bear_60`: Dark red (#7f1d1d)
- `futures_pioneer_bear`: Light pink (#fce7f3)
- `futures_5_big_bear`: Red (#f87171)
- `futures_15_big_bear`: Red (#dc2626)
- `futures_top_hunter`: Purple (#a855f7)

## Advantages Over Other Approaches

### vs. Toast Notifications
- Doesn't spam UI with 13 toasts
- Shows temporal distribution
- Preserves all alert history

### vs. Alert Timeline (Dots)
- Handles high frequency better (13 dots vs 1 heatmap cell)
- Shows intensity at a glance
- More compact for frequent alerts

### vs. TradingView Chart Markers
- Shows all alerts (not just last one per candle)
- No overlap issues
- Dedicated space for alert visualization

### vs. Alert History Table
- Visual representation vs text list
- Shows timing patterns
- Expandable for detail on demand

## Performance Considerations

### Bucket Calculation
- O(n) complexity where n = number of alerts
- Memoized to prevent recalculation on every render
- Efficient Map-based grouping

### Rendering
- Fixed number of buckets (60 for 1-hour view)
- Conditional rendering for expanded state
- Scroll container for large alert lists

### Data Fetching
- Backend: 10-second polling interval
- Uses React Query for caching
- Automatic stale data revalidation

## Future Enhancements

### Potential Additions
1. **Configurable Time Ranges**
   - 5m, 15m, 30m, 1h, 6h, 24h selector
   - Dynamic bucket sizing based on range

2. **Export Functionality**
   - CSV export of all alerts in group
   - JSON export with full metadata

3. **Alert Filtering**
   - Filter by alert type
   - Filter by price range
   - Filter by time of day

4. **Statistics Dashboard**
   - Average alerts/minute
   - Peak alert times
   - Alert type distribution pie chart

5. **Zoom/Pan Controls**
   - Interactive zoom like AlertTimelineChart
   - Mouse wheel zoom on heatmap

6. **Alert Comparison**
   - Compare alert frequency between symbols
   - Side-by-side heatmaps

## Related Components

- **AlertTimelineChart**: Original dot-based timeline (24h view)
- **AlertBadges**: Color-coded type badges
- **AlertHistoryTable**: Grouped table view
- **TradingChart**: Chart with alert markers
- **AlertNotification**: Toast notifications

## Testing Notes

### Manual Testing Checklist
- [ ] Heatmap displays correctly for 13 alerts in 1 minute
- [ ] Intensity colors match alert types
- [ ] Expand/collapse animation works
- [ ] Individual alerts sorted newest first
- [ ] Alerts/min calculation accurate
- [ ] High-frequency warning appears when >10/min
- [ ] Backend API integration works
- [ ] Local storage fallback works
- [ ] Auto-refresh updates view every 10s
- [ ] No overlap with existing components

### Edge Cases
- No alerts: Shows empty state message
- Single alert: Shows minimal intensity
- 100+ alerts: Scroll container handles overflow
- Multiple alert types: Each gets own row
- Time range change: Re-buckets correctly

## Code Quality

### TypeScript Coverage
- ✅ Full type safety
- ✅ No `any` types
- ✅ Proper interface definitions
- ✅ Memoization with proper dependencies

### Performance
- ✅ Memoized calculations
- ✅ Efficient data structures (Map)
- ✅ Conditional rendering
- ✅ Query caching via React Query

### Accessibility
- ⚠️ Keyboard navigation needs improvement
- ⚠️ Screen reader support not implemented
- ✅ Semantic HTML structure
- ✅ Proper button roles

## Deployment Status

- ✅ Implemented in `screener-frontend`
- ✅ Implemented in `screener` (sibling project)
- ✅ Type-check passed
- ⏳ Not yet deployed to production
- ⏳ Awaiting user testing/feedback

## Conclusion

The AlertHeatmapTimeline component successfully addresses the challenge of displaying high-frequency alerts (13/minute) without cluttering the UI. By combining intensity visualization with expandable detail, it provides both overview and granular access to alert data. The implementation is performant, type-safe, and integrates seamlessly with existing components.
