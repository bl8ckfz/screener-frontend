# Frontend Authentication Testing Guide

## Setup

1. **Start the backend API** (in `screener-backend` folder):
   ```bash
   cd ../screener-backend
   make build
   JWT_SECRET="your-secret-key" ./bin/api-gateway
   ```

2. **Start the frontend** (in `screener-frontend` folder):
   ```bash
   npm run dev
   ```

3. **Configure environment** (`.env.local`):
   ```env
   VITE_BACKEND_API_URL=http://localhost:8080
   VITE_BACKEND_WS_URL=ws://localhost:8080/ws/alerts
   VITE_USE_BACKEND_API=true
   ```

## Test Scenarios

### 1. User Registration
1. Open http://localhost:3000
2. Click "Sign In" button in header
3. Click "Sign up" link in auth modal
4. Enter email (e.g., `test@example.com`)
5. Enter password (min 8 characters)
6. Click "Create Account"

**Expected Results:**
- ✅ Account created successfully
- ✅ Modal closes automatically
- ✅ User email appears in header menu
- ✅ JWT token stored in localStorage (`auth_token`)
- ✅ User data stored in localStorage (`auth_user`)

### 2. User Login
1. Click user menu to sign out
2. Click "Sign In" button again
3. Enter registered email and password
4. Click "Login"

**Expected Results:**
- ✅ Login successful
- ✅ Modal closes
- ✅ User email appears in header
- ✅ JWT token refreshed in localStorage

### 3. Invalid Login
1. Click "Sign In"
2. Enter wrong credentials
3. Click "Login"

**Expected Results:**
- ✅ Error message displayed in red box
- ✅ Modal stays open
- ✅ No token stored

### 4. Session Persistence
1. Login successfully
2. Refresh the page (F5)

**Expected Results:**
- ✅ User still logged in after refresh
- ✅ Email appears in header immediately
- ✅ Token validated with backend on mount

### 5. API Authorization
1. Login successfully
2. Open DevTools → Network tab
3. Trigger any API request (data refresh, etc.)

**Expected Results:**
- ✅ Request headers include `Authorization: Bearer <token>`
- ✅ Backend returns 200 OK for authorized endpoints

### 6. Token Expiration
1. Login successfully
2. Manually delete JWT from localStorage:
   ```js
   localStorage.removeItem('auth_token')
   ```
3. Trigger an API request

**Expected Results:**
- ✅ 401 Unauthorized returned
- ✅ User automatically logged out
- ✅ "Sign In" button appears

### 7. Logout
1. Login successfully
2. Click user avatar in header
3. Click "Sign Out"

**Expected Results:**
- ✅ User logged out
- ✅ Token removed from localStorage
- ✅ User data removed from localStorage
- ✅ "Sign In" button appears

## Browser Console Checks

After login, verify in console:
```javascript
// Check token
localStorage.getItem('auth_token')
// Should return: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."

// Check user
localStorage.getItem('auth_user')
// Should return: '{"id":"...","email":"test@example.com",...}'
```

## Backend API Verification

Test backend endpoints directly:
```bash
# Register
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get current user (requires token from login)
curl http://localhost:8080/api/me \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

## Known Issues

1. **CORS Errors**: Make sure api-gateway has CORS enabled for `http://localhost:3000`
2. **Token Refresh**: Implement token refresh logic before token expires (currently 24h)
3. **Supabase Migration**: Old Supabase auth code still exists in App.tsx - will be removed in Phase 3

## Next Steps

After auth is working:
1. ✅ Phase 2: Implement watchlist CRUD API
2. ✅ Phase 3: Implement webhook CRUD API  
3. ✅ Phase 4: Connect frontend watchlist to backend
4. ✅ Phase 5: Connect frontend webhook settings to backend
