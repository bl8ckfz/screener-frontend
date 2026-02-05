# Authentication Wall Implementation Roadmap

## Overview
Move all app functionality behind authentication, requiring users to sign in before accessing any features. Create a public landing page as the entry point.

**Current State**: App is publicly accessible, backend uses custom JWT auth  
**Target State**: Landing page public, all features require authentication

## Architecture: Custom Backend Authentication

### Backend (Go - Already Implemented)
- **Auth Service**: `pkg/auth/service.go` with JWT generation/validation
- **Endpoints**: 
  - `POST /auth/register` - Public, returns JWT + user
  - `POST /auth/login` - Public, returns JWT + user  
  - `GET /api/me` - Protected, returns current user
  - `POST /api/refresh` - Protected, generates new JWT
- **Middleware**: `authMiddleware()` validates Bearer tokens, extracts user context
- **Database**: PostgreSQL `users` table with bcrypt password hashing
- **JWT**: HS256, 24h expiry, stores `user_id` + `email` in claims

### Frontend (TypeScript - Already Implemented)
- **Auth Service**: `src/services/authService.ts` - login/register/logout/getCurrentUser
- **API Client**: `src/services/backendApi.ts` - auto-injects JWT in Authorization header
- **Storage**: localStorage persistence for tokens
- **Auto-logout**: Handles 401 responses automatically

### What's Missing
- ❌ Frontend route guards (all pages currently public)
- ❌ Landing page for unauthenticated users
- ❌ Full backend protection (some endpoints use `authOptional`)
- ❌ Protected layout wrapper

---

## Phase 1: Landing Page (Week 1)

### 1.1 Design & Content Strategy
**Goal**: Create compelling landing page that converts visitors to sign-ups

**Tasks**:
- [ ] Design hero section with value proposition
  - Tagline: "Real-Time Crypto Alerts & Market Analysis"
  - Key benefits: 200+ pairs, 10 alert types, real-time WebSocket updates
  - CTA: "Get Started Free" / "Sign In"
  
- [ ] Feature showcase sections:
  - [ ] Alert System (Big Bull/Bear, Pioneer, Whale, Volume, Flat)
  - [ ] Real-time Heatmap with intensity visualization
  - [ ] TradingView charts with indicators (Ichimoku, VWAP, Fibonacci)
  - [ ] Volume bubble detection
  - [ ] Discord/Telegram webhook integration
  
- [ ] Social proof & metrics:
  - [ ] Live alert counter (public API endpoint)
  - [ ] Number of tracked pairs (200+)
  - [ ] Real-time status badge
  
- [ ] Pricing section (if applicable):
  - [ ] Free tier features
  - [ ] Premium features (if planned)
  
- [ ] Footer:
  - [ ] Links: About, Privacy Policy, Terms of Service, GitHub
  - [ ] Contact/Support info

**Files to Create**:
```
src/pages/
  ├── LandingPage.tsx           # Main landing page
  ├── PricingSection.tsx        # Pricing tiers
  ├── FeatureShowcase.tsx       # Feature cards
  └── HeroSection.tsx           # Hero with CTA

src/components/marketing/
  ├── FeatureCard.tsx           # Reusable feature card
  ├── LiveMetrics.tsx           # Real-time stats display
  └── CTAButton.tsx             # Styled CTA buttons
```

### 1.2 Route Structure
**Goal**: Set up public/private route system

**Tasks**:
- [ ] Install React Router v6 (if not already): `npm install react-router-dom`
- [ ] Create route configuration:
  ```typescript
  // Public routes (no auth required)
  /                    → LandingPage
  /login               → Login page (redirect if authenticated)
  /signup              → Signup page (redirect if authenticated)
  /privacy             → Privacy Policy
  /terms               → Terms of Service
  
  // Protected routes (auth required)
  /app                 → Main app (current screener)
  /app/alerts          → Alert history
  /app/settings        → User settings
  /app/webhooks        → Webhook management
  ```

- [ ] Create ProtectedRoute component:
  ```typescript
  // src/components/auth/ProtectedRoute.tsx
  - Check if user is authenticated
  - Redirect to /login if not authenticated
  - Store intended destination for post-login redirect
  ```

**Files to Create/Modify**:
```
src/App.tsx                     # Add React Router setup
src/routes.tsx                  # Route definitions
src/components/auth/
  ├── ProtectedRoute.tsx        # Auth guard component
  └── PublicRoute.tsx           # Redirect if already logged in
```

---

