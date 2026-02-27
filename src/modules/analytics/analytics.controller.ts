import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../../common/decorators';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get()
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.analyticsService.findAll(tenantId);
    }
}
