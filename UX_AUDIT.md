# Meetora — UX Audit
*Generated: 2026-07-01, updated after live testing across multiple rounds*

---

## Resolved this session (confirmed live/fixed)
1. Appointments redirect removed — page renders its own list.
2. Sidebar naming aligned (Contacts/Campaigns).
3. Onboarding modal persistence fixed (tenant.controller.ts payload-shape bug).
4. Inline contact creation added to ContactSearchDropdown for the zero-results dead end.
5. Native datetime-local swapped for a themed react-datepicker component (DateTimePicker.tsx) — click-to-select with no missing "confirm" step, dark-themed.

## Open — next round
6. Date/time picker: functional and themed, but not yet matching the target interaction
   model (tabbed Date/Time views, slider-based time entry, explicit Save action) — see prompt
   below.
7. Contact phone entry has no country-code enforcement — freeform text field accepts
   anything up to 30 characters, no validation. Needs a country-code-first, compulsory
   selector so only valid E.164-formatted numbers can be saved. See prompt below.
