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

export interface SendWhatsAppResult {
  success: boolean;
  providerMessageId?: string;
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
   * Send a WhatsApp message via Twilio WhatsApp Business API.
   * The `to` number should be in E.164 format — the whatsapp: prefix is added internally.
   */
  sendWhatsApp(to: string, body: string): Promise<SendWhatsAppResult>;

  /**
   * Validate an incoming webhook signature.
   */
  validateWebhook(
    signature: string,
    url: string,
    params: Record<string, string>,
  ): WebhookValidationResult;
}
