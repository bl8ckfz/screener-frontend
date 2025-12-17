# Ichimoku Cloud Implementation Roadmap

## Overview
Add Ichimoku Cloud technical indicator to chart visualization, optimized for 15m interval analysis.

**Priority**: Medium  
**Estimated Effort**: 5-7 hours  
**Dependencies**: None (uses existing lightweight-charts 4.2.3)  
**Status**: 📋 Planning

---

## Phase 1: Calculation Layer (1-2 hours)

### Task 1.1: Create Ichimoku Calculation Function
**File**: `src/utils/indicators.ts`

```typescript
export interface IchimokuData {
  time: number
  tenkanSen: number      // Conversion Line (9-period)
  kijunSen: number       // Base Line (26-period)
  senkouSpanA: number    // Leading Span A (shifted +26)
  senkouSpanB: number    // Leading Span B (52-period, shifted +26)
  chikouSpan: number     // Lagging Span (shifted -26)
}

export function calculateIchimoku(
  candlesticks: Candlestick[],
  tenkanPeriod = 9,
  kijunPeriod = 26,
  senkouBPeriod = 52
): IchimokuData[]
```

**Logic**:
- Tenkan-sen: (9-period high + low) / 2
- Kijun-sen: (26-period high + low) / 2
- Senkou Span A: (Tenkan + Kijun) / 2, shifted forward +26
- Senkou Span B: (52-period high + low) / 2, shifted forward +26
- Chikou Span: Close price, shifted backward -26

**Requirements**:
- ✅ Minimum 52 candles for accurate calculation
- ✅ Handle edge cases (insufficient data)
- ✅ Memoize with `memoize()` helper
- ✅ Return empty array if data < 52 candles

### Task 1.2: Unit Tests
**File**: `tests/utils/indicators.test.ts`

- Test with known Ichimoku values
- Test edge cases (empty data, insufficient candles)
- Test different period configurations
- Verify time shifts are correct

---

## Phase 2: Chart Integration (2-3 hours)

### Task 2.1: Add Ichimoku Props
**File**: `src/components/coin/TradingChart.tsx`

```typescript
export interface TradingChartProps {
  // ... existing props
  showIchimoku?: boolean
  ichimokuData?: IchimokuData[]
}
```

### Task 2.2: Create Series Refs
```typescript
const tenkanRef = useRef<ISeriesApi<'Line'> | null>(null)
const kijunRef = useRef<ISeriesApi<'Line'> | null>(null)
const senkouARef = useRef<ISeriesApi<'Area'> | null>(null)
const senkouBRef = useRef<ISeriesApi<'Area'> | null>(null)
const chikouRef = useRef<ISeriesApi<'Line'> | null>(null)
```

### Task 2.3: Implement Ichimoku Series Effect
Pattern: Follow existing `weeklyVWAP` implementation (lines 370-405)

```typescript
useEffect(() => {
  if (!chartRef.current || !showIchimoku || !ichimokuData) return
  
  // 1. Remove existing series
  // 2. Add Senkou Span B (cloud bottom) as area series
  // 3. Add Senkou Span A (cloud top) as area series
  // 4. Add Tenkan-sen (conversion) as line series
  // 5. Add Kijun-sen (base) as line series
  // 6. Add Chikou Span (lagging) as line series
}, [showIchimoku, ichimokuData])
```

**Color Scheme**:
- Tenkan-sen: `#3b82f6` (blue-500) - Conversion line
- Kijun-sen: `#ef4444` (red-500) - Base line
- Chikou Span: `#8b5cf6` (purple-500) - Lagging span
- Cloud (bullish): `rgba(16, 185, 129, 0.15)` (green with transparency)
- Cloud (bearish): `rgba(239, 68, 68, 0.15)` (red with transparency)

**Z-Index Order** (bottom to top):
1. Cloud (area series)
2. Kijun-sen, Tenkan-sen, Chikou Span (line series)
3. Candlesticks (main series)
4. Volume histogram

### Task 2.4: Handle Cloud Color Logic
```typescript
// Dynamically determine cloud color based on Span A vs Span B
const cloudColor = spanA > spanB 
  ? 'rgba(16, 185, 129, 0.15)'  // Bullish
  : 'rgba(239, 68, 68, 0.15)'    // Bearish
```

---

## Phase 3: UI Controls (1 hour)

### Task 3.1: Add Ichimoku Toggle
**File**: `src/components/coin/ChartContainer.tsx`

```typescript
const [showIchimoku, setShowIchimoku] = useState(false)
const [ichimokuData, setIchimokuData] = useState<IchimokuData[]>([])
```

