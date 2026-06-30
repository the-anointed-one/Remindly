# Meetora — Total Audit
*Generated: 2026-06-29*

---

## Summary

165 TypeScript source files across 28 backend modules, 4 BullMQ workers, and a Next.js frontend. The core booking-to-reminder loop works end-to-end. What follows is every issue found, ranked by severity.

---

## 🔴 Critical — Fix Before Any Real Users

### 1. JWT secrets are the default placeholder values
**File:** `.env` lines 9–10

```
JWT_SECRET="change-me-to-a-secure-random-string"
JWT_REFRESH_SECRET="change-me-to-another-secure-random-string"
```

Anyone who knows these strings can forge auth tokens and impersonate any tenant. Generate real secrets before taking on a paying user.

**Fix:**
```bash
openssl rand -hex 64
# paste output twice — once for each secret
```

---

### 2. Monthly usage reset doesn't reset AI or SMS counters
**File:** `src/modules/plan/usage-reset.job.ts`

The cron job runs on the 1st of every month but only resets `automationExecutionsThisMonth`. It never resets `aiUsageCount` or `smsUsageCount`. Paying customers will hit their limits and get permanently locked out until someone manually fixes the DB.

**Fix — add to the `updateMany` data block:**
```ts
data: {
  automationExecutionsThisMonth: 0,
  aiUsageCount: 0,
  smsUsageCount: 0,
  lastResetDate: new Date(),
},
```

---

### 3. CORS is ignoring the CORS_ORIGINS env var
**File:** `src/main.ts`

```ts
const allowedOrigins = configService.get('CORS_ORIGINS', ...); // read but unused
app.enableCors({
  origin: configService.get('FRONTEND_URL', 'http://localhost:3001'), // only this
```

`CORS_ORIGINS` is logged but never actually used. The `origin` is always a single string (`FRONTEND_URL`). In production with a real domain, this could block API calls or (if `FRONTEND_URL` is set wrong) allow everything.

**Fix:** Replace the `origin` line with the parsed `allowedOrigins` value, splitting on commas if multiple are provided.

---

### 4. Voice channel in automations always falls through to mock
**File:** `src/modules/automation/workflow-processor.service.ts` (line 235) + `src/modules/messaging/messaging.service.ts` (line 65)

`messaging.service.ts` only calls real Twilio voice if `appointmentData` is passed as a parameter. The workflow processor calls:

```ts
await this.messagingService.send(tenantId, 'VOICE', phone, message);
// appointmentData is never passed
```

Without `appointmentData`, the `if (this.useTwilio && appointmentData)` branch is false and every voice automation falls back to mock — silently logs to console, nothing delivered.

**Fix:** Either pass a constructed `appointmentData` object from entity data in the processor, or refactor the voice path to accept a raw TwiML string directly.

---

### 5. `ALLOW_TRIAL_WITHOUT_CARD` is duplicated in `.env` — last value wins
**File:** `.env` lines 21 and 84

```
ALLOW_TRIAL_WITHOUT_CARD=false   # line 21
...
ALLOW_TRIAL_WITHOUT_CARD=true    # line 84 — this one wins
```

This means the trial gate is OFF. Any account can use the product without entering a card. Fine for QA, a revenue leak in production.

**Fix:** Delete line 21, leave only the intentional value at line 84.

---

## 🟠 High — Fix Before Launch

### 6. Rate limiter and loop detector are in-memory
**Files:** `src/modules/plan/rate-limit.service.ts`, `src/modules/automation/automation-execution-tracker.service.ts`

Both use a `Map` stored in the process. You run 2+ API replicas and 2 reminder workers in Docker. This means:

- SMS rate limits (hourly) are per-instance, so a tenant can send 2× the limit by hitting different replicas
- Automation loop detection is per-instance; a misfiring automation could run indefinitely across replicas

The rate limit service already has a comment: *"For production, replace the in-memory Map with Redis."*

**Fix:** Migrate both to Redis counters with TTLs using `ioredis` INCR + EXPIRE.

---

### 7. Campaign worker has no `OPENAI_API_KEY`
**File:** `docker-compose.yml` (campaign-worker service)

