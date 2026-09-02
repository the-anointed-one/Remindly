# syntax=docker/dockerfile:1.4
# ────────────────────────────────────────────────
# Meetora API — Multi-Stage Production Dockerfile
# ────────────────────────────────────────────────
# SCALABILITY:
# - Multi-stage build minimizes image size (~150MB vs ~1GB)
# - Non-root user for security
# - Health check built-in for orchestrator readiness
# - Run multiple instances behind load balancer
# - Worker process runs separately: `docker compose up --scale worker=3`
# ────────────────────────────────────────────────

# ── Stage 1: Install dependencies ──────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 5 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && (npm ci --omit=dev --prefer-offline --no-audit --no-fund \
        || npm ci --omit=dev --prefer-offline --no-audit --no-fund \
        || npm ci --omit=dev --prefer-offline --no-audit --no-fund) \
    && npx prisma generate

# ── Stage 2: Build ─────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 5 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && (npm ci --prefer-offline --no-audit --no-fund \
        || npm ci --prefer-offline --no-audit --no-fund \
        || npm ci --prefer-offline --no-audit --no-fund)
COPY . .
RUN npx prisma generate && npm run build

# ── Stage 3: Production runtime ────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Set ownership
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 3000

# Health check for Docker/orchestrators
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health/live || exit 1

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
