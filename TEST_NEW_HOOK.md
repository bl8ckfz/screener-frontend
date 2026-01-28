# Testing New Backend Hook

## ✅ Setup Complete

**Backend**: Production on Railway  
**URL**: https://api-gateway-production-f4ba.up.railway.app  
**Status**: ✅ Healthy (43 symbols)  
**Dev Server**: http://localhost:3000

## 🚀 How to Test

### Step 1: Open Browser Console

Open http://localhost:3000 in your browser and open DevTools Console (F12)

### Step 2: Enable New Hook

Run this command in browser console:
```javascript
localStorage.setItem('USE_NEW_BACKEND_HOOK', 'true')
location.reload()
```

### Step 3: Verify

After reload, check console for:
```
🚀 [App] Using NEW SIMPLIFIED BACKEND hook (useBackendData)
```

### Step 4: Check Data

You should see:
- **43 symbols** loaded from backend
- Coin table populated with data
- VCP values visible
- Price changes for 5m, 15m, 1h, 8h, 1d timeframes

## 📊 What to Look For

### Success Indicators
- ✅ No errors in console
- ✅ Table shows 43 coins
- ✅ Prices updating
- ✅ VCP values displayed
- ✅ Fibonacci levels present
- ✅ No "Using mock data" messages

### TanStack Query DevTools
Look for query with key: `['backendMetrics']`
- Should show 43 coins
- Should refetch every 5 seconds
- Should show "success" status

## 🔄 Switch Back to Legacy

To test legacy mode:
```javascript
localStorage.removeItem('USE_NEW_BACKEND_HOOK')
location.reload()
```

Console should show:
```
🔄 [App] Using BACKEND API mode (legacy adapter)
```

## 🐛 Troubleshooting

### No Data Loading
1. Check backend health: https://api-gateway-production-f4ba.up.railway.app/api/health
2. Check metrics endpoint: https://api-gateway-production-f4ba.up.railway.app/api/metrics/
3. Look for CORS errors in console

### TypeScript Errors
Run: `npm run type-check`

### Build Errors
Run: `npm run build`

## 📈 Performance Comparison

| Metric | Legacy (useMarketData) | New (useBackendData) |
|--------|------------------------|----------------------|
| **Lines of Code** | 978 | 120 |
| **Complexity** | WebSocket + Processing | Simple Polling |
| **API Calls** | Binance Direct | Backend Only |
| **Data Source** | Client-side calc | Server-side calc |
| **Bundle Impact** | Heavy | Light |

## ✅ Success Criteria

- [ ] 43 symbols loaded
- [ ] VCP calculations visible
- [ ] Fibonacci levels displayed
- [ ] Multi-timeframe data present
- [ ] No console errors
- [ ] Table sorting works
- [ ] Modal opens for coin details
- [ ] Performance acceptable (<100ms render)

## 🎯 Next Steps After Testing

1. **If successful**: Enable for all users (update default in App.tsx)
2. **If issues**: Document bugs, fix, re-test
3. **When stable**: Delete legacy code (Week 2 cleanup)
4. **Final**: Update documentation

---

**Last Updated**: January 27, 2026  
**Status**: Ready for Testing 🚀
