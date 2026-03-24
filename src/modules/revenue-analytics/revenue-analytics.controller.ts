import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { RevenueAnalyticsService } from './revenue-analytics.service';
import { CurrentUser } from '../../common/decorators';

@Controller('revenue-analytics')
export class RevenueAnalyticsController {
  constructor(private readonly service: RevenueAnalyticsService) {}

  /** GET /revenue-analytics/snapshot — compact 5-metric snapshot for dashboard cards */
  @Get('snapshot')
  getSnapshot(@CurrentUser('tenantId') tenantId: string) {
    return this.service.getSnapshot(tenantId);
  }

  /** GET /revenue-analytics/summary — full revenue summary with ROI, projections */
  @Get('summary')
  getSummary(@CurrentUser('tenantId') tenantId: string) {
    return this.service.getSummary(tenantId);
  }

  /** GET /revenue-analytics/over-time?days=30 — daily/weekly revenue recovered timeseries */
  @Get('over-time')
  getOverTime(
    @CurrentUser('tenantId') tenantId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.service.getOverTime(tenantId, days);
  }

  /** GET /revenue-analytics/by-channel — revenue attributed per messaging channel */
  @Get('by-channel')
  getByChannel(@CurrentUser('tenantId') tenantId: string) {
    return this.service.getByChannel(tenantId);
  }
}
