// Shared list of common IANA timezones, used by the Locations picker, the
// Settings business-timezone dropdown, and the DateTimePicker override.
// Keep this as the single source of truth — do not re-declare per page.
export const TIMEZONES = [
    'UTC', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Cairo',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Toronto', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
] as const;

export type Timezone = (typeof TIMEZONES)[number];

/** The browser's current IANA timezone, or 'UTC' if it can't be resolved. */
export function detectBrowserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}