## Phase 2: Authentication Flow (Week 1-2)

### 2.1 Enhanced Login/Signup Pages
**Goal**: Create polished authentication UI using existing backend

**Tasks**:
- [ ] Redesign Login page:
  - [ ] Modern card-based design
  - [ ] Email/password fields with validation
  - [ ] Call `authService.login(email, password)` - returns JWT + user
  - [ ] Store token in localStorage (already handled)
  - [ ] "Don't have an account? Sign up" link
  
- [ ] Redesign Signup page:
  - [ ] Email, password, confirm password
  - [ ] Password strength indicator (min 8 characters required by backend)
  - [ ] Call `authService.register(email, password)` - returns JWT + user
  - [ ] Auto-login after successful registration
  - [ ] "Already have an account? Sign in" link
  
- [ ] Password reset flow (NOT YET IMPLEMENTED):
  - ⏳ Backend needs `/auth/forgot-password` endpoint
  - ⏳ Backend needs `/auth/reset-password` endpoint  
  - ⏳ Email service integration required
  - **Skip for initial launch**, add in Phase 6

**Files to Create/Modify**:
```
src/pages/auth/
  ├── LoginPage.tsx             # Enhanced login with authService
  ├── SignupPage.tsx            # Enhanced signup with authService
  └── [later] ForgotPasswordPage.tsx

src/components/auth/
  ├── AuthCard.tsx              # Styled auth container
  └── PasswordStrength.tsx      # Password strength meter (8+ chars)
```

**Backend Integration**:
```typescript
// Login flow
const { token, user } = await authService.login(email, password)
// Token automatically stored in localStorage
// backendApi.ts automatically adds: Authorization: Bearer <token>

// Registration flow  
const { token, user } = await authService.register(email, password)
// Same auto-storage and header injection

// Logout
authService.logout() // Clears localStorage, redirects to /
```

### 2.2 Authentication State Management
**Goal**: Centralize auth state and protect all routes

**Tasks**:
- [ ] Verify existing `authService.ts` functions:
  - ✅ `login(email, password)` - Returns JWT + user
  - ✅ `register(email, password)` - Returns JWT + user
  - ✅ `logout()` - Clears token, redirects
  - ✅ `getCurrentUser()` - Fetches user from `GET /api/me`
  - ✅ `isAuthenticated()` - Checks if token exists

- [ ] Update Zustand store for auth wall:
  ```typescript
  interface AuthStore {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean  // Initial auth check
    checkAuth: () => Promise<void>  // Calls authService.getCurrentUser()
    redirectPath: string | null  // Post-login redirect
    setRedirectPath: (path: string) => void
  }
  ```

- [ ] Add auth initialization in App.tsx:
  ```typescript
  useEffect(() => {
    // Check if token exists and validate with backend
    if (authService.isAuthenticated()) {
      authService.getCurrentUser() // Validates token with GET /api/me
        .then(user => setUser(user))
        .catch(() => authService.logout()) // Invalid token
    }
  }, [])
  ```

- [ ] Handle loading states:
  - [ ] Show loading spinner while checking auth
  - [ ] Prevent flash of unauthenticated content
  - [ ] Handle token expiration (401 responses already trigger logout)

**Files to Modify**:
```
src/hooks/useStore.ts           # Add auth wall logic (or create useAuth hook)
src/App.tsx                     # Auth initialization
src/main.tsx                    # Add loading state
```

**Note**: `backendApi.ts` already handles 401 errors by calling `authService.logout()` automatically.

### 2.3 Post-Login Redirect
**Goal**: Smooth UX after login

**Tasks**:
- [ ] Capture intended destination before redirect to /login
- [ ] Store in sessionStorage or Zustand
- [ ] Redirect to captured path after successful login
- [ ] Default to /app if no captured path
- [ ] Clear captured path after redirect

**Example Flow**:
```
1. User visits /app/alerts (not logged in)
2. ProtectedRoute captures "/app/alerts"
3. Redirect to /login
4. User logs in via authService.login()
5. Redirect to /app/alerts (original destination)
```

---

## Phase 3: App Layout Changes (Week 2)

### 3.1 Landing Page Integration
**Goal**: Replace current App.tsx root with Landing/App split

**Tasks**:
- [ ] Move current screener UI to `/app` route:
  ```typescript
  // OLD: App.tsx renders screener directly
  // NEW: App.tsx renders Router with Landing or ScreenerApp
  ```

