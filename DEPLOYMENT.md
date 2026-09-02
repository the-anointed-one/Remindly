# Meetora — Deployment & Rollback Guide

> **Deploying to Railway + Vercel?** Use
> [`DEPLOY_RAILWAY_VERCEL.md`](./DEPLOY_RAILWAY_VERCEL.md) instead. That is the
> current production path. This file documents the self-hosted
> VPS + docker-compose path, whose GitHub Actions workflow is now
> `workflow_dispatch`-only.

---

## DevOps Setup (one-time)

### Architecture

```
GitHub repo
   │
   ├─ push to main → GitHub Actions CI (.github/workflows/ci.yml)
   │                  lint + typecheck + build (both frontend and backend)
   │
   └─ CI passes → GitHub Actions Deploy (.github/workflows/deploy.yml)
                   SSH into VPS → git pull → docker compose up --build
```

### 1. Get a VPS (~$6/month)

Hetzner CX22 (2 vCPU, 4GB, 40GB SSD) is the cheapest reliable option.

1. Create account at [hetzner.com](https://hetzner.com) → New Server → **CX22** → Ubuntu 22.04
2. Add your SSH public key during setup
3. Note the server IP address

### 2. Configure the server

SSH in as root, then:

```bash
# Create a deploy user (don't run the app as root)
adduser deploy
usermod -aG sudo,docker deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Git
apt-get install -y git

# Clone the repo
su - deploy
git clone https://github.com/YOUR_ORG/meetora.git /home/deploy/meetora
cd /home/deploy/meetora

# Copy your .env file (do this from your local machine)
# scp .env deploy@YOUR_SERVER_IP:/home/deploy/meetora/.env
```

### 3. Add GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | Your VPS IP address |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | Contents of `~/.ssh/id_rsa` (the private key) |
| `DEPLOY_PATH` | `/home/deploy/meetora` |

### 4. Domain + SSL (free via Let's Encrypt)

Install Caddy on the VPS — it auto-provisions SSL and reverse-proxies to Docker:

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```
api.yourdomain.com {
    reverse_proxy localhost:3000
}

app.yourdomain.com {
    reverse_proxy localhost:3001
}
```

```bash
systemctl enable caddy && systemctl start caddy
```

Point your DNS A records (`api.yourdomain.com`, `app.yourdomain.com`) to the VPS IP.
Caddy handles HTTPS automatically — no certbot needed.

### 5. Update environment variables for production

In your `.env` on the server, update:

```env
CORS_ORIGINS=https://app.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
TWILIO_WEBHOOK_URL=https://api.yourdomain.com/api/webhooks/twilio
GOOGLE_REVIEWS_REDIRECT_URI=https://api.yourdomain.com/api/google-reviews/callback
GOOGLE_CALENDAR_REDIRECT_URI=https://api.yourdomain.com/api/calendar/callback
API_BASE_URL=https://api.yourdomain.com
# Error tracking — set to your Sentry project DSN to enable centralized error
# reporting on the api/worker/campaign-worker. Leave unset to disable.
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
```

### 6. First deploy (manual)

```bash
cd /home/deploy/meetora
docker compose up -d --build --scale worker=2 --scale campaign-worker=2
```

### 7. Subsequent deploys (automatic)

Push to `main` → GitHub Actions runs CI → if it passes → SSH deploy runs automatically.
Total deploy time: ~3–4 minutes.

### Free external services (optional upgrades)

| Service | Free tier | Use when |
|---------|-----------|----------|
| [Sentry](https://sentry.io) | 5k errors/month | Error tracking — **already integrated** (api + workers); just set `SENTRY_DSN` to activate |
| [UptimeRobot](https://uptimerobot.com) | 50 monitors, 5-min checks | Uptime alerts to email/Slack |
| [Neon](https://neon.tech) | 0.5GB Postgres | If you outgrow the VPS disk |
| [Upstash](https://upstash.com) | 10k Redis req/day | Redis managed HA (may be too low for BullMQ — test first) |

---

## Deployment Order

> ⚠️ **`api`, `worker`, and `campaign-worker` build from the same `Dockerfile` but as three
> independent images** — each bakes its own Prisma Client at build time, and each also runs
> `npx prisma migrate deploy` itself on container startup (see the `Dockerfile` `CMD`). If a
> migration drops or renames a column/table, whichever service restarts first applies it to
> the shared database immediately — any other service still running its old (pre-rebuild)
> image will crash with a `column does not exist` / `Invalid ... invocation` error until it's
> rebuilt too. This bit us for real: `20260629150852_remove_predictions_reactivation_referrals`
> dropped `appointments.no_show_risk_score`, and a stale `worker` container kept trying to
> select it, sending every reminder job to the DLQ with `MAX_RETRIES_EXHAUSTED` until it was
> rebuilt.
>
> **Rule: for any release that includes a destructive migration (dropped/renamed
> column or table), rebuild and restart `api`, `worker`, and `campaign-worker` together —
> never selectively rebuild just one.** `docker compose up -d --build` with no service filter
> (step 3 below) does this correctly; `docker compose up -d --build api` alone does not.
> For genuinely zero-downtime schema changes, prefer an expand/contract pattern instead —
> stop reading/writing the column in code across all services first, deploy that everywhere,
> then drop the column in a later migration once you're sure no old code is still running.

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
