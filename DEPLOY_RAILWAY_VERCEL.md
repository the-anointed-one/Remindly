# Meetora — Railway + Vercel Production Runbook

Backend (API + 2 workers + Postgres + Redis) on **Railway**.
Frontend on **Vercel**.

Companion file: `.env.railway.example` — the complete, verified variable list.
Config-as-code: `railway.json`, `railway.worker.json`,
`railway.campaign-worker.json`, `frontend/vercel.json`.

> The legacy VPS/docker-compose path is in `DEPLOYMENT.md`. Its GitHub Actions
> deploy workflow is now `workflow_dispatch`-only so it cannot fail on push.

---

## Corrections to the original checklist

These four would have broken the deploy. They are already fixed in the files
above; they are listed here so the reasons survive.

| # | Original | Actual | Why it matters |
|---|----------|--------|----------------|
| 1 | `node dist/main` | `node dist/src/main.js` | `tsconfig.json` includes root-level `.ts` files, so nest build resolves rootDir to the project root and emits `dist/src/main.js`. `dist/main.js` does not exist — the container would crash-loop instantly. The worker paths (`dist/workers/*.worker.js`) *are* correct; `tsconfig.worker.json` only includes `src/**`, so its rootDir is `src`. |
| 2 | `DATABASE_URL` absent from the API list | `DATABASE_URL=${{Postgres.DATABASE_URL}}` | Railway does **not** auto-inject database vars across services. Without an explicit reference variable the API cannot reach Postgres. |
| 3 | 5 production-required vars missing | see below | `src/config/env.validation.ts` runs Joi with `abortEarly: true`. One missing var and the process exits on boot naming only that var. |
| 4 | `frontend/.npmrc` untracked | must be committed | It carries `legacy-peer-deps=true` for `react-phone-number-input` vs React 19. Vercel clones from git, so an untracked `.npmrc` means Vercel never sees it and `npm install` fails on peer resolution. |

**The five vars that are `[REQUIRED IN PROD]` and were missing:**

```
NEXT_PUBLIC_API_URL           # validated by the backend too, not just Next.js
TWILIO_WEBHOOK_URL
GOOGLE_REVIEWS_REDIRECT_URI   # required even if Google Reviews is unused
GOOGLE_CALENDAR_REDIRECT_URI  # required even if Calendar is unused
OUTLOOK_REDIRECT_URI          # required even if Outlook is unused
```

Two smaller notes:

- **Do not set `PORT`.** Railway injects it and routes to whatever the process
  binds. A hard-coded `PORT=3000` fights the injected value.
- **`X_QA_BYPASS_TOKEN` is a different variable from `QA_BYPASS_TOKEN`.**
  The first is read by `paystack-webhook.controller.ts` and belongs in
  production. The second, with `ENABLE_QA_BYPASS`, drives
  `qa-bypass.guard.ts`, which is non-production only — leave both unset.

---

## Cost

Railway has no free tier: a one-off trial credit, then Hobby at $5/month plus
usage. Five Railway services (api, worker, campaign-worker, Postgres, Redis)
will exceed the trial credit. Vercel Hobby genuinely is free for this frontend.

To cut Railway to one paid service, drop the two worker services and run all
three processes in the API container:

```
npx prisma migrate deploy && node dist/workers/reminder.worker.js & node dist/workers/campaign.worker.js & node dist/src/main.js
```

Cheaper and simpler, but the processes no longer scale or restart
independently, and one OOM takes down all three. Use the three-service layout
below unless cost forces the change.

---

## Pre-deploy

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"   # TERMII_WEBHOOK_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"   # X_QA_BYPASS_TOKEN

npm run build          # backend  — must be zero errors
cd frontend && npm run build && cd ..
```

Push to `main`. Railway and Vercel both deploy from `main` on push.

---

## Part A — Railway

### A1 · Project

railway.app → New Project → Deploy from GitHub repo → this repo.
The auto-created service becomes **api**.

### A2 · Datastores

`+ New → Database → Add PostgreSQL`, then `+ New → Database → Add Redis`.
Wait for both to read **Available**. You do not need to copy any credentials —
the reference variables in A3 resolve them.

### A3 · api service

- Rename the service to `api`.
- Settings → Config-as-code path: `railway.json`
  (supplies the build, start command, and `/api/health/live` healthcheck).
- Settings → Networking → **Generate Domain**. Copy the URL.
- Variables → Raw Editor → paste the `SERVICE: api` block from
  `.env.railway.example`, substituting your domain for `<api>` and your
  generated secrets.

`FRONTEND_URL`, `CORS_ORIGINS`, and `PAYSTACK_CALLBACK_URL` need the Vercel URL
you do not have yet. Put a placeholder like `https://placeholder.vercel.app` in
all three now so Joi passes, and correct them in B2.

