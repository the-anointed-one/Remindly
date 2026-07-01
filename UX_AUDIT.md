# Meetora — UX Audit
*Generated: 2026-07-01, from a live walkthrough of the running app (register → onboarding → dashboard → all main sections)*

---

## Summary

Walked the full user journey as a brand-new signup: marketing site → register → plan selection → checkout → dashboard → each of the six main sections → settings. Three issues from the first pass are confirmed fixed (verified live): the Appointments-redirects-to-Events bug, the sidebar/page naming mismatch, and onboarding-modal persistence. A new, higher-severity issue turned up while testing the fix: a brand-new account cannot create its first appointment at all.

---

## 🔴 Critical — New Finding: Dead end creating a first appointment

### Contact search has no path forward for a new account with zero contacts
**Files:** `frontend/src/components/messaging/ContactSearchDropdown.tsx`, `frontend/src/app/dashboard/appointments/page.tsx` (line 338)

The "Create Appointment" button is disabled by:
```
disabled={saving || (targetType === 'contact' ? !contact : !targetId)}
```
It only enables once a `contact` object has been selected from `ContactSearchDropdown`. That component's search box only ever searches existing contacts (`GET /contacts?search=...`) and only calls `onChange`/sets a contact when the user clicks a result from that search. If the search returns zero matches — which it always will for a brand-new tenant with 0 contacts — the dropdown shows "No contacts found" with no further action available. Typing an email or phone number into the box does nothing but filter a search that will never return results.

Net effect: a new user cannot create their first appointment through this form at all, no matter what they type — there's no way to create a contact inline. This directly contradicts the dashboard's own empty-state CTA ("Create your first appointment"), which implies this exact flow should work standalone.

**Fix, based on the actual component and DTO:**

`ContactSearchDropdown.tsx`'s "No contacts found" state (around line 158-161) should offer to create one instead of dead-ending. The backend already supports everything needed — `CreateContactDto` (`src/modules/contacts/dto/contact.dto.ts`) requires only `name`, with `phone` and `email` both optional — so an inline "create new contact" affordance needs at minimum a name plus phone (the product's primary channel is SMS/WhatsApp, so phone matters at least as much as email, arguably more).

---

## ✅ Previously Found, Now Confirmed Fixed

1. **Appointments redirect** (`dashboard/appointments/page.tsx`) — confirmed removed; page now renders its own appointment list, create form, and empty state correctly.
2. **Sidebar naming** (`dashboard/layout.tsx` `NAV_PRIMARY`) — confirmed sidebar now reads "Contacts" and "Campaigns," matching the pages themselves.
3. **Onboarding modal persistence** (`useOnboarding.ts` / tenant settings PATCH) — confirmed the dismissal now persists across a reload; the fix on the backend's tenant-settings handler resolved it.

---

## Priority Fix Order

1. **Inline contact creation from the appointment form** — highest priority; this is a first-run dead end for every new signup, worse than the previous appointments bug since it blocks the *replacement* flow that bug's fix just enabled.
2. Everything else from the original audit is resolved.
