import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { CurrentUser } from '../../common/decorators';

@Controller('predictions')
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Get('stats')
  getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.predictionService.getStats(tenantId);
  }

  @Get('high-risk')
  getHighRisk(
    @CurrentUser('tenantId') tenantId: string,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.predictionService.getHighRiskAppointments(tenantId, days);
  }

  @Get('appointment/:appointmentId')
  getForAppointment(
    @CurrentUser('tenantId') tenantId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.predictionService.getForAppointment(tenantId, appointmentId);
  }

  @Post('appointment/:appointmentId/recalculate')
  recalculate(
    @CurrentUser('tenantId') tenantId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.predictionService.recalculate(tenantId, appointmentId);
  }
}
