I need you to audit and document the current architecture of this codebase.
Do not change any code. Read only. Produce a structured report covering:

---
## 1. PROJECT STRUCTURE
List the full folder/file tree (max 3 levels deep).
Highlight which folders contain: routes, controllers, services, models,
migrations, middleware, queues, and config.

---
## 2. DATABASE
- What database client is being used? (pg, prisma, knex, sequelize, etc.)
- List every table/model that exists with ALL their current columns and types.
- List every migration file and what it does (one line each).
- Are there any foreign keys or indexes defined? List them.
- Is there an ORM schema file? Show it in full.

---
## 3. API ROUTES
List every registered route in the format:
  METHOD /path → controller/handler name → brief description of what it does
Group by router file.

---
## 4. AUTHENTICATION & MIDDLEWARE
- How is auth currently handled? (JWT, session, none?)
- List every middleware in use and which routes it applies to.
- Is there any tenant/org scoping on queries? (yes/no — show example if yes)

---
## 5. SERVICES & QUEUE
- List every service file and what it is responsible for.
- Is Redis/BullMQ set up? Show the queue names and worker files.
- How are webhooks received and processed? (show the handler file path)

---
## 6. ENVIRONMENT & CONFIG
- List every environment variable used across the codebase (keys only, no values).
- What third-party APIs are integrated? (Twilio, WhatsApp, etc.)
- What ports/services are running?

---
## 7. KNOWN ERRORS OR TODOs
- List any TODO, FIXME, or console.error comments found in the code.
- List any hardcoded values that should be env variables.
- List any empty or stub functions/handlers.

---
## 8. FRONTEND (if applicable)
- What pages/screens exist? List the route and component file for each.
- What state management is used? (Redux, Zustand, Context, etc.)
- How does the frontend call the backend? (axios base URL, fetch, etc.)
- List any hardcoded API URLs.

---
FORMAT RULES:
- Use plain text and markdown headers only.
- Do not summarize or skip details — show actual values, file names, column names.
- If something is missing or unclear, say "NOT FOUND" rather than guessing.
- Output everything in one continuous response I can copy and paste.