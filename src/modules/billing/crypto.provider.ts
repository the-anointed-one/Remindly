import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  BillingProvider,
  CreateCustomerParams,
  CreateSubscriptionParams,
  BillingCustomerResult,
  BillingSubscriptionResult,
} from './billing.provider';

/**
 * Crypto billing provider — Coinbase Commerce.
 *
 * IMPORTANT: crypto payments do not auto-recur the way a card subscription
 * does. There is no "charge this wallet again next month" — Coinbase
 * Commerce only supports one-time "charges". Each charge here extends the
 * tenant's paid period by one billing cycle; renewal reminders/re-invoicing
 * is a separate, not-yet-built concern (tracked as a follow-up — see
 * billing.service.ts).
 *
 * Env vars:
 *  - COINBASE_COMMERCE_API_KEY
 *  - COINBASE_COMMERCE_WEBHOOK_SECRET (for webhook signature verification)
 */
@Injectable()
export class CryptoProvider implements BillingProvider {
  private readonly logger = new Logger(CryptoProvider.name);
  private readonly apiKey: string;
  private static readonly BASE_URL = 'https://api.commerce.coinbase.com';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>(
      'COINBASE_COMMERCE_API_KEY',
      '',
    );

    if (!this.apiKey) {
      this.logger.warn(
        'Coinbase Commerce API key not configured. Set COINBASE_COMMERCE_API_KEY in .env',
      );
    }
  }

  private get headers() {
    return {
      'X-CC-Api-Key': this.apiKey,
      'X-CC-Version': '2018-03-22',
      'Content-Type': 'application/json',
    };
  }

  // ── Create Customer (no-op — Coinbase Commerce has no customer object) ──

  async createCustomer(
    params: CreateCustomerParams,
  ): Promise<BillingCustomerResult> {
    return {
      success: true,
      customerCode: `crypto_${params.tenantId}`,
    };
  }

  // ── Initialize Subscription (one-time charge) ──

  async initializeSubscription(
    params: CreateSubscriptionParams,
  ): Promise<BillingSubscriptionResult> {
    try {
      // params.amount is in the smallest currency unit (cents/kobo) to stay
      // consistent with the other providers; Coinbase wants a decimal string.
      const amountLocal = ((params.amount ?? 0) / 100).toFixed(2);

      const { data } = await axios.post(
        `${CryptoProvider.BASE_URL}/charges`,
        {
          name: 'Meetora subscription',
          description: `Meetora plan payment (${params.planCode})`,
          pricing_type: 'fixed_price',
          local_price: {
            amount: amountLocal,
            currency: this.configService.get('PAYSTACK_CURRENCY', 'USD'),
          },
          metadata: {
            planCode: params.planCode,
            email: params.email,
          },
          redirect_url: this.configService.get(
            'CRYPTO_RETURN_URL',
            `${this.configService.get('FRONTEND_URL', 'http://localhost:3001')}/onboarding/callback?provider=crypto&status=success`,
          ),
          cancel_url: this.configService.get(
            'CRYPTO_CANCEL_URL',
            `${this.configService.get('FRONTEND_URL', 'http://localhost:3001')}/onboarding/checkout?provider=crypto&status=cancelled`,
          ),
        },
        { headers: this.headers },
      );

      this.logger.log(`Coinbase Commerce charge created: ${data.data.code}`);
      return {
        success: true,
        authorizationUrl: data.data.hosted_url,
        reference: data.data.code,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      this.logger.error(
        `Coinbase Commerce initializeSubscription failed for plan ${params.planCode}: ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }

  // ── Cancel Subscription (no-op — no recurring subscription exists) ──

  async cancelSubscription(): Promise<{ success: boolean; error?: string }> {
    // There's nothing to cancel on Coinbase's side — a "subscription" here
    // is just local bookkeeping (SubscriptionRecord.status). Cancellation
    // is handled entirely in billing.service.ts by not re-charging.
    return { success: true };
  }

  // ── Verify Transaction ──────────────────────

  async verifyTransaction(
    reference: string,
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const { data } = await axios.get(
        `${CryptoProvider.BASE_URL}/charges/${reference}`,
        { headers: this.headers },
      );

      const timeline = data.data.timeline || [];
      const latestStatus = timeline[timeline.length - 1]?.status;

      // Coinbase timeline statuses: NEW, PENDING, COMPLETED, EXPIRED,
      // UNRESOLVED, RESOLVED, CANCELED. Map COMPLETED/RESOLVED -> 'success'.
      const status = ['COMPLETED', 'RESOLVED'].includes(latestStatus)
        ? 'success'
        : latestStatus;

      return { success: true, status };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      return { success: false, error: errorMessage };
    }
  }
}
