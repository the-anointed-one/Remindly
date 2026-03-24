import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  UsageValidationService,
  FeatureType,
} from './usage-validation.service';
import { RateLimitService } from './rate-limit.service';
import { PrismaService } from '../../prisma/prisma.service';

export const PLAN_FEATURE_KEY = 'plan_feature';

/**
 * Use with @SetMetadata('plan_feature', 'SMS') on controller methods
 * that consume a metered feature.
 */
@Injectable()
export class PlanGuard implements CanActivate {
  private readonly logger = new Logger(PlanGuard.name);
  private readonly allowTrialWithoutCard: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly usageValidation: UsageValidationService,
    private readonly rateLimitService: RateLimitService,
    private readonly prisma: PrismaService,
  ) {
    this.allowTrialWithoutCard = this.configService.get<boolean>(
      'ALLOW_TRIAL_WITHOUT_CARD',
      false,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get feature type from metadata (e.g. @SetMetadata('plan_feature', 'SMS'))
    const feature = this.reflector.getAllAndOverride<FeatureType>(
      PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No feature annotation → not a metered endpoint, allow through
    if (!feature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context');
    }

    const tenantId = user.tenantId;
    const userId = user.userId;

    // 1. Card-required trial check
    if (!this.allowTrialWithoutCard) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { trialActive: true, subscriptionStatus: true },
      });

      if (tenant?.trialActive && tenant?.subscriptionStatus === 'TRIALING') {
        // In card-required mode, TRIALING means card is on file
        // (the billing integration would validate this at signup)
        // For now, we allow trialing tenants through
      }
    }

    // 2. Check rate limits
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { trialActive: true },
    });

    await this.rateLimitService.checkRateLimit(
      tenantId,
      feature,
      tenant?.trialActive ?? false,
    );

    // 3. Validate usage limits & increment
    await this.usageValidation.validateAndIncrement(tenantId, feature, userId);

    return true;
  }
}
