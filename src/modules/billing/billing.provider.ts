/**
 * BillingProvider — abstract interface for payment providers.
 * Implement for Paystack, Stripe, etc.
 */
export interface CreateCustomerParams {
  email: string;
  firstName?: string;
  lastName?: string;
  tenantId: string;
}

export interface CreateSubscriptionParams {
  email: string;
  customerCode: string;
  planCode: string;
  amount?: number; // Optional: amount in smallest currency unit (e.g. kobo)
  startDate?: string; // ISO date for trial end auto-conversion
}

export interface BillingCustomerResult {
  success: boolean;
  customerCode?: string;
  error?: string;
}

export interface BillingSubscriptionResult {
  success: boolean;
  subscriptionCode?: string;
  authorizationUrl?: string; // redirect URL for checkout
  reference?: string;
  error?: string;
}

export interface BillingProvider {
  createCustomer(params: CreateCustomerParams): Promise<BillingCustomerResult>;
  initializeSubscription(
    params: CreateSubscriptionParams,
  ): Promise<BillingSubscriptionResult>;
  cancelSubscription(
    subscriptionCode: string,
    emailToken: string,
  ): Promise<{ success: boolean; error?: string }>;
  verifyTransaction(
    reference: string,
  ): Promise<{ success: boolean; status?: string; error?: string }>;
}
