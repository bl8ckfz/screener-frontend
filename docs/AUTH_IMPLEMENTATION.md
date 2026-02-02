# Frontend Authentication Implementation Summary

## Overview

Implemented complete user authentication UI for screener-frontend that connects to the Go backend's JWT authentication system.

**Date**: December 2024  
**Phase**: User Watchlist & Webhook Migration - Phase 1.5 (Frontend Auth UI)

## Files Created

### 1. `/src/services/authService.ts`
- **Purpose**: Client-side auth service for JWT authentication
- **Features**:
  - `register(email, password)` - Create new user account
  - `login(email, password)` - Authenticate user
  - `logout()` - Clear session
  - `getCurrentUser()` - Fetch user from backend
  - `refreshToken()` - Refresh JWT token
  - Token management (localStorage)
- **Dependencies**: axios

### 2. `/src/hooks/useAuth.tsx`
- **Purpose**: React Context + Hook for auth state
- **Features**:
  - `AuthProvider` component wrapper
  - `useAuth()` hook for components
  - Auto-loads user on mount
  - Validates token with backend
- **State**: `user`, `loading`, `isAuthenticated`

### 3. `/src/components/auth/AuthModal.tsx` (Updated)
- **Purpose**: Login/Register modal UI
- **Previous**: Supabase Auth UI
- **Now**: Custom form for backend JWT auth
- **Features**:
  - Toggle between login/register modes
  - Email + password validation
  - Error handling
  - Loading states

### 4. `/src/components/auth/UserMenu.tsx` (Updated)
- **Purpose**: User dropdown menu in header
- **Previous**: Used Zustand store with Supabase
- **Now**: Uses `useAuth()` hook with backend
- **Features**:
  - Shows user email and avatar
  - Member since date
  - Sign out button

## Files Modified

### 1. `/src/main.tsx`
- Added `<AuthProvider>` wrapper around `<App>`
- Provides auth context to all components

### 2. `/src/services/backendApi.ts`
- Added JWT token injection to all requests
- Auto-includes `Authorization: Bearer <token>` header
- Auto-logout on 401 Unauthorized
- Import authService for token access

## Integration Points

### Backend API Endpoints Used
```
POST /auth/register  → Register new user
POST /auth/login     → Login and get JWT
GET  /api/me         → Get current user (protected)
POST /api/refresh    → Refresh JWT token (protected)
```

### Token Storage
- **Token**: `localStorage.auth_token` 
- **User**: `localStorage.auth_user`
- **Format**: JWT (24h expiration)

### Auto-Authentication
- `AuthProvider` loads user on mount
- Validates token with `GET /api/me`
- Clears session if token invalid

## User Flow

```
1. User clicks "Sign In" button in header
   ↓
2. AuthModal opens with login form
   ↓
3. User enters email + password
   ↓
4. authService.login() calls backend /auth/login
   ↓
5. Backend returns { user, token }
   ↓
6. Token + user stored in localStorage
   ↓
7. AuthProvider updates context state
   ↓
8. UserMenu shows logged-in state
   ↓
9. All subsequent API calls include JWT token
```

## Security Features

1. **Token Validation**: Every API request validates JWT
2. **Auto-Logout**: 401 responses clear session automatically
3. **Password Requirements**: Minimum 8 characters enforced
4. **HTTPS Ready**: Works with secure cookies in production
5. **XSS Protection**: LocalStorage-only (no eval/innerHTML)

## Testing

See [TEST_AUTH.md](./TEST_AUTH.md) for complete testing guide.

**Quick Test**:
```bash
# Terminal 1: Start backend
cd ../screener-backend
JWT_SECRET="test-secret" ./bin/api-gateway

# Terminal 2: Start frontend
cd ../screener-frontend
npm run dev

# Browser: http://localhost:3000
# Click "Sign In" → Register → Login
```

## Known Limitations

1. **Supabase Code**: Old Supabase auth still in App.tsx (will be removed in Phase 3)
2. **Token Refresh**: No auto-refresh before expiration (24h TTL)
3. **Remember Me**: No persistent session beyond localStorage
4. **Password Reset**: Not implemented yet
5. **Email Verification**: Not implemented yet

## Next Steps

### Phase 2: Watchlist API Integration
- Create `/api/watchlist` endpoints in backend
- Add watchlist CRUD UI in frontend
- Connect to user authentication

### Phase 3: Webhook API Integration  
- Create `/api/webhooks` endpoints in backend
- Add webhook settings UI in frontend
- Connect to user authentication

### Phase 4: Remove Supabase
- Remove all Supabase dependencies
- Migrate existing users (if any)
- Update deployment configs

## Dependencies Added

```json
{
  "axios": "^1.6.0"  // HTTP client for auth API calls
}
```

## Environment Variables

Required in `.env.local`:
```env
VITE_BACKEND_API_URL=http://localhost:8080
VITE_BACKEND_WS_URL=ws://localhost:8080/ws/alerts
VITE_USE_BACKEND_API=true
```

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│         Frontend (React/TypeScript)         │
├─────────────────────────────────────────────┤
│                                             │
│  AuthProvider (Context)                     │
│    ├── useAuth() hook                       │
│    ├── user state                           │
│    └── loading state                        │
│                                             │
│  Components                                 │
│    ├── AuthModal (login/register form)      │
│    └── UserMenu (user dropdown)             │
│                                             │
│  Services                                   │
│    ├── authService.ts (JWT calls)           │
│    └── backendApi.ts (token injection)      │
│                                             │
│  Storage: localStorage                      │
│    ├── auth_token (JWT)                     │
│    └── auth_user (User object)              │
│                                             │
└─────────────────┬───────────────────────────┘
                  │
                  │ HTTP (Authorization: Bearer <token>)
                  │
┌─────────────────▼───────────────────────────┐
│            Backend (Go)                     │
├─────────────────────────────────────────────┤
│                                             │
│  API Gateway (port 8080)                    │
│    ├── POST /auth/register                  │
│    ├── POST /auth/login                     │
│    ├── GET  /api/me                         │
│    └── POST /api/refresh                    │
│                                             │
│  Auth Service (/pkg/auth/)                  │
│    ├── JWT generation                       │
│    ├── Password hashing (bcrypt)            │
│    └── Token validation                     │
│                                             │
│  Database (TimescaleDB)                     │
│    └── users table                          │
│                                             │
└─────────────────────────────────────────────┘
```

## Commit Message

```
feat(auth): Implement frontend JWT authentication UI

- Add authService.ts for backend API calls (register/login/logout)
- Add useAuth hook with AuthProvider context
- Update AuthModal to use custom JWT login (replace Supabase)
- Update UserMenu to use useAuth hook
- Update backendApi to inject JWT tokens in headers
- Add auto-logout on 401 responses
- Add loading states and error handling
- Add TEST_AUTH.md testing guide

Connects to Phase 1.5 backend auth implementation.
Next: Phase 2 - Watchlist CRUD API integration
```
