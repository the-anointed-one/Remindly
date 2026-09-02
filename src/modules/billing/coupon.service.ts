import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

/**
 * Deterministic, per-(event, contact) coupon codes.
 *
 * Codes are an HMAC of the pair rather than a stored random value, so the same
 * contact always gets the same code for an event (safe to re-issue on retry)
 * and a code can be validated at redemption time without a lookup table.
 */
@Injectable()
export class CouponService {
  constructor(private readonly config: ConfigService) {}

  generate(eventId: string, contactId: string): string {
    const secret = this.config.get('JWT_SECRET', 'secret');
    const hash = crypto
      .createHmac('sha256', secret)
      .update(`${eventId}:${contactId}:coupon`)
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();
    return `MEET-${hash}`;
  }

  verify(eventId: string, contactId: string, code: string): boolean {
    return this.generate(eventId, contactId) === code;
  }
}
