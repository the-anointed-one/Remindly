import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../../common/decorators';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** GET /analytics/dashboard — hero metrics + week-over-week trends */
  @Get('dashboard')
  getDashboardMetrics(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getDashboard(
      tenantId,
      query.from,
      query.to,
      query.excludeDemo,
    );
  }

  /** GET /analytics/hero-metrics — alias for dashboard (backward compat) */
  @Get('hero-metrics')
  getHeroMetrics(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getDashboardMetrics(
      tenantId,
      query.excludeDemo,
    );
  }

  /** GET /analytics/attendance-overview — dashboard summary metrics */
  @Get('attendance-overview')
  getAttendanceOverview(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAttendanceOverview(
      tenantId,
      query.excludeDemo,
    );
  }

  /** GET /analytics/confirmation-rate?days=30 — daily confirmation rate timeseries */
  @Get('confirmation-rate')
  getConfirmationRateOverTime(
    @CurrentUser('tenantId') tenantId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    const clamped = Math.min(Math.max(days, 7), 90);
    return this.analyticsService.getConfirmationRateOverTime(
      tenantId,
      clamped,
      query.excludeDemo,
    );
  }

  /** GET /analytics/no-show-reduction?weeks=8 — weekly no-show vs prevention breakdown */
  @Get('no-show-reduction')
  getNoShowReduction(
    @CurrentUser('tenantId') tenantId: string,
    @Query('weeks', new DefaultValuePipe(8), ParseIntPipe) weeks: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    const clamped = Math.min(Math.max(weeks, 4), 16);
    return this.analyticsService.getNoShowReduction(
      tenantId,
      clamped,
      query.excludeDemo,
    );
  }

  /** GET /analytics/channel-performance — per-channel delivery stats */
  @Get('channel-performance')
  getChannelPerformance(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getChannelPerformance(
      tenantId,
      query.excludeDemo,
    );
  }

  /** GET /analytics/activity?limit=20 — global recent activity feed */
  @Get('activity')
  getRecentActivity(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.analyticsService.getRecentActivity(tenantId, limit);
  }

  /** GET /analytics — legacy alias */
  @Get()
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getDashboardMetrics(
      tenantId,
      query.excludeDemo,
    );
  }
}
