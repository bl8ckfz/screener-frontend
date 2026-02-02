# Frontend Auth - Quick Reference

## Start Services

```bash
# Backend (Terminal 1)
cd screener-backend
JWT_SECRET="test-secret" ./bin/api-gateway

# Frontend (Terminal 2)
cd screener-frontend
npm run dev
```

## Test Auth Flow

```bash
./test-auth-flow.sh
```

## API Endpoints

```bash
# Register
POST http://localhost:8080/auth/register
{
  "email": "test@example.com",
  "password": "password123"
}

# Login
POST http://localhost:8080/auth/login
{
  "email": "test@example.com",
  "password": "password123"
}

# Get Current User (protected)
GET http://localhost:8080/api/me
Authorization: Bearer <token>

# Refresh Token (protected)
POST http://localhost:8080/api/refresh
Authorization: Bearer <token>
```

## Frontend Usage

```tsx
// In any component
import { useAuth } from '@/hooks/useAuth'

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth()

  return (
    <div>
      {isAuthenticated ? (
        <button onClick={logout}>Logout {user.email}</button>
      ) : (
        <button onClick={() => login('email', 'pass')}>Login</button>
      )}
    </div>
  )
}
```

## Check Auth State

```javascript
// Browser console
localStorage.getItem('auth_token')    // JWT token
localStorage.getItem('auth_user')     // User object
```

## Files Changed

```
src/services/authService.ts         - NEW (JWT API client)
src/hooks/useAuth.tsx                - NEW (React Context)
src/components/auth/AuthModal.tsx   - UPDATED (JWT form)
src/components/auth/UserMenu.tsx    - UPDATED (useAuth hook)
src/services/backendApi.ts          - UPDATED (token injection)
src/main.tsx                         - UPDATED (AuthProvider)
```

## Docs

- [AUTH_COMPLETE.md](./AUTH_COMPLETE.md) - Summary
- [TEST_AUTH.md](./TEST_AUTH.md) - Testing guide
- [docs/AUTH_IMPLEMENTATION.md](./docs/AUTH_IMPLEMENTATION.md) - Implementation details
