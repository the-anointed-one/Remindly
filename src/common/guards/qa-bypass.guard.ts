import { Injectable, ExecutionContext, CanActivate, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * QA Bypass Guard
 *
 * Allows automated testing of payment flow without triggering Paystack fraud detection.
 * This guard should be used alongside the billing controller to detect QA test headers
 * and mock successful payment responses.
 *
 * Environment Variables:
 * - ENABLE_QA_BYPASS: Set to 'true' to enable QA bypass in non-production environments
 * - QA_BYPASS_TOKEN: Secret token required in x-qa-bypass header
 *
 * Usage:
 * @UseGuards(QaBypassGuard)
 * @Post('initialize-qa')
 * async initializeQaPayment(...) { ... }
 */

@Injectable()
export class QaBypassGuard implements CanActivate {
  private readonly logger = new Logger(QaBypassGuard.name);
  private readonly isQaBypassEnabled: boolean;
  private readonly qaBypassToken: string;

  constructor(private readonly configService: ConfigService) {
    this.isQaBypassEnabled = this.configService.get('ENABLE_QA_BYPASS') === 'true';
    this.qaBypassToken = this.configService.get('QA_BYPASS_TOKEN', '');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const bypassHeader = request.headers['x-qa-bypass'];
    const isTestEnv = process.env.NODE_ENV === 'test';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Check if QA bypass is enabled and conditions are met
    const canBypass = this.isQaBypassEnabled && (isTestEnv || isDevelopment);

    if (!canBypass) {
      // Log attempt to use bypass when not enabled
      if (bypassHeader) {
        this.logger.warn(
          `QA bypass header detected but bypass is disabled or not in test/development environment. ` +
          `env=${process.env.NODE_ENV}, enabled=${this.isQaBypassEnabled}`
        );
      }
      return true; // Fall through to normal auth (payment will proceed normally)
    }

    // Validate the bypass token
    if (bypassHeader !== this.qaBypassToken) {
      this.logger.warn('Invalid QA bypass token provided');
      return true; // Fall through to normal auth
    }

    // Valid QA bypass - set flag on request
    this.logger.log('QA bypass activated - mocking payment flow');
    request.qaMockPayment = true;

    // Log for audit trail
    this.logger.log(`QA bypass used - User: ${request.user?.email || 'unknown'}, Tenant: ${request.user?.tenantId || 'unknown'}`);

    return true;
  }

  /**
   * Check if current request has QA mock payment enabled
   */
  static isMockPayment(request: any): boolean {
    return request.qaMockPayment === true;
  }
}