- [ ] Create ScreenerApp component:
  - [ ] Move all existing App.tsx code here
  - [ ] Keep current layout (header, controls, table, chart)
  - [ ] Add user menu to header (avatar, settings, logout)

- [ ] Update navigation:
  - [ ] Landing page header: Logo, Features, Pricing, Sign In
  - [ ] App header: Logo, Dashboard, Alerts, Settings, User Menu
  - [ ] Add logout functionality

**File Structure**:
```
src/
  ├── App.tsx                   # Router setup (landing vs app)
  ├── pages/
  │   ├── LandingPage.tsx       # Public landing
  │   └── ScreenerApp.tsx       # Main app (current App.tsx content)
  ├── layouts/
  │   ├── LandingLayout.tsx     # Public site wrapper
  │   └── AppLayout.tsx         # Authenticated app wrapper
```

### 3.2 Header/Navigation Updates
**Goal**: Different headers for public vs authenticated

**Tasks**:
- [ ] Landing Header:
  - [ ] Logo (links to /)
  - [ ] Features, Pricing, About (anchor links)
  - [ ] Sign In / Get Started buttons
  - [ ] Mobile hamburger menu
  
- [ ] App Header:
  - [ ] Logo (links to /app)
  - [ ] Navigation: Dashboard, Alerts, Settings
  - [ ] User menu dropdown:
    - Avatar/email
    - Settings
    - Billing (if applicable)
    - Logout
  - [ ] Mobile drawer

**Files to Create**:
```
src/components/layout/
  ├── LandingHeader.tsx         # Public header
  ├── AppHeader.tsx             # Authenticated header
  └── UserMenu.tsx              # User dropdown menu
```

---

## Phase 4: Backend API Protection (Week 2)

### 4.1 Enforce Authentication on All Endpoints
**Goal**: Convert all `authOptional` endpoints to `authRequired`

**Current State** (from `cmd/api-gateway/main.go`):
```go
// Mixed protection (NEEDS FIXING)
mux.HandleFunc("/api/alerts", s.cors(s.rateLimit(s.authOptional(s.handleAlerts))))
mux.HandleFunc("/api/metrics/", s.cors(s.rateLimit(s.authOptional(s.handleMetrics))))
mux.HandleFunc("/api/klines", s.cors(s.rateLimit(s.authOptional(s.handleKlines))))
mux.HandleFunc("/api/tickers", s.cors(s.rateLimit(s.authOptional(s.handleTickers))))
mux.HandleFunc("/ws/alerts", s.cors(s.authOptional(s.handleAlertsWS)))
```

**Target State**:
```go
// All protected (require valid JWT)
mux.HandleFunc("/api/alerts", s.cors(s.rateLimit(s.authMiddleware(s.handleAlerts))))
mux.HandleFunc("/api/metrics/", s.cors(s.rateLimit(s.authMiddleware(s.handleMetrics))))
mux.HandleFunc("/api/klines", s.cors(s.rateLimit(s.authMiddleware(s.handleKlines))))
mux.HandleFunc("/api/tickers", s.cors(s.rateLimit(s.authMiddleware(s.handleTickers))))
mux.HandleFunc("/ws/alerts", s.cors(s.authMiddleware(s.handleAlertsWS)))

// Keep public (no auth)
mux.HandleFunc("/auth/register", s.cors(s.rateLimit(s.handleRegister)))
mux.HandleFunc("/auth/login", s.cors(s.rateLimit(s.handleLogin)))
mux.HandleFunc("/health", s.cors(s.handleHealth))
mux.HandleFunc("/health/live", s.health.LivenessHandler())
mux.HandleFunc("/health/ready", s.health.ReadinessHandler())
```

**Tasks**:
- [ ] Replace all `authOptional` with `authMiddleware` in api-gateway routes
- [ ] Test all endpoints require Authorization header
- [ ] Verify WebSocket connection requires valid JWT
- [ ] Update OpenAPI docs (if any) to show Bearer auth required

**Files to Modify**:
```
Backend:
  cmd/api-gateway/main.go        # Change authOptional → authMiddleware
  cmd/api-gateway/middleware.go  # Already has authMiddleware ✅
```

### 4.2 Database Row-Level Security (Optional, Future Phase)
**Goal**: Add user-specific data isolation at database level

**Current State**: 
- `alert_history` table is global (no user_id column)
- All users see all alerts

