# Watchlist Integration Testing Guide

## Phase 3 - Frontend Watchlist Integration ✅

### What Was Implemented

1. **Watchlist Service** (`src/services/watchlistService.ts`)
   - `getWatchlist()` - Fetch user's watchlist from backend
   - `addSymbol(symbol)` - Add symbol to watchlist
   - `removeSymbol(symbol)` - Remove symbol from watchlist
   - `replaceWatchlist(symbols)` - Replace entire watchlist
   - Auto-normalizes symbols to uppercase
   - Handles authentication and errors

2. **Auth Hook Updates** (`src/hooks/useAuth.tsx`)
   - Added `syncWatchlist()` function
   - Auto-syncs watchlist after login
   - Clears local watchlist on logout
   - Exposes `syncWatchlist` in auth context

3. **Store Updates** (`src/hooks/useStore.ts`)
   - `toggleWatchlist()` now calls backend API when authenticated
   - Optimistic UI update with error rollback
   - Backend sync happens asynchronously
   - Falls back to local-only mode when not authenticated

### How It Works

#### Login Flow
```
1. User logs in via AuthModal
2. useAuth.login() authenticates with backend
3. syncWatchlist() fetches user's watchlist from backend
4. Store updates with backend watchlist symbols
5. WatchlistStar components reflect synced state
```

#### Toggle Flow (Authenticated)
```
1. User clicks star icon in WatchlistStar
2. toggleWatchlist() immediately updates local state (optimistic)
3. Backend API call happens asynchronously
   - Add: POST /api/watchlist
   - Remove: DELETE /api/watchlist
4. On error: Local state reverts to match backend
5. On success: State stays updated
```

#### Toggle Flow (Not Authenticated)
```
1. User clicks star icon
2. toggleWatchlist() updates local state only
3. No backend call (localStorage fallback)
4. Watchlist persists in browser only
```

### Testing Checklist

#### Manual Testing

1. **Login & Sync**
   - [ ] Login with existing account that has watchlist
   - [ ] Verify stars appear on previously starred coins
   - [ ] Check browser console for "Synced watchlist" logs

2. **Add to Watchlist**
   - [ ] Click star icon on BTCUSDT
   - [ ] Star should fill immediately (yellow ⭐)
   - [ ] Refresh page - star should remain filled
   - [ ] Check backend: `curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/watchlist`

3. **Remove from Watchlist**
   - [ ] Click filled star on BTCUSDT
   - [ ] Star should empty immediately (gray ☆)
   - [ ] Refresh page - star should remain empty
   - [ ] Check backend confirms removal

4. **50-Symbol Limit**
   - [ ] Add 49 symbols to watchlist
   - [ ] Try adding 50th symbol - should succeed
   - [ ] Try adding 51st symbol - should fail with error
   - [ ] Error should revert star icon

5. **Logout & Clear**
   - [ ] Logout
   - [ ] All stars should clear
   - [ ] Login again - stars should restore from backend

6. **Offline Mode**
   - [ ] Logout
   - [ ] Toggle stars while not authenticated
   - [ ] Stars should still work (local-only mode)
   - [ ] Login - local watchlist should sync to backend

### API Endpoints Used

```
GET    /api/watchlist
POST   /api/watchlist   { "symbol": "BTCUSDT" }
DELETE /api/watchlist   { "symbol": "BTCUSDT" }
PUT    /api/watchlist   { "symbols": ["BTC", "ETH", ...] }
```

All require `Authorization: Bearer <JWT>` header.

### Error Handling

**401 Unauthorized**
- Auto-logout user
- Clear local watchlist
- Redirect to login

**400 Bad Request**
- Show error message
- Revert optimistic update
- Log error to console

**50-Symbol Limit**
- Backend returns 400 with error message
- Frontend reverts add operation
- Star icon returns to empty state

### Code Components

**Service Layer**
- `src/services/watchlistService.ts` - Backend API client

**State Management**
- `src/hooks/useAuth.tsx` - Auth context with watchlist sync
- `src/hooks/useStore.ts` - Zustand store with backend integration

**UI Components**
- `src/components/coin/WatchlistStar.tsx` - Star icon (unchanged)

### What Didn't Change

- **WatchlistStar.tsx** - UI component remains exactly the same
- **Visual appearance** - Same star icons and colors
- **User interaction** - Same click behavior
- **Local-only mode** - Still works when not authenticated

### Next Steps

After verifying watchlist works:

**Phase 4**: Backend webhook CRUD API
- `pkg/webhook/service.go`
- `/api/webhooks` endpoints
- 10-webhook limit enforcement

**Phase 5**: Frontend webhook integration
- Connect WebhookManager.tsx to backend
- Sync webhooks on login
- Test webhook delivery

### Known Issues

None currently - all tests passing locally.

### Debugging Tips

**Check watchlist sync**
```javascript
// Browser console
console.log(useStore.getState().watchlistSymbols)
```

**Check backend watchlist**
```bash
TOKEN="your-jwt-token"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/watchlist
```

**Check auth state**
```javascript
// Browser console
localStorage.getItem('auth_token')
```

**Enable debug logs**
```javascript
// src/services/watchlistService.ts
console.log('Calling backend:', method, url, data)
```
