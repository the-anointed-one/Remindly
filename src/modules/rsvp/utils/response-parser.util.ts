/**
 * Utility for normalizing and parsing inbound RSVP keyword responses.
 * Handles case variations, leading/trailing whitespace, punctuation, and emoji.
 */
export class ResponseParser {
  /**
   * Normalize an inbound message to a clean lowercase alpha-only string.
   * Strips whitespace, emoji, digits (non-keyword), and punctuation.
   * Digits that are standalone keywords ('1', '2', '3') are preserved.
   */
  static normalize(input: string): string {
    const trimmed = input.trim();
    // If it's a pure digit keyword, preserve it
    if (/^[0-9]$/.test(trimmed)) return trimmed;
    // Otherwise strip everything except lowercase letters
    return trimmed.toLowerCase().replace(/[^a-z]/g, '');
  }

  /**
   * Parse an inbound message into a canonical RSVP intent.
   * Returns 'confirmed', 'declined', 'maybe', or null (not an RSVP keyword).
   */
  static parseRSVP(
    input: string,
  ): 'confirmed' | 'declined' | 'maybe' | null {
    const normalized = this.normalize(input);

    const YES_KEYWORDS = new Set([
      'yes', 'y', 'yeah', 'yep', 'yup', 'sure',
      'confirm', 'confirmed', 'accept', 'accepted', 'ok', 'okay', '1',
    ]);
    const NO_KEYWORDS = new Set([
      'no', 'n', 'nope', 'nah', 'never',
      'decline', 'declined', 'reject', 'rejected',
      'cancel', 'cancelled', 'canceled', '2',
    ]);
    const MAYBE_KEYWORDS = new Set([
      'maybe', 'm', 'perhaps', 'tentative', 'unsure', 'pending', '3',
    ]);

    if (YES_KEYWORDS.has(normalized)) return 'confirmed';
    if (NO_KEYWORDS.has(normalized)) return 'declined';
    if (MAYBE_KEYWORDS.has(normalized)) return 'maybe';
    return null;
  }
}