**Future Enhancement** (Phase 6+):
- Add `user_id` column to `alert_history`
- Add `user_id` column to `metrics_calculated`, `candles_1m`
- Filter queries by `user_id` from JWT claims:
  ```go
  userID := mustGetUserID(r.Context()) // From authMiddleware
  query := "SELECT * FROM alert_history WHERE user_id = $1 AND time >= $2"
  ```

**Skip for initial launch** - just enforce JWT requirement first.

### 4.3 Frontend Auth Header Verification
**Goal**: Confirm frontend always sends JWT

**Tasks**:
- [ ] Verify `backendApi.ts` includes Authorization header:
  ```typescript
  // Already implemented ✅
  const token = authService.getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  ```

- [ ] Verify WebSocket connection sends auth token:
  ```typescript
  // src/services/websocketService.ts
  const token = authService.getToken()
  const ws = new WebSocket(`${WS_URL}/ws/alerts?token=${token}`)
  // OR send in first message after connection
  ```

- [ ] Handle 401 responses (already implemented):
  ```typescript
  // backendApi.ts already handles this ✅
  if (response.status === 401) {
    authService.logout() // Clears token, redirects
  }
  ```

**Files to Review**:
```
src/services/backendApi.ts      # Auth header injection ✅
src/services/websocketService.ts # WebSocket auth (TODO)
src/hooks/useMarketData.ts      # API calls via backendApi ✅
```

---

## Phase 5: Feature Access Control (Week 3)

### 5.1 Free vs Premium Tiers (Optional)
**Goal**: Differentiate feature access by tier

**Free Tier**:
- View all 200+ pairs
- 10 alert types
- Real-time updates
- Basic chart (1 indicator)
- 1 webhook

**Premium Tier** (if implementing):
- Everything in Free
- Unlimited webhooks
- Advanced charts (all indicators)
- Alert history (30 days vs 7 days)
- Priority support
- Custom alerts

**Implementation**:
- [ ] Add `subscription_tier` to user_settings table
- [ ] Create feature flag system:
  ```typescript
  const features = {
    multipleWebhooks: user.tier === 'premium',
    advancedIndicators: user.tier === 'premium',
    extendedHistory: user.tier === 'premium',
  }
  ```

- [ ] Show upgrade prompts for premium features:
  ```typescript
  {!features.multipleWebhooks && (
    <UpgradePrompt feature="Multiple Webhooks" />
  )}
  ```

**Files to Create**:
```
src/hooks/useFeatures.ts        # Feature flag hook
src/components/billing/
  ├── UpgradePrompt.tsx         # "Upgrade to Premium" card
  └── PricingPlans.tsx          # Pricing comparison
```

### 5.2 Rate Limiting & Quotas
**Goal**: Prevent abuse, enforce limits

**Tasks**:
- [ ] Add rate limits in backend:
  ```
  Free: 100 requests/minute
  Premium: 1000 requests/minute
  ```

- [ ] Show quota usage in UI:
  - [ ] API calls remaining
  - [ ] Alerts triggered this month
  - [ ] Webhooks sent this month

- [ ] Handle rate limit errors gracefully:
  - [ ] Show "Rate limit exceeded" message
  - [ ] Suggest upgrade or wait time

---

## Phase 6: Analytics & Monitoring (Week 3)

### 6.1 User Analytics
**Goal**: Track user engagement and conversion

**Tasks**:
- [ ] Add analytics provider (e.g., PostHog, Plausible, Google Analytics):
  ```typescript
  // Track events
  analytics.track('user_signed_up')
  analytics.track('alert_created', { type: 'big_bull_60' })
  analytics.track('webhook_configured', { platform: 'discord' })
  ```

- [ ] Landing page conversions:
  - [ ] CTA button clicks
  - [ ] Sign up completions
  - [ ] Email verifications
  
- [ ] Feature usage:
  - [ ] Most viewed pairs
  - [ ] Most triggered alerts
  - [ ] Chart interactions

**Files to Create**:
```
src/lib/analytics.ts            # Analytics wrapper
src/hooks/useAnalytics.ts       # React hook
```

### 6.2 Error Monitoring
**Goal**: Track auth-related errors

**Tasks**:
- [ ] Add error tracking (Sentry, LogRocket):
  ```typescript
  // Track auth errors
  Sentry.captureException(error, {
    tags: { component: 'auth' }
  })
  ```

- [ ] Monitor auth failures:
  - [ ] Login failures
  - [ ] Token expiration
  - [ ] Network errors
  - [ ] Session conflicts

---

## Phase 7: Testing & QA (Week 4)

### 7.1 Auth Flow Testing
**Goal**: Ensure smooth auth experience

