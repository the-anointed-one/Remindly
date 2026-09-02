# syntax=docker/dockerfile:1.4
# ────────────────────────────────────────────────
# Meetora Frontend — Production Dockerfile
# ────────────────────────────────────────────────

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Network-resilient install: the registry connection in some build environments
# drops mid-download (ECONNRESET / TLS timeouts). Raise npm's per-request retry
# budget and timeouts, and retry the whole `npm ci` up to 3 times so a single
# transient drop doesn't fail the entire image build.
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && (npm ci --prefer-offline --no-audit --no-fund \
        || npm ci --prefer-offline --no-audit --no-fund \
        || npm ci --prefer-offline --no-audit --no-fund)

FROM node:20-alpine AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# TEMPORARY — dev/test only. Powers the "skip payment" button on the
# checkout page (see onboarding/checkout/page.tsx). Remove this ARG/ENV
# pair, the button, and the backend /billing/test-checkout route together
# before deploying to production.
ARG NEXT_PUBLIC_QA_BYPASS_TOKEN
ENV NEXT_PUBLIC_QA_BYPASS_TOKEN=$NEXT_PUBLIC_QA_BYPASS_TOKEN
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001 HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
