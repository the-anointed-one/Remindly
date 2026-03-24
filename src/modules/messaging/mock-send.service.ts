import { Injectable, Logger } from '@nestjs/common';

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * Mock send service.
 *
 * Replace with actual provider integration (Twilio, Vonage, etc.)
 * when ready. This mock simulates a ~95% success rate with
 * realistic latency.
 */
@Injectable()
export class MockSendService {
  private readonly logger = new Logger(MockSendService.name);

  async sendSms(to: string, body: string): Promise<SendResult> {
    await this.simulateLatency();

    if (this.shouldFail()) {
      this.logger.warn(`[MOCK] SMS to ${to} FAILED (simulated)`);
      return {
        success: false,
        error: 'Simulated SMS delivery failure',
      };
    }

    const messageId = `mock_sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.logger.log(
      `[MOCK] SMS sent to ${to}: "${body.slice(0, 50)}..." → ${messageId}`,
    );

    return {
      success: true,
      providerMessageId: messageId,
    };
  }

  async sendVoice(to: string, script: string): Promise<SendResult> {
    await this.simulateLatency();

    const messageId = `mock_voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.logger.log(
      `[MOCK] Voice call to ${to}: "${script.slice(0, 50)}..." → ${messageId}`,
    );

    return {
      success: true,
      providerMessageId: messageId,
    };
  }

  async sendWhatsApp(to: string, body: string): Promise<SendResult> {
    await this.simulateLatency();

    const messageId = `mock_wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.logger.log(
      `[MOCK] WhatsApp to ${to}: "${body.slice(0, 50)}..." → ${messageId}`,
    );

    return {
      success: true,
      providerMessageId: messageId,
    };
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<SendResult> {
    await this.simulateLatency();

    const messageId = `mock_email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.logger.log(`[MOCK] Email to ${to}: "${subject}" → ${messageId}`);

    return {
      success: true,
      providerMessageId: messageId,
    };
  }

  private async simulateLatency() {
    const delay = 100 + Math.random() * 400; // 100–500ms
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private shouldFail(): boolean {
    return Math.random() < 0.05; // 5% failure rate
  }
}
