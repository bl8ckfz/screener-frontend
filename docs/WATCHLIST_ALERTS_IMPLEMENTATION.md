# Watchlist Alert System Implementation

## Overview
Extended the alert system to support separate alert history and webhook configurations for watchlist coins. Alerts from watchlist coins are now tracked separately and can be routed to different webhooks than main alerts.

## Changes Summary

### 1. Type System Extensions (`src/types/alert.ts`)
- Added `source?: 'main' | 'watchlist'` field to `Alert` interface to track alert origin
- Added `watchlistId?: string` field to track which watchlist triggered the alert
- Added `watchlistWebhooks: WebhookConfig[]` to `AlertSettings` for separate webhook configurations

### 2. Alert Engine Updates (`src/services/alertEngine.ts`)
- Modified `evaluateAlertRules()` to accept optional `watchlistId` parameter
- Updated function to tag alerts with `source: 'main' | 'watchlist'`
- Enhanced logging to distinguish between main and watchlist alert evaluations
- Alerts from watchlist coins now include `watchlistId` reference

### 3. Webhook Service Enhancement (`src/services/webhookService.ts`)
- Updated `sendToWebhooks()` to accept `source` parameter
- Added logging to show webhook routing based on alert source
- Webhooks now route correctly based on whether alert is from main list or watchlist

### 4. Alert History UI (`src/components/alerts/AlertHistory.tsx`)
- Added new `SourceTab` type: `'all' | 'main' | 'watchlist'`
- Implemented tab navigation to filter alerts by source
- Added state management for `sourceTab` filter
- Updated filtering logic to respect source tab selection
- UI now shows three tabs: "All Alerts", "Main Alerts", "Watchlist Alerts"

### 5. Webhook Manager UI (`src/components/alerts/WebhookManager.tsx`)
- Added `WebhookSource` type and `activeTab` state
- Implemented tab navigation for main/watchlist webhook configurations
- Updated all CRUD operations to work with correct webhook array based on active tab
- Added visual distinction between main and watchlist webhook configurations
- Each tab shows independent webhook lists with separate configurations

### 6. Market Data Hook (`src/hooks/useMarketData.ts`)
- Updated webhook routing logic in 3 places to check `alert.source`
- Main alerts use `alertSettings.webhooks`
- Watchlist alerts use `alertSettings.watchlistWebhooks`
- Legacy Discord webhook only applies to main alerts (backwards compatibility)

### 7. Store Configuration (`src/hooks/useStore.ts`)
- Added `watchlistWebhooks: []` to default alert settings
- Ensures empty array is initialized for new installations

## Usage Guide

### For Users

#### Configuring Watchlist Webhooks
1. Navigate to Alert Configuration → Webhook Manager
2. Click on "Watchlist Alerts" tab
3. Add webhooks specifically for watchlist alerts (same UI as main webhooks)
4. Configure Discord/Telegram webhooks independently from main alerts

#### Viewing Watchlist Alert History
1. Open Alert History panel
2. Use the tabs at the top to filter:
   - **All Alerts**: Shows both main and watchlist alerts
   - **Main Alerts**: Shows only alerts from main screener list
   - **Watchlist Alerts**: Shows only alerts from watchlist coins

### For Developers

#### Triggering Watchlist Alerts
When evaluating alerts for watchlist coins, pass the `watchlistId`:

```typescript
const watchlistAlerts = evaluateAlertRules(
  watchlistCoins,
  alertRules,
  marketMode,
  watchlistId // Pass watchlist ID
)
```

#### Alert Object Structure
Alerts now include source tracking:

```typescript
const alert: Alert = {
  // ... existing fields
  source: 'watchlist', // or 'main'
  watchlistId: 'watchlist_123', // Only if source is 'watchlist'
}
```

#### Webhook Configuration
Settings now support two webhook arrays:

```typescript
alertSettings: {
  webhooks: WebhookConfig[], // For main alerts
  watchlistWebhooks: WebhookConfig[], // For watchlist alerts
  // ... other settings
}
```

## Technical Details

### Alert Flow for Watchlist Coins
1. Alert engine evaluates rules against watchlist coins
2. Triggered alerts are tagged with `source: 'watchlist'` and `watchlistId`
3. Alert history stores alerts with source information
4. Webhook service routes to `watchlistWebhooks` based on `alert.source`
5. UI filters alerts based on source tab selection

### Backwards Compatibility
- Existing alerts without `source` field are treated as main alerts
- Legacy `discordWebhookUrl` only applies to main alerts
- Empty `watchlistWebhooks` array doesn't break existing configurations

### Data Persistence
- `watchlistWebhooks` persisted in Zustand store (localStorage)
- Alert history retains `source` and `watchlistId` fields
- No migration required - new fields are optional

## Testing Checklist

- [x] Type checking passes (`npm run type-check`)
- [ ] Main alerts still route to main webhooks
- [ ] Watchlist alerts route to watchlist webhooks
- [ ] Alert history tabs filter correctly
- [ ] Webhook manager tabs work independently
- [ ] Adding/editing/deleting webhooks works in both tabs
- [ ] Empty webhook configurations don't break alert flow
- [ ] Legacy Discord webhook still works for main alerts

## Future Enhancements

1. **Watchlist-Specific Alert Rules**: Allow different alert rules for watchlist vs main
2. **Alert Statistics by Source**: Show separate stats for main vs watchlist alerts
3. **Bulk Operations**: Select multiple alerts by source for bulk actions
4. **Export Separation**: Export main and watchlist alert history separately
5. **Notification Preferences**: Different notification settings for watchlist alerts

## Migration Notes

No database migration required. Changes are fully backwards compatible:
- Existing alerts render without `source` field (treated as main)
- Empty `watchlistWebhooks` array is default for new installations
- Old alert data continues to work without modification

## File Modifications

### Modified Files
1. `src/types/alert.ts` - Extended Alert and AlertSettings types
2. `src/services/alertEngine.ts` - Added watchlist tracking
3. `src/services/webhookService.ts` - Added source-based routing
4. `src/components/alerts/AlertHistory.tsx` - Added source tabs
5. `src/components/alerts/WebhookManager.tsx` - Added webhook source tabs
6. `src/hooks/useMarketData.ts` - Updated webhook routing (3 locations)
7. `src/hooks/useStore.ts` - Added watchlistWebhooks default

### Created Files
- `docs/WATCHLIST_ALERTS_IMPLEMENTATION.md` (this file)

## Related Documentation
- See `docs/ALERT_SYSTEM_TESTING.md` for alert system test coverage
- See `docs/PHASE_6_SUMMARY.md` for Phase 6 completion (alert system foundation)
- See `src/types/screener.ts` for Watchlist interface definition
