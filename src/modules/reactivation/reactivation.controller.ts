import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ReactivationService } from './reactivation.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/reactivation.dto';
import { CurrentUser } from '../../common/decorators';

@Controller('reactivation')
export class ReactivationController {
  constructor(private readonly reactivationService: ReactivationService) {}

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.reactivationService.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.reactivationService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.reactivationService.findOne(tenantId, id);
  }

  @Put(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.reactivationService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.reactivationService.remove(tenantId, id);
  }

  @Post(':id/run')
  runCampaign(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.reactivationService.runCampaign(tenantId, id);
  }

  @Get(':id/inactive-count')
  async getInactiveCount(
    @CurrentUser('tenantId') tenantId: string,
    @Query('days') days?: string,
  ) {
    const count = await this.reactivationService.getInactiveCount(
      tenantId,
      days ? +days : 60,
    );
    return { count };
  }
}
