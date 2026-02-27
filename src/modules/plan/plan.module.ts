import { Global, Module } from '@nestjs/common';
import { UsageValidationService } from './usage-validation.service';
import { RateLimitService } from './rate-limit.service';
import { PlanGuard } from './plan.guard';
import { UsageController } from './usage.controller';

@Global()
@Module({
    controllers: [UsageController],
    providers: [UsageValidationService, RateLimitService, PlanGuard],
    exports: [UsageValidationService, RateLimitService, PlanGuard],
})
export class PlanModule { }
