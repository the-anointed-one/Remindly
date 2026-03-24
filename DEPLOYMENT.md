# Meetora — Deployment & Rollback Guide

## Deployment Order

1. **Database Migrations** (always first)
   ```bash
   docker compose exec api npx prisma migrate deploy
   ```
   Migrations applied in this release:
   - `20260324144945_add_usage_tracking` — adds `contact_count`, `event_count`, `automation_executions_this_month`, `last_reset_date` to `tenants`
   - `20260324152609_add_ai_token_tracking` — adds `prompt_tokens`, `completion_tokens` to `ai_usage_logs`

2. **Environment Variable Updates**
   Ensure `.env` (and production secrets) contain:
   ```env
   PAYSTACK_CURRENCY=USD
   DEFAULT_PLAN_PRICES={"starter":1900,"growth":4900,"pro":9900}
   X_QA_BYPASS_TOKEN="secret_qa_token_2026"
   WORKER_CONCURRENCY=10
   WORKER_COUNT=2
   ```

3. **Backend / Worker Services**
   ```bash
   docker compose up -d --build
   # Scale workers independently
   docker compose up -d --scale worker=2 --scale campaign-worker=2
   ```

4. **Paystack Plan Creation (manual)**
   Create three recurring USD plans in the Paystack dashboard:
   | Plan | Amount | Interval |
   |------|--------|----------|
   | Starter | $19.00 | Monthly |
   | Growth | $49.00 | Monthly |
   | Pro | $99.00 | Monthly |
   Copy the plan codes into env vars: `PAYSTACK_SMS_PLAN_CODE`, etc.

---

## Rollback Plan

### Database Rollback
Each migration is reversible. To roll back the most recent migration:
```bash
# Revert the AI token tracking migration
docker compose exec api npx prisma migrate resolve --rolled-back 20260324152609_add_ai_token_tracking

# Revert the usage tracking migration
docker compose exec api npx prisma migrate resolve --rolled-back 20260324144945_add_usage_tracking
```
> ⚠️ Rolling back will discard any `prompt_tokens`/`completion_tokens` data written since deployment.

### Feature Flags
- **QA Bypass**: Remove `X_QA_BYPASS_TOKEN` from production env to disable the `/qa-simulate` endpoint entirely.
- **USD Billing**: Revert `PAYSTACK_CURRENCY=NGN` and `DEFAULT_PLAN_PRICES` to restore NGN pricing.
- **Worker Concurrency**: Set `WORKER_CONCURRENCY=5` to return to the original default.

---

## Post-Deployment Validation

```bash
# 1. Database migrations applied
docker compose exec api npx prisma migrate status

# 2. Worker concurrency configured
docker compose exec worker env | grep WORKER_CONCURRENCY
# Expected: WORKER_CONCURRENCY=10

# 3. Analytics hero metrics endpoint
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/api/analytics/hero-metrics?excludeDemo=true" \
  -H "Authorization: Bearer <JWT>" \
  -H "X-Tenant-ID: <TENANT_ID>"
# Expected: 200

# 4. Analytics dashboard (primary endpoint)
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/api/analytics/dashboard" \
  -H "Authorization: Bearer <JWT>"
# Expected: 200

# 5. Health check
curl -s http://localhost:3000/api/health | jq .status
# Expected: "ok"

# 6. RSVP normalization test
# "Yes " (with space) → confirmed ✓
# "YES" → confirmed ✓
# "nope" → declined ✓
# "maybe" → maybe ✓

# 7. Usage limits enforced
docker compose exec postgres psql -U remindly -d remindly \
  -c "SELECT contact_limit, contact_count, event_limit, event_count FROM tenants LIMIT 3;"

# 8. Monthly reset cron registered
docker compose logs api --tail=30 | grep -i "schedule\|usage reset"
```

---

## Monitoring Alerts to Configure

| Alert | Condition | Severity |
|-------|-----------|----------|
| Billing failure | Paystack webhook returns non-200 | P0 |
| Automation loop | `AutomationExecutionTracker` WARN log | P1 |
| Usage limit breach | `ForbiddenException` on plan guard | P1 |
| Queue backpressure | BullMQ `waiting` count > 500 | P1 |
| Worker crash | Container restart count > 3 | P2 |
