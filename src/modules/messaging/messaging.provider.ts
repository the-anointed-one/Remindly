/**
 * MessagingProvider — abstract interface for all messaging providers.
 * Implement this for Twilio, Vonage, MessageBird, etc.
 */
export interface SendSmsResult {
    success: boolean;
    providerMessageId?: string;
    error?: string;
}

export interface SendVoiceResult {
    success: boolean;
    providerCallId?: string;
    error?: string;
}

export interface WebhookValidationResult {
    valid: boolean;
    error?: string;
}

export interface MessagingProvider {
    /**
     * Send an SMS message.
     */
    sendSms(to: string, body: string): Promise<SendSmsResult>;

    /**
     * Send a voice call with TwiML or script.
     */
    sendVoice(to: string, twimlOrScript: string): Promise<SendVoiceResult>;

    /**
     * Validate an incoming webhook signature.
     */
    validateWebhook(
        signature: string,
        url: string,
        params: Record<string, string>,
    ): WebhookValidationResult;
}
