#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Meetora pre-flight check
# Run before first deploy: bash scripts/preflight.sh
# Exits non-zero if any required var is missing or still set to localhost.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

check_required() {
  local var="$1"
  local val="${!var:-}"
  if [[ -z "$val" ]]; then
    echo -e "${RED}✗ MISSING${NC}  $var"
    ((ERRORS++))
  else
    echo -e "${GREEN}✓ OK${NC}       $var"
  fi
}

check_not_localhost() {
  local var="$1"
  local val="${!var:-}"
  if [[ -z "$val" ]]; then
    echo -e "${RED}✗ MISSING${NC}  $var"
    ((ERRORS++))
  elif echo "$val" | grep -qiE 'localhost|127\.0\.0\.1'; then
    echo -e "${RED}✗ LOCALHOST${NC} $var  →  $val"
    ((ERRORS++))
  else
    echo -e "${GREEN}✓ OK${NC}       $var"
  fi
}

check_not_placeholder() {
  local var="$1"
  local val="${!var:-}"
  if [[ -z "$val" ]]; then
    echo -e "${RED}✗ MISSING${NC}  $var"
    ((ERRORS++))
  elif echo "$val" | grep -qiE 'REPLACE|YOUR_|your_|xxxxxxx'; then
    echo -e "${RED}✗ PLACEHOLDER${NC} $var"
    ((ERRORS++))
  else
    echo -e "${GREEN}✓ OK${NC}       $var"
  fi
}

check_warn() {
  local var="$1"
  local val="${!var:-}"
  if [[ -z "$val" ]]; then
    echo -e "${YELLOW}⚠ OPTIONAL${NC} $var  (feature disabled if missing)"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✓ OK${NC}       $var"
  fi
}

# Load .env if present
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo ""
echo "════════════════════════════════════════════"
echo "  Meetora Pre-flight Check"
echo "════════════════════════════════════════════"

echo ""
echo "── Database ─────────────────────────────────"
check_not_localhost DATABASE_URL
check_not_placeholder DB_PASSWORD

echo ""
echo "── JWT ──────────────────────────────────────"
check_not_placeholder JWT_SECRET
check_not_placeholder JWT_REFRESH_SECRET

echo ""
echo "── URLs (must be production domain) ─────────"
check_not_localhost CORS_ORIGINS
check_not_localhost FRONTEND_URL
check_not_localhost NEXT_PUBLIC_API_URL
check_not_localhost TWILIO_WEBHOOK_URL
check_not_localhost PAYSTACK_CALLBACK_URL

echo ""
echo "── Twilio ───────────────────────────────────"
check_not_placeholder TWILIO_ACCOUNT_SID
check_not_placeholder TWILIO_AUTH_TOKEN
check_required TWILIO_PHONE_NUMBER
check_required TWILIO_WEBHOOK_URL

echo ""
echo "── Email (Resend) ───────────────────────────"
check_not_placeholder RESEND_API_KEY
check_required SMTP_FROM

echo ""
echo "── Paystack ─────────────────────────────────"
check_not_placeholder PAYSTACK_SECRET_KEY
check_not_placeholder PAYSTACK_WEBHOOK_SECRET
check_required PAYSTACK_SMS_PLAN_CODE

# Warn if still on test keys
PAYSTACK_KEY="${PAYSTACK_SECRET_KEY:-}"
if echo "$PAYSTACK_KEY" | grep -q 'sk_test_'; then
  echo -e "${YELLOW}⚠ WARN${NC}      PAYSTACK_SECRET_KEY is a TEST key — payments won't be real"
  ((WARNINGS++))
fi

echo ""
echo "── OpenAI ───────────────────────────────────"
check_not_placeholder OPENAI_API_KEY

echo ""
echo "── Queue Dashboard ──────────────────────────"
check_not_placeholder QUEUE_BASIC_AUTH_USER
check_not_placeholder QUEUE_BASIC_AUTH_PASS

echo ""
echo "── Optional ─────────────────────────────────"
check_warn GOOGLE_CLIENT_ID
check_warn GOOGLE_CLIENT_SECRET

echo ""
echo "════════════════════════════════════════════"
if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}✗ $ERRORS error(s) found — fix before deploying${NC}"
  if [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s)${NC}"
  fi
  echo ""
  exit 1
else
  echo -e "${GREEN}✓ All checks passed${NC}"
  if [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}⚠ $WARNINGS optional warning(s)${NC}"
  fi
  echo ""
  echo "  Ready to deploy. Run:"
  echo "  docker compose up -d --build"
  echo ""
fi