The campaign worker handles AI-channel campaigns (`aiUsageCount` increments in `campaign.worker.ts`). But `OPENAI_API_KEY` is only passed to the `api` service, not `campaign-worker`. AI campaign sends will fail silently in Docker.

**Fix:** Add `OPENAI_API_KEY: ${OPENAI_API_KEY}` to the `campaign-worker` environment block in `docker-compose.yml`.

---

### 8. Paystack currency is set to USD — Paystack is NGN-first
**File:** `.env` line 69: `PAYSTACK_CURRENCY=USD`

Paystack's test environment supports multi-currency but production USD requires explicit merchant activation by Paystack. If you launch and charge in USD without that approval, transactions will fail or silently convert at a bad rate. Given the app appears to target Nigeria-based businesses, NGN is the safer default.

**Fix:** Change to `PAYSTACK_CURRENCY=NGN` and update `DEFAULT_PLAN_PRICES` to Naira amounts, unless you've confirmed USD merchant activation with Paystack support.

---

### 9. Customer vs Contact dual-model gap
**Files:** `src/modules/appointment/appointment.service.ts`, `src/modules/automation/workflow-processor.service.ts`

The system has two separate models:
- `Customer` — linked to appointments, has `firstName`/`lastName`
- `Contact` — linked to messaging, has `name`/`phone`/`email`/`tags`

If someone books an appointment and no corresponding `Contact` exists, automations that target `contactId` will silently produce zero recipients and the execution will complete with `actionsRun: 0`. There's no deduplication or auto-creation of a Contact from a Customer at booking time.

**Fix:** In `appointment.service.ts`, after creating/finding the customer, upsert a matching Contact record (match on phone or email within the tenant). This closes the gap so every appointment always has an automation-reachable recipient.

---

### 10. No outbound webhook system
**File:** `src/modules/webhook/webhook.service.ts`

The entire Webhooks module returns `{ message: 'Webhook module — not yet implemented' }`. Businesses expect to pipe appointment/payment events to Zapier, Make, or their own systems. This is table-stakes for a B2B SaaS.

---

### 11. No team member management
**File:** `src/modules/user/user.service.ts`

`findAll()` returns a stub. There's no way for an `OWNER` to invite staff, assign roles, or remove access. Every tenant is effectively a solo account. Clinics, salons, and multi-staff businesses need this immediately.

---

### 12. Email only works for the Resend account owner address
**Config:** `SMTP_FROM=Meetora <onboarding@resend.dev>`

Resend in test mode only delivers to the verified account owner email (`reachbenjaminajah@gmail.com`). All customer emails to other addresses are silently dropped. This needs domain verification at resend.com/domains before launch.

---

## 🟡 Medium — Technical Debt / Quality Issues

### 13. Timezone handling is server-local
**Files:** `reminder-scheduler.service.ts` (line 63), `revenue-analytics.service.ts` (line 193)

Appointment dates are formatted with `.toLocaleDateString('en-GB')` which uses the Node.js process timezone (UTC in Docker). If a tenant is in Lagos (WAT = UTC+1) and books an appointment for 9:00 AM, reminders will say "8:00 AM" or dates could appear off by one day. Locations have a `timezone` field but it's not used in reminder formatting.

**Fix:** Thread the tenant/location timezone through to all date formatting calls. Use `toLocaleString('en-GB', { timeZone: location.timezone })`.

---

### 14. Voice TwiML callback URL hardcoded to localhost
**File:** `.env`: `TWILIO_WEBHOOK_URL="http://localhost:3001/api/webhooks/twilio"`

Voice IVR (press 1 to confirm) requires Twilio to POST back to a public URL. With localhost, the IVR gather callback never fires — the call plays the message and drops. This needs a real deployment URL or ngrok tunnel in development.

---

### 15. WhatsApp sandbox — first message must be a template
**Files:** `src/modules/messaging/twilio.provider.ts` (line 101–107)

The sandbox `sendWhatsApp` sends free-form text. Twilio sandbox requires the first outbound message to use an approved content template (`ContentSid`). Free-form will fail with error 63016 unless the user has already messaged the sandbox number. Production WhatsApp requires Meta Business API approval and content templates.

---

### 16. `PAYSTACK_WEBHOOK_SECRET` env var exists but is unused
**File:** `.env` line 43 vs `paystack-webhook.controller.ts` line 32

