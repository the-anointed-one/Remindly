/**
 * RSVP footer utility
 *
 * Appends a standard "reply YES / NO / MAYBE" prompt to any outbound
 * event-related message on channels that support inbound replies (SMS, WhatsApp).
 *
 * Do NOT append to:
 *  - VOICE  (TwiML — not a text reply flow)
 *  - EMAIL  (invite link already in the email body)
 */

const RSVP_FOOTER = `\n\nReply YES to confirm, NO to decline, or MAYBE if unsure.`;

type Channel = string;

const REPLY_CAPABLE: Channel[] = ['SMS', 'WHATSAPP'];

/**
 * Returns the message with the RSVP footer appended if the channel
 * supports text replies and the message doesn't already contain it.
 */
export function appendRsvpFooter(message: string, channel: Channel): string {
  if (!REPLY_CAPABLE.includes(channel.toUpperCase())) return message;
  if (message.includes('Reply YES')) return message; // already present
  return message + RSVP_FOOTER;
}
