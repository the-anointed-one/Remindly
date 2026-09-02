import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

// Default country used to interpret local-format numbers (e.g. Nigerian
// "08137999425") that lack an international prefix.
//
// TODO: key this off a Tenant-level country/locale field once one exists. The
// Tenant model currently has no country column (only a `settings` JSON blob),
// so we assume Nigeria — the primary user base — for now. A future improvement
// is to infer it from `settings.timezone` (e.g. Africa/Lagos → NG) or a proper
// country setting, and thread that through the send call sites.
export const DEFAULT_SEND_COUNTRY: CountryCode = 'NG';

/**
 * Normalize a raw phone string to E.164 (e.g. "+2348137999425") for handing to
 * Twilio, which rejects anything that isn't already E.164.
 *
 * Unlike the write-time IsValidPhoneNumber validator (which only guards new/
 * edited contacts), this runs at *send* time so existing rows with loose local
 * formats still work. Returns `null` when the input can't be parsed into a valid
 * number, so callers can fail loudly (log INVALID_PHONE_FORMAT) instead of
 * shipping garbage to the provider.
 *
 * An already-E.164 number (leading "+") is returned unchanged regardless of the
 * default country, since the "+" prefix takes precedence during parsing.
 */
export function normalizePhoneForSend(
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_SEND_COUNTRY,
): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (parsed && parsed.isValid()) return parsed.number; // E.164
    return null;
  } catch {
    return null;
  }
}
