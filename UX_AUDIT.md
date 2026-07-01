# Meetora — UX Audit
*Generated: 2026-07-01, from a live walkthrough of the running app (register → onboarding → dashboard → all main sections)*

---

## Summary

Walked the full user journey as a brand-new signup: marketing site → register → plan selection → checkout → dashboard → each of the six main sections → settings. The core flow works and the dashboard itself is clean and well-organized. Found one navigation bug that blocks a whole section (confirmed in source), a recurring naming inconsistency between the sidebar and what pages actually call themselves (confirmed in source), and a modal-persistence issue that needs verification. One earlier finding (a "strikethrough" on the ₦ price) was retracted after checking — the Naira sign is designed with a horizontal stroke through the N; that's the correct glyph, not a bug.

---

## 🔴 Critical — Blocks a Core Section

### 1. "Appointments" nav item doesn't go to Appointments
**File:** `frontend/src/app/dashboard/appointments/page.tsx`, line 81

```
useEffect(() => {
    router.replace('/dashboard/events');
}, [router]);
```

This unconditional redirect fires on every mount of the Appointments page, immediately bouncing the user to `/dashboard/events` before any of the page's own logic runs. The rest of the file (400+ lines: appointment list, create form, contact search, channel selector) is fully built but unreachable dead code because of this one effect. An earlier commit message in this repo ("remove stale appointments redirect") suggests this was supposed to have been removed already.

**Fix:** Delete lines 80–82. Confirm the page renders its own appointment list/form afterward without relying on anything the redirect was masking.

---

## 🟠 High — Confusing, Not Blocking

### 2. Sidebar labels don't match the pages they open
**File:** `frontend/src/app/dashboard/layout.tsx`, `NAV_PRIMARY` array (lines 23–30)

```
const NAV_PRIMARY = [
    { href: '/dashboard',              icon: faHouse,        label: 'Home' },
    { href: '/dashboard/contacts',     icon: faUsers,        label: 'Clients' },
    { href: '/dashboard/appointments', icon: faCalendarDays, label: 'Appointments' },
    { href: '/dashboard/automations',  icon: faBolt,         label: 'Follow-ups' },
    { href: '/dashboard/events',       icon: faCalendar,     label: 'Events' },
    { href: '/dashboard/campaigns',    icon: faCommentDots,  label: 'Messages' },
];
```

Two of these labels diverge from what the destination page calls itself:
- `/dashboard/contacts` is labeled "Clients" in the sidebar, but the page's own H1 says "Contacts."
- `/dashboard/campaigns` is labeled "Messages" in the sidebar, but the page's own H1 says "📣 Campaigns" — a completely different mental model (a user clicking "Messages" expects an inbox, not a campaign-blast builder).

The underlying data model already uses "Contact" and "Campaign" consistently (Prisma schema: `Contact`, `Campaign` models; API routes `/contacts`, `/campaigns`; the onboarding walkthrough in `OnboardingModal.tsx` also teaches users the terms "Contacts" and "Campaign"). The sidebar is the only place using different words ("Clients", "Messages"), so it's the smallest, safest place to fix — 2 string changes in one file, versus renaming the concept everywhere else.

Note there's also a `NAV_HIDDEN` array (lines 38–48) used only for the page-title lookup (`pageTitle` at line 149) for routes not in the visible nav — it has its own separate, slightly different set of label mappings (e.g. `/dashboard/campaigns` mapped to "Messages" there too, plus stray entries like `/dashboard/tags` → "Clients"). Worth reviewing for the same consistency pass while in this file.

**Fix:** In `NAV_PRIMARY`, change `label: 'Clients'` → `'Contacts'` and `label: 'Messages'` → `'Campaigns'`. Cross-check `NAV_HIDDEN`'s labels against the same standard.

---

## 🟡 Medium — Needs Verification Before Fixing

### 3. Onboarding welcome modal may not be persisting dismissal reliably
**Files:** `frontend/src/hooks/useOnboarding.ts`, `frontend/src/components/onboarding/OnboardingModal.tsx`

The modal's dismissal path looks correctly designed: clicking "Skip ✕" calls `onSkip` → `skipOnboarding()` in the hook → `PATCH /tenants/settings` with `{ onboardingCompleted: true }`, and the next mount reads it back via `GET /tenants/settings`. In principle this should persist server-side, not just for a session.

In testing, the modal reappeared on a second dashboard visit shortly after being dismissed once. The likely cause: the PATCH in `markComplete()` (useOnboarding.ts line 50) is fire-and-forget with a silently swallowed error —

```
api.patch('/tenants/settings', { onboardingCompleted: true }).catch(() => { });
```

— so if that request fails for any reason (auth timing, validation, a bug in the `/tenants/settings` PATCH handler), the UI still closes the modal but nothing was actually saved, and the next `GET` correctly shows `onboardingCompleted !== true` again.

**Before fixing:** confirm whether the PATCH is actually succeeding — check Network tab or server logs for `PATCH /api/tenants/settings` when dismissing the modal, and check what `tenants.controller.ts` / `tenants.service.ts` actually does with an `onboardingCompleted` key (confirm it's deep-merged into the `settings` JSON as the hook's comment claims, and that a fresh `GET` afterward actually returns it). If the PATCH is failing, fix that endpoint/permission issue. If it's succeeding, the modal-reappearing bug is somewhere else (e.g. a caching issue on the GET, or the `enabled` gate on the hook firing before auth is fully resolved) — in that case add logging or a retry rather than guessing further blind.

---

## 🟢 Retracted Finding

~~Pricing page shows a strikethrough through the currency symbol~~ — checked the source and the actual Unicode Naira sign (₦, U+20A6): it's officially glyphed as an "N" with a horizontal stroke through it, by design (same idea as ¢ or the Central Bank of Nigeria's own currency symbol). What looked like a CSS bug in a screenshot is the correct rendering of the character. No fix needed.

---

## Priority Fix Order

1. **Appointments redirect** (`appointments/page.tsx:81`) — delete the redirect. This section is currently unreachable; highest-impact fix by far, and the safest (one deletion, rest of the page is already built).
2. **Sidebar label naming** (`dashboard/layout.tsx` `NAV_PRIMARY`) — two string changes, cheap, meaningfully improves learnability.
3. **Onboarding modal persistence** — investigate first (see above), then fix whatever the investigation turns up.
