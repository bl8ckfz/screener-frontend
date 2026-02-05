# Auto-Hide Toolbar Implementation ✨

## Overview
The main toolbar now supports auto-hide functionality for better screen space utilization while maintaining accessibility.

## Features

### 🎯 Smart Behavior
- **Hidden by default**: Toolbar hides when scrolling down
- **Shows on scroll up**: Immediately appears when scrolling up
- **Always visible at top**: Shows when at the top of the page (within 50px)
- **Hover trigger**: Appears instantly when mouse hovers over the header area
- **Smooth transitions**: 300ms slide animation for polish

### 📱 Mobile Considerations
- Works on all screen sizes
- Touch-friendly with proper scroll thresholds
- No accidental hiding from small scrolls (<5px threshold)

### ⚙️ User Control
- **Settings Toggle**: Users can enable/disable in Settings → General → "Auto-hide Toolbar"
- **Persisted preference**: Setting saved to localStorage/IndexedDB
- **Enabled by default**: Ships with auto-hide on (can be changed in config)

## Technical Implementation

### Files Modified
1. **`src/hooks/useAutoHideHeader.ts`** (new)
   - Custom React hook for scroll detection
   - Debounced scroll handler (150ms delay)
   - Hover state management
   - Configurable thresholds and behavior

2. **`src/components/layout/Header.tsx`**
   - Changed from `sticky` to `fixed` positioning
   - Added transform-based show/hide animation
   - Mouse enter/leave handlers for hover behavior

3. **`src/components/layout/Layout.tsx`**
   - Integrated `useAutoHideHeader` hook
   - Added top padding to compensate for fixed header
   - Pass-through of auto-hide props to Header

4. **`src/types/config.ts`**
   - Added `autoHideHeader: boolean` to display config
   - Default: `true`

5. **`src/components/settings/GeneralSettings.tsx`**
   - Added UI toggle switch for auto-hide setting
   - User-friendly description and labels

6. **`src/App.tsx`**
   - Reads `autoHideHeader` from store
   - Passes to Layout component

## Best Practices Used

### ✅ Industry Standards
- **Scroll up reveals**: Used by YouTube, Medium, Twitter - users expect this behavior
- **Hover always shows**: Prevents frustration from "lost" UI elements
- **Threshold-based hiding**: Ignores tiny scrolls (no flickering)
- **Always visible at top**: Never hide when user is at the beginning

### ✅ Performance
- Debounced scroll events (150ms) prevent excessive calculations
- Passive event listeners for smooth scrolling
- No forced reflows or layout thrashing
- CSS transforms for GPU-accelerated animations

### ✅ Accessibility
- ARIA attributes on toggle switch (`role="switch"`, `aria-checked`)
- Keyboard focus indicators on toggle
- Predictable behavior (no surprise disappearances)
- User can disable if preferred

### ✅ User Experience
- Smooth 300ms transitions (not too fast, not too slow)
- Clear visual feedback on toggle
- Descriptive help text in settings
- Preference persisted across sessions

## Configuration Options

The `useAutoHideHeader` hook accepts these options:

```typescript
interface UseAutoHideHeaderOptions {
  enabled?: boolean       // Enable/disable feature (default: true)
  threshold?: number      // Scroll px before hiding (default: 5)
  hideDelay?: number      // Debounce delay in ms (default: 150)
  showAtTop?: boolean     // Show when at top (default: true)
  topOffset?: number      // "At top" threshold in px (default: 50)
}
```

## Usage Example

```tsx
// In Layout.tsx
const { isVisible, onMouseEnter, onMouseLeave } = useAutoHideHeader({
  enabled: autoHideHeader,
  threshold: 5,
  hideDelay: 150,
  showAtTop: true,
  topOffset: 50,
})

// Pass to Header
<Header 
  isVisible={isVisible}
  onMouseEnter={onMouseEnter}
  onMouseLeave={onMouseLeave}
/>
```

## Testing Checklist

- [x] Scrolling down hides toolbar
- [x] Scrolling up shows toolbar
- [x] Toolbar visible at page top
- [x] Hover shows toolbar instantly
- [x] Setting toggle works
- [x] Preference persists on reload
- [x] Works on mobile/tablet
- [x] No flickering on small scrolls
- [x] Smooth animations
- [x] Keyboard focus visible on toggle

## Future Enhancements

Possible improvements:
- Add animation speed setting (fast/normal/slow)
- Add "sticky at top" mode (never hide)
- Add "always hidden" mode (hover only)
- Customize scroll threshold per user preference
- Add keyboard shortcut to toggle (e.g., `Ctrl+H`)

## Disabling Auto-Hide

Users can disable this feature in two ways:

1. **Via Settings UI**: 
   - Click Settings (gear icon) → General tab → Toggle "Auto-hide Toolbar" OFF

2. **Via Code** (for developers):
   ```typescript
   // In config.ts DEFAULT_CONFIG
   display: {
     autoHideHeader: false, // Disable by default
   }
   ```

## Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- Uses standard CSS transforms and passive events (widely supported)

---

**Status**: ✅ Complete and tested
**Version**: 1.0
**Date**: February 5, 2026