### Task 3.2: Calculate Ichimoku on Data Load
```typescript
useEffect(() => {
  if (showIchimoku && chartData.length >= 52) {
    const calculatedData = calculateIchimoku(chartData)
    setIchimokuData(calculatedData)
  }
}, [chartData, showIchimoku])
```

### Task 3.3: Add Toggle Button
Location: Chart controls section (near VWAP toggle)

```tsx
<button
  onClick={() => setShowIchimoku(!showIchimoku)}
  disabled={chartData.length < 52}
  className="..."
  title={chartData.length < 52 ? 'Requires 52+ candles' : 'Toggle Ichimoku Cloud'}
>
  <span>Ichimoku</span>
  {showIchimoku && <Check className="w-4 h-4" />}
</button>
```

### Task 3.4: Add Indicator Legend (Optional)
Show active indicators with color codes when hovering chart

---

## Phase 4: Testing & Documentation (1 hour)

### Task 4.1: Manual Testing
- [ ] Test with 15m interval (primary use case)
- [ ] Test with 1h, 4h intervals
- [ ] Verify cloud coloring (bullish/bearish transitions)
- [ ] Check performance with 100 candles
- [ ] Validate time shifts (+26, -26 periods)
- [ ] Test with insufficient data (<52 candles)
- [ ] Test toggle on/off multiple times
- [ ] Verify compatibility with VWAP, alerts, bubbles

### Task 4.2: Update Documentation
**File**: `docs/CHART_IMPLEMENTATION.md`

Add section:
```markdown
### Ichimoku Cloud Indicator
- 5 components: Tenkan-sen, Kijun-sen, Senkou Span A/B, Chikou Span
- Default periods: 9/26/52
- Minimum data: 52 candles
- Cloud color: Green (bullish) / Red (bearish)
```

### Task 4.3: Update ROADMAP.md
Mark as completed in Phase 7 or Phase 8 (Advanced Features)

---

## Technical Notes

### Data Requirements
- **Minimum candles**: 52 (for Senkou Span B calculation)
- **Recommended candles**: 100+ (for historical context)
- **Current fetch limit**: 100 ✅

### Performance Impact
- **Calculation**: O(n) complexity, ~1ms for 100 candles
- **Rendering**: 5 series overlays, handled efficiently by lightweight-charts
- **Bundle size**: +3-5KB gzipped
- **Memory**: Negligible (5 series refs)

### Historical Shift Implementation
```typescript
// Forward shift (+26): Use future candle times
senkouSpanA: {
  time: candlesticks[i + 26]?.time || candlesticks[i].time,
  value: (tenkan + kijun) / 2
}

// Backward shift (-26): Use past candle times
chikouSpan: {
  time: candlesticks[i - 26]?.time || candlesticks[i].time,
  value: candlesticks[i].close
}
```

---

## Design Decisions

### Why Not Use Plugin?
- lightweight-charts 4.2.3 has all required primitives
- Custom implementation offers full control
- No additional dependencies
- Easier to customize colors/periods

### Why Separate from VWAP?
- Both can coexist (different analysis purposes)
- VWAP: Volume-weighted average (trend)
- Ichimoku: Multi-timeframe momentum/support/resistance
- Optional: Make mutually exclusive if visual clutter becomes issue

### Why 15m Interval Focus?
- Ichimoku works on all timeframes
- 15m provides good balance between noise and signal
- Short-term trading (intraday) benefits most
- No special code needed per interval

---

## Success Criteria

✅ **Functional**:
- All 5 Ichimoku components render correctly
- Cloud color changes with Span A/B crossover
- Time shifts accurate (+26, -26 periods)
- Toggle works reliably

✅ **Performance**:
- No lag when toggling on/off
- Smooth chart interaction with all indicators
- <100ms calculation time for 100 candles

✅ **UX**:
- Clear visual distinction from other indicators
- Legend/tooltip shows what's displayed
- Disabled state when insufficient data
- Consistent with design system colors

---

## Future Enhancements (Post-MVP)

- [ ] Custom period configuration (9/26/52 adjustable)
- [ ] Ichimoku signals (strong/weak bullish/bearish zones)
- [ ] Preset configurations (fast: 7/22/44, slow: 10/30/60)
- [ ] Mobile optimization (simplified view)
- [ ] Alerts based on Ichimoku crosses
- [ ] Save indicator preferences per user

---

## References

- [Ichimoku Cloud Strategy](https://www.investopedia.com/terms/i/ichimoku-cloud.asp)
- [lightweight-charts API](https://tradingview.github.io/lightweight-charts/docs)
- Current VWAP implementation: `src/components/coin/TradingChart.tsx:370-405`
- Indicator utils: `src/utils/indicators.ts`

---

**Last Updated**: December 17, 2025  
**Status**: 📋 Ready for implementation
