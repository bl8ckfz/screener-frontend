#!/bin/bash

# Frontend Authentication Quick Start
# Tests the complete auth flow with backend

set -e

echo "🚀 Starting Frontend Auth Test..."
echo ""

# Check if backend is running
echo "📡 Checking if backend is running..."
if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "❌ Backend not running at http://localhost:8080"
    echo ""
    echo "Start backend first:"
    echo "  cd ../screener-backend"
    echo "  JWT_SECRET='test-secret' ./bin/api-gateway"
    echo ""
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Test backend auth endpoints
echo "🔐 Testing backend /auth/register endpoint..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-$(date +%s)@example.com\",\"password\":\"password123\"}" || echo "FAILED")

if [[ "$REGISTER_RESPONSE" == "FAILED" ]] || [[ "$REGISTER_RESPONSE" == *"error"* ]]; then
    echo "❌ Registration endpoint failed"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

echo "✅ Registration endpoint working"
echo ""

# Extract token from response
TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ No token in response"
    exit 1
fi

echo "🎟️  Got JWT token: ${TOKEN:0:20}..."
echo ""

# Test protected endpoint with token
echo "🔒 Testing protected endpoint /api/me..."
ME_RESPONSE=$(curl -s http://localhost:8080/api/me \
  -H "Authorization: Bearer $TOKEN" || echo "FAILED")

if [[ "$ME_RESPONSE" == "FAILED" ]] || [[ "$ME_RESPONSE" == *"error"* ]]; then
    echo "❌ Protected endpoint failed"
    echo "Response: $ME_RESPONSE"
    exit 1
fi

echo "✅ Protected endpoint working"
echo ""

# Check if frontend is running
echo "🌐 Checking if frontend is running..."
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "⚠️  Frontend not running at http://localhost:3000"
    echo ""
    echo "Start frontend:"
    echo "  npm run dev"
    echo ""
    echo "Then open: http://localhost:3000"
    echo ""
else
    echo "✅ Frontend is running"
    echo ""
    echo "🎉 All backend checks passed!"
    echo ""
fi

# Print manual test instructions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Manual Testing Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open: http://localhost:3000"
echo "2. Click 'Sign In' button in header"
echo "3. Click 'Sign up' link"
echo "4. Enter test credentials:"
echo "   Email: test@example.com"
echo "   Password: password123"
echo "5. Click 'Create Account'"
echo ""
echo "Expected: Modal closes, email appears in header"
echo ""
echo "6. Open DevTools → Application → Local Storage"
echo "   Check: auth_token, auth_user keys exist"
echo ""
echo "7. Refresh page (F5)"
echo "   Check: Still logged in"
echo ""
echo "8. Click avatar → Sign Out"
echo "   Check: Token cleared, 'Sign In' button appears"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Full testing guide: TEST_AUTH.md"
echo "📖 Implementation docs: docs/AUTH_IMPLEMENTATION.md"
echo ""
