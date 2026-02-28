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

const PAYSTACK_BASE = 'https://api.paystack.co';

@Injectable()
export class PaystackProvider implements BillingProvider {
    private readonly logger = new Logger(PaystackProvider.name);
    private readonly secretKey: string;
    private readonly headers: Record<string, string>;

    constructor(private readonly configService: ConfigService) {
        this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY', '');
        this.headers = {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };

        if (!this.secretKey) {
            this.logger.warn(
                'Paystack secret key not configured. Set PAYSTACK_SECRET_KEY in .env',
            );
        }
    }

    // ── Create Customer ────────────────────────

    async createCustomer(params: CreateCustomerParams): Promise<BillingCustomerResult> {
        try {
            const { data } = await axios.post(
                `${PAYSTACK_BASE}/customer`,
                {
                    email: params.email,
                    first_name: params.firstName,
                    last_name: params.lastName,
                    metadata: { tenantId: params.tenantId },
                },
                { headers: this.headers },
            );

            if (data.status) {
                this.logger.log(`Paystack customer created: ${data.data.customer_code}`);
                return {
                    success: true,
                    customerCode: data.data.customer_code,
                };
            }

            return { success: false, error: data.message };
        } catch (error: any) {
            this.logger.error(`Paystack createCustomer failed: ${error.message}`);
            return {
                success: false,
                error: error.response?.data?.message || error.message,
            };
        }
    }

    // ── Initialize Subscription (via Transaction) ──

    async initializeSubscription(
        params: CreateSubscriptionParams,
    ): Promise<BillingSubscriptionResult> {
        try {
            // Paystack subscriptions are created via the transaction/initialize endpoint
            // with a plan code. The customer is redirected to pay, and upon success
            // Paystack auto-creates the subscription.
            const { data } = await axios.post(
                `${PAYSTACK_BASE}/transaction/initialize`,
                {
                    email: params.customerCode, // Paystack accepts email or customer_code
                    plan: params.planCode,
                    callback_url: this.configService.get(
                        'PAYSTACK_CALLBACK_URL',
                        'http://localhost:3000/billing/callback',
                    ),
                    metadata: {
                        start_date: params.startDate,
                    },
                },
                { headers: this.headers },
            );

            if (data.status) {
                this.logger.log(`Paystack subscription initialized: ${data.data.reference}`);
                return {
                    success: true,
                    authorizationUrl: data.data.authorization_url,
                    reference: data.data.reference,
                };
            }

            return { success: false, error: data.message };
        } catch (error: any) {
            this.logger.error(`Paystack initializeSubscription failed: ${error.message}`);
            return {
                success: false,
                error: error.response?.data?.message || error.message,
            };
        }
    }

    // ── Cancel Subscription ────────────────────

    async cancelSubscription(
        subscriptionCode: string,
        emailToken: string,
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { data } = await axios.post(
                `${PAYSTACK_BASE}/subscription/disable`,
                {
                    code: subscriptionCode,
                    token: emailToken,
                },
                { headers: this.headers },
            );

            if (data.status) {
                this.logger.log(`Subscription ${subscriptionCode} cancelled`);
                return { success: true };
            }

            return { success: false, error: data.message };
        } catch (error: any) {
            this.logger.error(`Paystack cancelSubscription failed: ${error.message}`);
            return {
                success: false,
                error: error.response?.data?.message || error.message,
            };
        }
    }

    // ── Verify Transaction ─────────────────────

    async verifyTransaction(
        reference: string,
    ): Promise<{ success: boolean; status?: string; error?: string }> {
        try {
            const { data } = await axios.get(
                `${PAYSTACK_BASE}/transaction/verify/${reference}`,
                { headers: this.headers },
            );

            if (data.status) {
                return {
                    success: true,
                    status: data.data.status, // 'success', 'failed', 'abandoned'
                };
            }

            return { success: false, error: data.message };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.message || error.message,
            };
        }
    }

    // ── Fetch Subscription Details ─────────────

    async getSubscription(
        subscriptionCode: string,
    ): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            const { data } = await axios.get(
                `${PAYSTACK_BASE}/subscription/${subscriptionCode}`,
                { headers: this.headers },
            );

            if (data.status) {
                return { success: true, data: data.data };
            }

            return { success: false, error: data.message };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.message || error.message,
            };
        }
    }

    // ── Charge Authorization (for trial auto-conversion) ──

    async chargeAuthorization(
        email: string,
        amount: number, // in kobo (smallest currency unit)
        authorizationCode: string,
    ): Promise<{ success: boolean; reference?: string; error?: string }> {
        try {
            const { data } = await axios.post(
                `${PAYSTACK_BASE}/transaction/charge_authorization`,
                {
                    email,
                    amount,
                    authorization_code: authorizationCode,
                },
                { headers: this.headers },
            );

            if (data.status && data.data.status === 'success') {
                this.logger.log(`Charge successful: ${data.data.reference}`);
                return { success: true, reference: data.data.reference };
            }

            return { success: false, error: data.data?.gateway_response || data.message };
        } catch (error: any) {
            this.logger.error(`Paystack chargeAuthorization failed: ${error.message}`);
            return {
                success: false,
                error: error.response?.data?.message || error.message,
            };
        }
    }
}
