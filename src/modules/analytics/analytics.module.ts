import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterService } from './analytics-filter.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsFilterService],
  exports: [AnalyticsService, AnalyticsFilterService],
})
export class AnalyticsModule {}