**Test Cases**:
- [ ] Sign up flow:
  - [ ] Valid email/password
  - [ ] Invalid email format
  - [ ] Weak password
  - [ ] Email already exists
  - [ ] Email verification required
  
- [ ] Login flow:
  - [ ] Valid credentials
  - [ ] Invalid credentials
  - [ ] Unverified email
  - [ ] Password reset
  - [ ] Remember me functionality
  
- [ ] Protected routes:
  - [ ] Redirect to login when unauthenticated
  - [ ] Access granted when authenticated
  - [ ] Post-login redirect to intended page
  - [ ] Logout clears session
  
- [ ] Token handling:
  - [ ] Refresh token on expiration
  - [ ] Handle 401 responses
  - [ ] Clear invalid tokens
  - [ ] Persist session across page refreshes

### 7.2 E2E Testing
**Goal**: Automated testing with Playwright

**Tasks**:
- [ ] Install Playwright: `npm install -D @playwright/test`
- [ ] Create test suite:
  ```typescript
  test('complete signup and access app', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Get Started')
    // ... fill form, verify email, access app
  })
  ```

- [ ] Test scenarios:
  - [ ] New user journey (signup → verify → login → use app)
  - [ ] Returning user (login → use app)
  - [ ] Password reset flow
  - [ ] Session expiration handling

**Files to Create**:
```
tests/e2e/
  ├── auth.spec.ts              # Auth flow tests
  ├── landing.spec.ts           # Landing page tests
  └── protected-routes.spec.ts  # Route protection tests
```

---

## Phase 8: Deployment & Migration (Week 4)

### 8.1 Database Migration
**Goal**: Add auth-related tables if not exists

**Tasks**:
- [ ] Ensure Supabase tables exist:
  ```sql
  -- user_settings (should exist)
  -- user_alert_subscriptions (should exist)
  -- Add missing columns if needed
  ```
---

## Phase 8: Deployment & Rollout (Week 4)

### 8.1 Backend Preparation
**Goal**: Finalize backend auth enforcement

**Tasks**:
- [ ] Update Railway environment variables:
  ```env
  JWT_SECRET=<strong-random-secret>  # Generate with: openssl rand -base64 32
  DATABASE_URL=<timescaledb-connection-string>
  NATS_URL=nats://localhost:4222
  REDIS_URL=<redis-connection-string>
  ```

- [ ] Convert all `authOptional` to `authMiddleware` in api-gateway
- [ ] Test backend endpoints require valid JWT
- [ ] Deploy to Railway: `git push origin main` (auto-deploy)
- [ ] Verify health checks pass: `curl https://api-gateway-xxx.railway.app/health`

### 8.2 Frontend Environment Configuration
**Goal**: Configure for production deployment

**Tasks**:
- [ ] Update Vercel environment variables:
  ```env
  VITE_BACKEND_API_URL=https://api-gateway-production-f4ba.up.railway.app
  VITE_APP_URL=https://screener.yourdomain.com
  ```

- [ ] Remove any Supabase references (already done ✅)
- [ ] Verify `authService.ts` points to Railway backend
- [ ] Test login/register against production backend

### 8.3 Gradual Rollout Strategy
**Goal**: Minimize disruption for existing users (if any)

**Option 1: Hard Cutover** (Recommended for MVP)
- [ ] Deploy auth wall immediately
- [ ] Show signup page as default route
- [ ] No existing users to migrate

**Option 2: Soft Launch** (If app already has users)
- [ ] Deploy with feature flag: `VITE_REQUIRE_AUTH=false`
- [ ] Show banner: "Sign up to unlock premium features"
- [ ] Enable auth wall after 2 weeks
- [ ] Migrate existing localStorage preferences to user accounts

**Recommended: Hard Cutover** (since app is in development)
1. Deploy landing page + auth wall
2. Require signup for all access
3. Monitor error rates in first 24 hours

### 8.4 Deployment Checklist
**Pre-deployment**:
- [ ] All tests passing (`npm test`)
- [ ] Type checks passing (`npm run type-check`)
- [ ] Backend auth middleware enabled
- [ ] Railway backend deployed with JWT_SECRET set
- [ ] Landing page content finalized
- [ ] Login/Signup pages tested locally

**Deployment**:
- [ ] Build production bundle: `npm run build`
- [ ] Deploy to Vercel: `vercel --prod`
- [ ] Smoke test: Signup → Login → Use app
- [ ] Monitor error rates (check Railway logs)
- [ ] Check WebSocket connectivity with auth token
- [ ] Verify backend API authentication (401 for unauthenticated requests)

