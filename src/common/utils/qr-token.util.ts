import * as crypto from 'crypto';

/**
 * Opaque per-participant check-in token.
 *
 * HMAC over (event, contact, mint time) so the value cannot be derived from the
 * ids alone — the token is the only thing a scanner presents, so it has to be
 * unguessable. The timestamp keeps re-invites from reproducing a revoked token.
 *
 * Tokens are looked up, never recomputed, so the mint inputs don't need to be
 * reproducible later.
 */
export function generateQrToken(eventId: string, contactId: string): string {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'secret')
    .update(`${eventId}:${contactId}:${Date.now()}`)
    .digest('hex');
}
