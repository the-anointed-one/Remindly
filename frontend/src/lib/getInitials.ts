/**
 * Generate initials from a full name or a single name/email string.
 *
 * Examples:
 *   getInitials("John Doe")    → "JD"
 *   getInitials("Jane")        → "J"
 *   getInitials("jane@x.com")  → "J"
 *   getInitials("")            → "?"
 */
export function getInitials(name: string | undefined | null): string {
    if (!name) return '?';

    // Strip email domain if it looks like an email
    const normalized = name.includes('@') ? name.split('@')[0] : name;

    const parts = normalized.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return '?';

    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

    // First + last initials only
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