The controller uses `PAYSTACK_SECRET_KEY` for HMAC verification (which is actually correct per Paystack's docs). But `.env` also has an empty `PAYSTACK_WEBHOOK_SECRET=""` that's never read. This is harmless but misleading — future developers may assume the webhook is unsecured because the "secret" is blank.

**Fix:** Remove `PAYSTACK_WEBHOOK_SECRET` from `.env` or rename to document that `PAYSTACK_SECRET_KEY` doubles as the webhook HMAC key.

---

### 17. `tenant.service.ts` `findAll()` is still a stub
A `GET /tenants` route returns `{ message: 'Tenant module — not yet implemented' }`. Since global admin features aren't scoped yet, this is low-risk, but it should either be removed or replaced with a proper `super-admin` guard.

---

### 18. No per-tenant billing cycle alignment for usage reset
**File:** `src/modules/plan/usage-reset.job.ts`

The cron resets all tenants on the 1st of the month regardless of when they subscribed. A tenant who subscribed on the 15th gets their usage reset 15 days early. Proper SaaS billing resets on the subscription anniversary date.

---

### 19. No frontend error boundaries
**Frontend:** Only `not-found.tsx` exists. No `error.tsx` in any dashboard route segment.

If the API returns 500 or a component throws, Next.js will crash the entire dashboard page with a generic error. Adding `error.tsx` files per route group allows graceful "Something went wrong, try again" states.

---

### 20. `en-GB` locale hardcoded everywhere
Dates format as `DD/MM/YYYY` throughout reminders and analytics. If this app expands to the US or is white-labelled, date formats will be wrong. Should come from tenant locale settings.

---

## 🟢 Low / Informational

| # | Issue | Location |
|---|-------|----------|
| 21 | No integration tests — only one DTO unit test exists (`register.dto.spec.ts`) | `src/modules/auth/dto/` |
| 22 | Bull Board QA token (`secret_qa_token_2026`) is in `.env` which could be committed | `.env` line 71 |
| 23 | `campaign-worker` and `worker` services lack `JWT_SECRET` — fine now but needed if workers ever verify tokens | `docker-compose.yml` |
| 24 | No soft-delete — contacts/appointments are hard-deleted | Schema |
| 25 | No pagination on `findAll` for contacts — will slow down at scale | `contacts.service.ts` (has cursor pagination but check limits) |
| 26 | `automation-execution-tracker.service.ts` setTimeout leaks across process restarts | Known; in-memory |
| 27 | Google OAuth callback URL hardcoded to localhost in `.env` | `.env` line 58 |
| 28 | Appointment `notes` field has no length limit | Schema |

---

## Infrastructure Gaps (Pre-Deploy Checklist)

| Item | Status |
|------|--------|
| Real JWT secrets | ❌ Still default |
| Resend domain verified | ❌ Using onboarding@resend.dev |
| Paystack live keys | ❌ Test keys |
| Paystack currency confirmed | ⚠️ USD — verify with Paystack |
| TWILIO_WEBHOOK_URL = public URL | ❌ localhost |
| WhatsApp production approval | ❌ Sandbox only |
| Redis rate limiting | ❌ In-memory |
| Domain + SSL | ❌ Not configured |
| Backup policy for PostgreSQL | ❌ No backup service in docker-compose |
| Log aggregation (Datadog, Logtail, etc.) | ❌ Console only |
| Error tracking (Sentry) | ❌ None |
| Monthly usage reset includes AI + SMS | ❌ Bug |

---

## Priority Fix Order

1. **JWT secrets** — takes 2 minutes, blocks everything else
2. **Monthly usage reset bug** — one-line fix, prevents locking out paying users
3. **Voice automation mock bug** — refactor messaging.service send() for voice
4. **CORS fix** — use `CORS_ORIGINS` not `FRONTEND_URL`
5. **ALLOW_TRIAL_WITHOUT_CARD dupe** — delete the extra line
6. **OpenAI key in campaign-worker docker service**
7. **Redis-backed rate limiting** — before scaling beyond 1 API instance
8. **Contact/Customer upsert at booking time** — before voice/SMS automations are sold as a feature
9. **Domain verification on Resend** — before any real email goes out
10. **Team member management** — before selling to multi-staff businesses
