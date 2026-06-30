import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;   // tenant override e.g. "Dr. Adebayo's Clinic"
  fromEmail?: string;  // tenant override e.g. "hello@myclinic.com"
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;
  private readonly devMode: boolean;

  constructor(private readonly config: ConfigService) {
    const smtpHost = config.get<string>('SMTP_HOST', '');
    this.fromAddress = config.get<string>(
      'SMTP_FROM',
      'Meetora <no-reply@meetora.co>',
    );
    this.devMode = !smtpHost;

    if (!this.devMode) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: config.get<number>('SMTP_PORT', 587),
        secure: config.get<number>('SMTP_PORT', 587) === 465,
        auth: {
          user: config.get<string>('SMTP_USER', ''),
          pass: config.get<string>('SMTP_PASS', ''),
        },
      });
      this.logger.log(`📧 Email provider initialized (SMTP: ${smtpHost})`);
    } else {
      this.logger.warn(
        '📧 SMTP not configured — emails will be logged to console only.',
      );
    }
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (this.devMode || !this.transporter) {
      this.logger.log(
        `\n${'─'.repeat(60)}\n📧 DEV EMAIL (not sent)\nTo: ${options.to}\nSubject: ${options.subject}\n\n${options.text || '[HTML email]'}\n${'─'.repeat(60)}`,
      );
      return;
    }

    try {
      // Use tenant sender identity if provided, else fall back to system default
      const from = options.fromEmail
        ? options.fromName
          ? `${options.fromName} <${options.fromEmail}>`
          : options.fromEmail
        : this.fromAddress;

      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      this.logger.log(`📧 Email sent to ${options.to} — "${options.subject}"`);
    } catch (err: any) {
      this.logger.error(`📧 Email to ${options.to} failed: ${err.message}`);
    }
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Reset your Meetora password',
      text: `Reset your password here: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, sans-serif; background: #0a0a0b; color: #f8fafc; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #111113; border: 1px solid #1e1e24; border-radius: 12px; padding: 40px;">
    <div style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">⚡ Meetora</div>
    <h1 style="font-size: 22px; font-weight: 700; margin: 24px 0 8px;">Reset your password</h1>
    <p style="color: #94a3b8; margin-bottom: 32px;">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Reset Password →</a>
    <p style="margin-top: 32px; font-size: 13px; color: #64748b;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
  </div>
</body>
</html>`,
    });
  }

  async sendWelcome(email: string, firstName: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Welcome to Meetora 🚀',
      text: `Hi ${firstName}! Welcome to Meetora. Get started by selecting your plan and entering your card details to activate your 14-day free trial.`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, sans-serif; background: #0a0a0b; color: #f8fafc; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #111113; border: 1px solid #1e1e24; border-radius: 12px; padding: 40px;">
    <div style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">⚡ Meetora</div>
    <h1 style="font-size: 22px; font-weight: 700; margin: 24px 0 8px;">Welcome, ${firstName}! 🎉</h1>
    <p style="color: #94a3b8; margin-bottom: 24px;">Your account is ready. Select a plan and enter your card to start your <strong>14-day free trial</strong>.</p>
    <p style="font-size: 13px; color: #64748b;">No charge for 14 days. Cancel anytime.</p>
  </div>
</body>
</html>`,
    });
  }
}
