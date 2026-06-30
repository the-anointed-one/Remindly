import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';
import {
  MessagingProvider,
  SendSmsResult,
  SendVoiceResult,
  SendWhatsAppResult,
  WebhookValidationResult,
} from './messaging.provider';

@Injectable()
export class TwilioProvider implements MessagingProvider {
  private readonly logger = new Logger(TwilioProvider.name);
  private readonly client: twilio.Twilio;
  private readonly fromNumber: string;
  private readonly whatsappNumber: string;
  private readonly authToken: string;
  private readonly webhookUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN', '');
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER', '');
    this.whatsappNumber = this.configService.get<string>(
      'TWILIO_WHATSAPP_NUMBER',
      '',
    );
    this.webhookUrl = this.configService.get<string>(
      'TWILIO_WEBHOOK_URL',
      'http://localhost:3000/api/webhooks/twilio',
    );

    this.client = twilio.default(accountSid, this.authToken);

    if (!accountSid || !this.authToken) {
      this.logger.warn(
        'Twilio credentials not configured — SMS/Voice will fail. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
      );
    }
  }

  // ── SMS ────────────────────────────────────

  async sendSms(to: string, body: string, fromOverride?: string): Promise<SendSmsResult> {
    try {
      const from = fromOverride || this.fromNumber;
      const useWebhook =
        this.webhookUrl && !this.webhookUrl.includes('localhost');
      const message = await this.client.messages.create({
        to,
        from,
        body,
        ...(useWebhook ? { statusCallback: `${this.webhookUrl}/status` } : {}),
      });

      this.logger.log(`SMS sent to ${to} → SID: ${message.sid}`);

      return {
        success: true,
        providerMessageId: message.sid,
      };
    } catch (error: any) {
      this.logger.error(`SMS to ${to} failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Twilio SMS failed',
      };
    }
  }

  // ── Voice ──────────────────────────────────

  async sendVoice(to: string, twiml: string): Promise<SendVoiceResult> {
    try {
      const call = await this.client.calls.create({
        to,
        from: this.fromNumber,
        twiml,
        statusCallback: `${this.webhookUrl}/voice-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      });

      this.logger.log(`Voice call to ${to} → SID: ${call.sid}`);

      return {
        success: true,
        providerCallId: call.sid,
      };
    } catch (error: any) {
      this.logger.error(`Voice call to ${to} failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Twilio Voice failed',
      };
    }
  }

  // ── WhatsApp ───────────────────────────────

  async sendWhatsApp(to: string, body: string): Promise<SendWhatsAppResult> {
    try {
      const message = await this.client.messages.create({
        to: `whatsapp:${to}`,
        from: `whatsapp:${this.whatsappNumber}`,
        body,
      });

      this.logger.log(`WhatsApp sent to ${to} → SID: ${message.sid}`);

      return {
        success: true,
        providerMessageId: message.sid,
      };
    } catch (error: any) {
      this.logger.error(`WhatsApp to ${to} failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Twilio WhatsApp failed',
      };
    }
  }

  // ── TwiML generation ───────────────────────

  /**
   * Generate TwiML for an appointment reminder with IVR:
   *   Press 1 to confirm
   *   Press 2 to cancel
   */
  static generateReminderTwiml(
    appointmentTitle: string,
    customerName: string,
    appointmentTime: string,
    gatherCallbackUrl: string,
  ): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    response.say(
      { voice: 'Polly.Joanna' },
      `Hello ${customerName}. This is a reminder about your upcoming appointment: ${appointmentTitle}, scheduled for ${appointmentTime}.`,
    );

    const gather = response.gather({
      numDigits: 1,
      action: gatherCallbackUrl,
      method: 'POST',
      timeout: 10,
    });

    gather.say(
      { voice: 'Polly.Joanna' },
      'Press 1 to confirm your appointment. Press 2 to reschedule. Press 3 to cancel.',
    );

    // If no input, repeat
    response.say(
      { voice: 'Polly.Joanna' },
      'We did not receive any input. Goodbye.',
    );

    return response.toString();
  }

  /**
   * Generate TwiML response for IVR digit press.
   */
  static generateGatherResponse(digit: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (digit === '1') {
      response.say(
        { voice: 'Polly.Joanna' },
        'Thank you. Your appointment has been confirmed. Goodbye.',
      );
    } else if (digit === '2') {
      response.say(
        { voice: 'Polly.Joanna' },
        'We will send you available time options via SMS shortly. Goodbye.',
      );
    } else if (digit === '3') {
      response.say(
        { voice: 'Polly.Joanna' },
        'Your appointment has been cancelled. Goodbye.',
      );
    } else {
      response.say({ voice: 'Polly.Joanna' }, 'Invalid selection. Goodbye.');
    }

    return response.toString();
  }

  // ── Webhook validation ─────────────────────

  validateWebhook(
    signature: string,
    url: string,
    params: Record<string, string>,
  ): WebhookValidationResult {
    try {
      const valid = twilio.validateRequest(
        this.authToken,
        signature,
        url,
        params,
      );

      return { valid };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }
}
