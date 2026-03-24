import { Controller, Get } from '@nestjs/common';
import {
  UsageValidationService,
  FeatureType,
} from './usage-validation.service';
import { RateLimitService } from './rate-limit.service';
import { CurrentUser } from '../../common/decorators';

@Controller('usage')
export class UsageController {
  constructor(
    private readonly usageValidation: UsageValidationService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get()
  getUsageStats(@CurrentUser('tenantId') tenantId: string) {
    return this.usageValidation.getUsageStats(tenantId);
  }

  @Get('check/sms')
  async checkSms(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.usageValidation.validate(tenantId, 'SMS');
    const rateLimit = this.rateLimitService.getStatus(tenantId, 'SMS');
    return { ...result, rateLimit };
  }

  @Get('check/voice')
  async checkVoice(@CurrentUser('tenantId') tenantId: string) {
    return this.usageValidation.validate(tenantId, 'VOICE');
  }

  @Get('check/ai')
  async checkAi(@CurrentUser('tenantId') tenantId: string) {
    const result = await this.usageValidation.validate(tenantId, 'AI');
    const rateLimit = this.rateLimitService.getStatus(tenantId, 'AI');
    return { ...result, rateLimit };
  }
}
