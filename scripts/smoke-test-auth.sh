#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Meetora Auth Smoke Test
# Usage: ./scripts/smoke-test-auth.sh [BASE_URL]
# Default BASE_URL: http://localhost:3000/api
# ─────────────────────────────────────────────────
set -euo pipefail

BASE="${1:-http://localhost:3000/api}"
EMAIL="smoketest_$(date +%s)@meetora-test.dev"
PASSWORD="SmokeTest123!"
PASS=0
FAIL=0

green() { printf "\033[32m✓ %s\033[0m\n" "$*"; }
red()   { printf "\033[31m✗ %s\033[0m\n" "$*"; }
hdr()   { printf "\n\033[1;34m── %s\033[0m\n" "$*"; }

# Split response body and status code
# curl -w "\nSTATUS:%{http_code}" → body ends with \nSTATUS:NNN
body()   { echo "$1" | sed 's/STATUS:[0-9]*$//;s/[[:space:]]*$//'; }
status() { echo "$1" | grep -o 'STATUS:[0-9]*' | cut -d: -f2; }

check() {
  local label="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    green "$label"; ((PASS++)) || true
  else
    red "$label (want: '$expected', got: '$actual')"; ((FAIL++)) || true
  fi
}

check_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    green "$label (HTTP $actual)"; ((PASS++)) || true
  else
    red "$label (want HTTP $expected, got HTTP $actual)"; ((FAIL++)) || true
  fi
}

# ── 0. Health ──────────────────────────────────
hdr "0. Health check"
R=$(curl -s -w "\nSTATUS:%{http_code}" "$BASE/health/live")
check_status "GET /health/live" "200" "$(status "$R")"

# ── 1. Register ────────────────────────────────
hdr "1. Register"

R=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"tenantName\":\"Smoke Corp\",\"firstName\":\"Smoke\",\"lastName\":\"Test\"}")
check_status "POST /auth/register (valid)" "201" "$(status "$R")"
check "Response has accessToken"  "accessToken"  "$(body "$R")"
check "Response has refreshToken" "refreshToken" "$(body "$R")"

ACCESS_TOKEN=$(body  "$R" | grep -o '"accessToken":"[^"]*"'  | cut -d'"' -f4)
REFRESH_TOKEN=$(body "$R" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)

R2=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"tenantName\":\"Smoke Corp\"}")
check_status "POST /auth/register (duplicate)" "409" "$(status "$R2")"

R3=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"notanemail","password":"short"}')
check_status "POST /auth/register (invalid body)" "400" "$(status "$R3")"

# ── 2. Login ───────────────────────────────────
hdr "2. Login"

R=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
check_status "POST /auth/login (valid)" "200" "$(status "$R")"
check "Login response has accessToken" "accessToken" "$(body "$R")"
ACCESS_TOKEN=$(body  "$R" | grep -o '"accessToken":"[^"]*"'  | cut -d'"' -f4)
REFRESH_TOKEN=$(body "$R" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)

R2=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPassword1!\"}")
check_status "POST /auth/login (wrong password)" "401" "$(status "$R2")"

R3=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@nowhere.dev","password":"Whatever1!"}')
check_status "POST /auth/login (unknown email)" "401" "$(status "$R3")"

R4=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{}')
check_status "POST /auth/login (empty body)" "400" "$(status "$R4")"

# ── 3. JWT guard ───────────────────────────────
hdr "3. JWT guard"

R=$(curl -s -w "\nSTATUS:%{http_code}" "$BASE/usage" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
check_status "GET /usage (valid token)" "200" "$(status "$R")"

R2=$(curl -s -w "\nSTATUS:%{http_code}" "$BASE/usage")
check_status "GET /usage (no token)" "401" "$(status "$R2")"

R3=$(curl -s -w "\nSTATUS:%{http_code}" "$BASE/usage" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}TAMPERED")
check_status "GET /usage (tampered token)" "401" "$(status "$R3")"

# ── 4. Token refresh ──────────────────────────
hdr "4. Token refresh"

R=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REFRESH_TOKEN" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
check_status "POST /auth/refresh (valid)" "200" "$(status "$R")"
check "Refresh response has new accessToken" "accessToken" "$(body "$R")"

NEW_ACCESS=$(body "$R" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

R2=$(curl -s -w "\nSTATUS:%{http_code}" "$BASE/usage" \
  -H "Authorization: Bearer $NEW_ACCESS")
check_status "Refreshed token works on protected route" "200" "$(status "$R2")"

# ── 5. Logout ─────────────────────────────────
hdr "5. Logout"

R=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/logout" \
  -H "Authorization: Bearer $NEW_ACCESS")
check_status "POST /auth/logout" "200" "$(status "$R")"

# ── 6. Forgot password (no enumeration) ───────
hdr "6. Forgot password"

R=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}")
check_status "POST /auth/forgot-password (known email → 200)" "200" "$(status "$R")"

R2=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@meetora-test.dev"}')
check_status "POST /auth/forgot-password (unknown email → 200, no enumeration)" "200" "$(status "$R2")"

R3=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"notanemail"}')
check_status "POST /auth/forgot-password (invalid email → 400)" "400" "$(status "$R3")"

# ── 7. Reset password (bad token) ─────────────
hdr "7. Reset password"

R=$(curl -s -w "\nSTATUS:%{http_code}" -X POST "$BASE/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{"token":"definitely-not-a-real-token","newPassword":"NewPass123!"}')
S=$(status "$R")
if [ "$S" = "400" ] || [ "$S" = "404" ]; then
  green "POST /auth/reset-password (bad token → HTTP $S)"; ((PASS++)) || true
else
  red "POST /auth/reset-password (bad token, want 400/404, got HTTP $S)"; ((FAIL++)) || true
fi

# ── Summary ───────────────────────────────────
printf "\n\033[1m────────────────────────────────\033[0m\n"
printf "\033[32mPASSED: %d\033[0m  " "$PASS"
printf "\033[31mFAILED: %d\033[0m\n" "$FAIL"
printf "\033[1m────────────────────────────────\033[0m\n"

[ "$FAIL" -eq 0 ]
