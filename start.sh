#!/bin/sh
# ────────────────────────────────────────────────
# Meetora API — container entrypoint
# Applies pending migrations, then starts the API.
# ────────────────────────────────────────────────

# Abort startup if the migration fails rather than booting the API against an
# unmigrated schema. This preserves the `&&` semantics of the CMD that this
# script replaces — a bare sequence of commands would start the app anyway.
set -e

npx prisma migrate deploy

# exec so node replaces the shell as PID 1 and receives SIGTERM directly.
# main.ts calls enableShutdownHooks(); without exec the signal stops at sh and
# in-flight requests are cut off instead of drained.
exec node dist/src/main.js
