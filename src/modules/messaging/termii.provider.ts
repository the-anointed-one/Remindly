import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TermiiProvider {
  private readonly logger = new Logger(TermiiProvider.name);
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly baseUrl: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get('TERMII_API_KEY', '');
    this.senderId = this.config.get('TERMII_SENDER_ID', 'Meetora');
    this.baseUrl = this.config.get(
      'TERMII_BASE_URL',
      'https://v3.api.termii.com',
    );
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async sendMessage(
    to: string,
    message: string,
    channel: 'generic' | 'whatsapp' | 'voice',
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      const { data } = await axios.post(`${this.baseUrl}/api/sms/send`, {
        to,
        from: this.senderId,
        sms: message,
        type: 'plain',
        api_key: this.apiKey,
        channel,
      });

      if (data.message_id || data.code === 'ok') {
        this.logger.log(
          `Termii [${channel}] sent to ${to}: ${data.message_id}`,
        );
        return { success: true, messageId: data.message_id };
      }

      this.logger.warn(`Termii [${channel}] rejected: ${data.message}`);
      return { success: false, error: data.message };
    } catch (err: any) {
      // Termii returns its reason in the response body on 4xx — surface that
      // rather than the bare "Request failed with status code 400".
      const apiMessage = err.response?.data?.message;
      const reason = apiMessage || err.message;
      this.logger.error(`Termii [${channel}] error to ${to}: ${reason}`);
      return { success: false, error: reason };
    }
  }

  sendSms(to: string, message: string) {
    return this.sendMessage(to, message, 'generic');
  }

  sendWhatsApp(to: string, message: string) {
    return this.sendMessage(to, message, 'whatsapp');
  }

  sendVoice(to: string, message: string) {
    return this.sendMessage(to, message, 'voice');
  }

  parseInbound(payload: any): {
    from: string;
    body: string;
    messageId: string;
  } {
    return {
      from: payload.from || payload.sender || payload.msisdn || '',
      body: (payload.text || payload.sms || payload.data || '')
        .trim()
        .toUpperCase(),
      messageId: payload.id || payload.message_id || `termii-${Date.now()}`,
    };
  }
}
