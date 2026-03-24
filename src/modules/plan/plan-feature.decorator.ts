import { SetMetadata } from '@nestjs/common';
import { FeatureType } from './usage-validation.service';
import { PLAN_FEATURE_KEY } from './plan.guard';

/**
 * Decorator to mark a controller method as consuming a metered feature.
 * The PlanGuard will enforce trial/subscription limits before execution.
 *
 * Usage:
 *   @PlanFeature('SMS')
 *   @Post('send')
 *   sendSms() { ... }
 */
export const PlanFeature = (feature: FeatureType) =>
  SetMetadata(PLAN_FEATURE_KEY, feature);
