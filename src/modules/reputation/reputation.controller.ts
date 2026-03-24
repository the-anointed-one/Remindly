import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ReputationService } from './reputation.service';
import { CurrentUser } from '../../common/decorators';

@Controller('reputation')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('stats')
  getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.reputationService.getStats(tenantId);
  }

  @Get('responses')
  getResponses(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reputationService.getResponses(
      tenantId,
      page ? +page : 1,
      limit ? +limit : 20,
    );
  }

  @Post('request/:appointmentId')
  sendFeedbackRequest(
    @CurrentUser('tenantId') tenantId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.reputationService.sendFeedbackRequest(appointmentId, tenantId);
  }
}