**Post-deployment**:
- [ ] Test full auth flow (signup, login, logout, protected routes)
- [ ] Verify alert history loads with JWT
- [ ] Verify watchlist CRUD operations work
- [ ] Check webhook configuration requires auth
- [ ] Monitor Railway logs for auth errors

---

## Technical Implementation Details

### Route Protection Pattern
```typescript
// src/components/auth/ProtectedRoute.tsx
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  
  useEffect(() => {
    if (!isLoading && !user) {
      // Store intended destination
      sessionStorage.setItem('redirectPath', location.pathname)
    }
  }, [isLoading, user, location])
  
  if (isLoading) {
    return <LoadingScreen />
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}
```

### App.tsx Structure
```typescript
// src/App.tsx
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        {/* Protected routes */}
        <Route path="/app" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ScreenerApp />} />
          <Route path="alerts" element={<AlertHistory />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

### Authentication Hook (Custom Backend)
```typescript
// src/hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    // Check if token exists
    if (authService.isAuthenticated()) {
      // Validate token with backend
      authService.getCurrentUser()
        .then(user => {
          setUser(user)
          setIsLoading(false)
        })
        .catch(() => {
          // Token invalid, clear it
          authService.logout()
          setUser(null)
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [])
  
  const login = async (email: string, password: string) => {
    const { user } = await authService.login(email, password)
    setUser(user)
  }
  
  const logout = () => {
    authService.logout()
    setUser(null)
  }
  
  return { user, isLoading, login, logout }
}
```

### Backend Auth Middleware (Already Implemented)
```go
// cmd/api-gateway/middleware.go
func (s *server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "Missing authorization header",
			})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "Invalid authorization header format",
			})
			return
		}

		claims, err := s.authService.ValidateToken(parts[1])
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "Invalid or expired token",
			})
			return
		}

		// Inject user context for handlers
		ctx := withUserID(r.Context(), claims.UserID)
		ctx = withUserEmail(ctx, claims.Email)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}
```

---

## Success Metrics

### Week 1-2 (Launch)
- [ ] Landing page live
- [ ] Signup conversion rate > 5%
- [ ] Login success rate > 95%
- [ ] < 1% auth errors

### Week 3-4 (Growth)
- [ ] 100+ registered users
- [ ] 50+ daily active users
- [ ] Average session time > 5 minutes
- [ ] Feature usage tracked

### Month 1-3 (Retention)
- [ ] 30-day retention > 40%
- [ ] 90-day retention > 20%
- [ ] < 5% churn rate

---

## Risks & Mitigation

### Risk 1: Users Don't Want to Sign Up
**Mitigation**:
- Show clear value proposition on landing page
- Fast signup process (email + password only)
- Demo video or screenshots showing features
- No email verification required initially (add later)

### Risk 2: Auth Bugs Block Users
**Mitigation**:
- Comprehensive testing before launch
- Monitor Railway logs for auth errors
- Quick rollback plan (re-enable `authOptional`)
- Support channel for blocked users (GitHub issues)

### Risk 3: Performance Degradation
**Mitigation**:
- JWT validation is fast (<1ms)
- Database connection pooling already implemented
- Cache user lookups if needed (Redis)
- Monitor Railway metrics (CPU, memory, latency)

### Risk 4: WebSocket Auth Complexity
**Mitigation**:
- Send token in WebSocket URL: `/ws/alerts?token=xxx`
- OR send token in first message after connection
- Implement connection retry with fresh token
- Log WebSocket auth failures separately

---

## Next Steps

1. **Review this roadmap** - Adjust timeline and priorities
2. **Start with Phase 1** - Design landing page wireframes
3. **Implement Phase 2** - Login/Signup pages with authService integration
4. **Backend Phase 4** - Change all `authOptional` to `authMiddleware`
5. **Test thoroughly** - Full auth flow before production deployment
6. **Deploy gradually** - Monitor errors, be ready to rollback

**Estimated Timeline**: 2-3 weeks for MVP (Phases 1-4)  
**Optional Features** (Phase 5-7): Add after successful launch


3. **Decide on pricing model** - Free only, or Free + Premium?
4. **Start Phase 1** - Landing page + route structure
5. **Set up project tracking** - GitHub Projects or Notion

**Estimated Total Time**: 3-4 weeks  
**Priority**: Start with Phase 1 (Landing Page + Routes)
