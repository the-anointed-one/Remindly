/**
 * Provider-routing helpers.
 *
 * Callers must pass an E.164 number (leading "+"). MessagingService normalizes
 * via normalizePhoneForSend() before routing, so a local-format "08012345678"
 * is already "+2348012345678" by the time it reaches here.
 */

// Longest-prefix order matters: "+234" must be tested before "+23" style
// overlaps, and "+27" before "+2xx" entries would shadow it. Kept explicit
// rather than sorted at runtime so the list stays readable.
const AFRICAN_DIALING_PREFIXES = [
  '+234', // Nigeria
  '+233', // Ghana
  '+254', // Kenya
  '+256', // Uganda
  '+255', // Tanzania
  '+27', //  South Africa
  '+251', // Ethiopia
  '+221', // Senegal
  '+225', // Ivory Coast
  '+237', // Cameroon
  '+263', // Zimbabwe
  '+260', // Zambia
  '+258', // Mozambique
  '+250', // Rwanda
  '+257', // Burundi
  '+249', // Sudan
  '+212', // Morocco
  '+213', // Algeria
  '+216', // Tunisia
  '+20', //  Egypt
];

export function isAfricanNumber(phone: string): boolean {
  if (!phone) return false;
  return AFRICAN_DIALING_PREFIXES.some((p) => phone.startsWith(p));
}

export function getRegion(phone: string): string {
  if (!phone) return 'GLOBAL';
  if (phone.startsWith('+1')) return 'US';
  if (phone.startsWith('+44')) return 'GB';
  if (phone.startsWith('+234')) return 'NG';
  if (phone.startsWith('+233')) return 'GH';
  if (phone.startsWith('+254')) return 'KE';
  if (phone.startsWith('+27')) return 'ZA';
  return 'GLOBAL';
}
