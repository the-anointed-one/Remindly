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
 * PayPal billing provider.
 *
 * PayPal's Subscriptions API doesn't have a persistent "customer" object the
 * way Paystack does — a subscriber is only attached once they approve the
 * subscription on PayPal's hosted flow. So createCustomer() is a no-op here;
 * initializeSubscription() creates the Subscription resource up front and
 * returns PayPal's approval URL for the user to complete.
 *
 * Env vars:
 *  - PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET
 *  - PAYPAL_MODE ("sandbox" | "live", defaults to "sandbox")
 *  - PAYPAL_STARTER_PLAN_ID / PAYPAL_GROWTH_PLAN_ID / PAYPAL_PRO_PLAN_ID
 *    (PayPal billing plan IDs created once via the PayPal dashboard/API —
 *    analogous to Paystack's PLN_ codes)
 */
@Injectable()
export class PaypalProvider implements BillingProvider {
  private readonly logger = new Logger(PaypalProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('PAYPAL_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>(
      'PAYPAL_CLIENT_SECRET',
      '',
    );
    const mode = this.configService.get<string>('PAYPAL_MODE', 'sandbox');
    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'PayPal credentials not configured. Set PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET in .env',
      );
    }
  }

  // ── OAuth2 token ────────────────────────────

  private async getAccessToken(): Promise<string> {
    const { data } = await axios.post(
      `${this.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: this.clientId, password: this.clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    return data.access_token;
  }

  // ── Create Customer (no-op — see class doc) ────

  async createCustomer(
    params: CreateCustomerParams,
  ): Promise<BillingCustomerResult> {
    // PayPal has no pre-subscription customer object; the payer is attached
    // when they approve the subscription. Return a synthetic identifier so
    // callers that expect a customerCode don't have to special-case PayPal.
    return {
      success: true,
      customerCode: `paypal_pending_${params.tenantId}`,
    };
  }

  // ── Initialize Subscription ────────────────

  async initializeSubscription(
    params: CreateSubscriptionParams,
  ): Promise<BillingSubscriptionResult> {
    try {
      const accessToken = await this.getAccessToken();

      const { data } = await axios.post(
        `${this.baseUrl}/v1/billing/subscriptions`,
        {
          plan_id: params.planCode,
          subscriber: { email_address: params.email },
          application_context: {
            brand_name: 'Meetora',
            user_action: 'SUBSCRIBE_NOW',
            return_url: this.configService.get(
              'PAYPAL_RETURN_URL',
              `${this.configService.get('FRONTEND_URL', 'http://localhost:3001')}/onboarding/callback?provider=paypal&status=success`,
            ),
            cancel_url: this.configService.get(
              'PAYPAL_CANCEL_URL',
              `${this.configService.get('FRONTEND_URL', 'http://localhost:3001')}/onboarding/checkout?provider=paypal&status=cancelled`,
            ),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const approvalLink = data.links?.find(
        (l: any) => l.rel === 'approve',
      )?.href;

      if (!approvalLink) {
        return { success: false, error: 'No PayPal approval link returned' };
      }

      this.logger.log(`PayPal subscription created: ${data.id}`);
      return {
        success: true,
        authorizationUrl: approvalLink,
        reference: data.id,
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.details?.[0]?.description ||
        error.message;
      this.logger.error(
        `PayPal initializeSubscription failed for plan ${params.planCode}: ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }

  // ── Cancel Subscription ────────────────────

  async cancelSubscription(
    subscriptionCode: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await this.getAccessToken();
      await axios.post(
        `${this.baseUrl}/v1/billing/subscriptions/${subscriptionCode}/cancel`,
        { reason: 'Cancelled by customer' },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      this.logger.log(`PayPal subscription ${subscriptionCode} cancelled`);
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      this.logger.error(`PayPal cancelSubscription failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  // ── Verify Transaction (subscription status) ──

  async verifyTransaction(
    reference: string,
  ): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const accessToken = await this.getAccessToken();
      const { data } = await axios.get(
        `${this.baseUrl}/v1/billing/subscriptions/${reference}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      // PayPal statuses: APPROVAL_PENDING, APPROVED, ACTIVE, SUSPENDED,
      // CANCELLED, EXPIRED. Map ACTIVE -> 'success' to match Paystack's shape.
      const status = data.status === 'ACTIVE' ? 'success' : data.status;
      return { success: true, status };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      return { success: false, error: errorMessage };
    }
  }
}