Deploy, then:

```bash
curl https://<api>.up.railway.app/api/health/live   # {"status":"ok"}
```

If the deploy crash-loops, read the logs — Joi prints the single offending
variable and exits.

### A4 · worker service

`+ New → GitHub Repo` → same repo → rename to `worker`.
Settings → Config-as-code path: `railway.worker.json`.
Variables: the `SERVICE: worker` block from `.env.railway.example`.
No public domain needed.

Logs should show the reminder worker connecting to Redis.

### A5 · campaign-worker service

Same as A4, but config-as-code path `railway.campaign-worker.json`.
Identical variables.

### A6 · Verify

```bash
curl https://<api>.up.railway.app/api/health/live
curl https://<api>.up.railway.app/api/health/ready   # exercises DB + Redis
```

`/ready` is the one that proves migrations ran and both datastores are
reachable. Confirm in the api logs that `prisma migrate deploy` applied the
migrations in `prisma/migrations/`.

---

## Part B — Vercel

### B1 · Deploy

vercel.com → New Project → import this repo.

- **Root Directory: `frontend`** — this is the one setting that must not be
  missed.
- Framework preset: Next.js (auto-detected).
- Build and install commands come from `frontend/vercel.json`.

Environment variable:

```
NEXT_PUBLIC_API_URL=https://<api>.up.railway.app/api
```

Do not add `NODE_ENV` — Vercel sets it and a manual value can break the build.

### B2 · Point the API back at Vercel

Railway → api → Variables, replace the placeholders:

```
FRONTEND_URL=https://<app>.vercel.app
CORS_ORIGINS=https://<app>.vercel.app
PAYSTACK_CALLBACK_URL=https://<app>.vercel.app/onboarding/callback
```

Railway redeploys automatically. `CORS_ORIGINS` accepts a comma-separated list
if you later add a custom domain — add the apex and `www` both, or browser
requests from the one you omitted fail CORS.

### B3 · Verify

Load `/` and `/register`, then register an account and watch the browser
network tab: requests must go to the Railway domain and come back without a
CORS error.

---

## Part C — External services

| Service | Setting | Value |
|---|---|---|
| Termii | Webhook URL | `https://<api>.up.railway.app/api/termii-webhook/inbound` |
| Termii | Custom header | `x-meetora-secret: <TERMII_WEBHOOK_SECRET>` |
| Twilio | Number → Messaging webhook (HTTP POST) | `https://<api>.up.railway.app/api/twilio-webhook/inbound` |
| Paystack | Webhook URL | `https://<api>.up.railway.app/api/paystack-webhook` |
| Google Cloud | Authorised redirect URI | `https://<api>.up.railway.app/api/auth/google/callback` |
| Google Cloud | Authorised JavaScript origin | `https://<app>.vercel.app` |

The Twilio webhook URL must also be set as the `TWILIO_WEBHOOK_URL` variable on
the api service — the app validates it at boot, it is not inferred.

Google OAuth changes take up to 5 minutes to propagate.

---

## Part D — End-to-end test

1. Register at `https://<app>.vercel.app/register`.
2. Onboarding → Growth plan → Paystack test card `4084 0840 8408 4081`,
   any future expiry, CVV `408`, PIN `0000`, OTP `123456`.
3. Create a contact with your real phone number and email.
4. Create an event: all automation checkboxes on, incentive = 10% discount.
5. Invite the contact, broadcast the reminder over SMS.
6. Reply `YES`. Within ~30s expect the contact to flip to **Confirmed**, a
   location SMS, and a coupon SMS with a `MEET-XXXXXXXX` code.
7. Cross-check the api logs for the RSVP workflow and provider send lines.

### Success criteria

- [ ] `/api/health/live` returns ok
- [ ] `/api/health/ready` returns ok (DB + Redis reachable, migrations applied)
- [ ] Frontend loads on the Vercel URL
- [ ] Registration completes end to end
- [ ] Paystack test payment completes
- [ ] Broadcast SMS arrives on a real phone
- [ ] `YES` reply flips the contact to Confirmed
- [ ] Location SMS fires automatically
- [ ] Incentive SMS fires with a `MEET-XXXXXXXX` code
- [ ] Google OAuth sign-in works
- [ ] Termii webhook receives replies
- [ ] No errors in the Railway logs for any of the three services
