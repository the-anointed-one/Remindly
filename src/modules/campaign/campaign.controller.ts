import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CurrentUser } from '../../common/decorators';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  CreateSegmentDto,
  UpdateSegmentDto,
  CreateTagDto,
  AssignTagsDto,
  DispatchCampaignDto,
} from './dto/campaign.dto';

// ── Campaign Controller ───────────────────────

@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  createCampaign(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignService.createCampaign(tenantId, dto);
  }

  @Get()
  findAllCampaigns(@CurrentUser('tenantId') tenantId: string) {
    return this.campaignService.findAllCampaigns(tenantId);
  }

  @Get(':id')
  findOneCampaign(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignService.findOneCampaign(tenantId, id);
  }

  @Patch(':id')
  updateCampaign(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignService.updateCampaign(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  removeCampaign(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignService.removeCampaign(tenantId, id);
  }

  @Get(':id/recipients')
  getRecipients(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignService.getRecipients(tenantId, id);
  }

  @Get(':id/responses')
  getResponses(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignService.getResponses(tenantId, id);
  }

  /** GET /campaigns/:id/responses/dashboard?status=&tagId=&groupId=&segmentId= */
  @Get(':id/responses/dashboard')
  getResponseDashboard(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('tagId') tagId?: string,
    @Query('groupId') groupId?: string,
    @Query('segmentId') segmentId?: string,
  ) {
    return this.campaignService.getResponseDashboard(tenantId, id, {
      status,
      tagId,
      groupId,
      segmentId,
    });
  }

  @Post(':id/dispatch')
  @HttpCode(HttpStatus.OK)
  dispatch(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: DispatchCampaignDto,
  ) {
    return this.campaignService.dispatchCampaign(tenantId, id, dto);
  }

  @Post(':id/segments')
  createSegment(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') campaignId: string,
    @Body() dto: CreateSegmentDto,
  ) {
    return this.campaignService.createSegment(tenantId, campaignId, dto);
  }

  @Get(':id/segments')
  findSegments(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') campaignId: string,
  ) {
    return this.campaignService.findSegments(tenantId, campaignId);
  }

  @Patch(':id/segments/:segmentId')
  updateSegment(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') campaignId: string,
    @Param('segmentId') segmentId: string,
    @Body() dto: UpdateSegmentDto,
  ) {
    return this.campaignService.updateSegment(
      tenantId,
      campaignId,
      segmentId,
      dto,
    );
  }

  @Delete(':id/segments/:segmentId')
  @HttpCode(HttpStatus.OK)
  removeSegment(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') campaignId: string,
    @Param('segmentId') segmentId: string,
  ) {
    return this.campaignService.removeSegment(tenantId, campaignId, segmentId);
  }

  @Get(':id/segments/:segmentId/count')
  getSegmentCount(
    @CurrentUser('tenantId') tenantId: string,
    @Param('segmentId') segmentId: string,
  ) {
    return this.campaignService.getSegmentContactCount(tenantId, segmentId);
  }

  // ── Response Stats ─────────────────────────────────────────────────────────

  /** GET /campaigns/:id/stats — campaign-level response breakdown */
  @Get(':id/stats')
  getStats(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.campaignService.getResponseStats(tenantId, id);
  }

  /** GET /campaigns/:id/stats/all — campaign + all segment/tag breakdowns in one call */
  @Get(':id/stats/all')
  getStatsAll(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.campaignService.getResponseStatsAll(tenantId, id);
  }

  /** GET /campaigns/:id/stats/segment/:segmentId */
  @Get(':id/stats/segment/:segmentId')
  getStatsBySegment(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('segmentId') segmentId: string,
  ) {
    return this.campaignService.getResponseStatsBySegment(
      tenantId,
      id,
      segmentId,
    );
  }

  /** GET /campaigns/:id/stats/tag/:tagId */
  @Get(':id/stats/tag/:tagId')
  getStatsByTag(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.campaignService.getResponseStatsByTag(tenantId, id, tagId);
  }

  /** GET /campaigns/:id/stats/group/:groupId */
  @Get(':id/stats/group/:groupId')
  getStatsByGroup(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('groupId') groupId: string,
  ) {
    return this.campaignService.getResponseStatsByGroup(tenantId, id, groupId);
  }

  /** GET /campaigns/:id/stats/appointment/:appointmentId */
  @Get(':id/stats/appointment/:appointmentId')
  getStatsByAppointment(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.campaignService.getResponseStatsByAppointment(
      tenantId,
      id,
      appointmentId,
    );
  }
}

// ── Tags Controller ───────────────────────────

@Controller('tags')
export class TagsController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateTagDto) {
    return this.campaignService.createTag(tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.campaignService.findAllTags(tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') tagId: string,
  ) {
    return this.campaignService.removeTag(tenantId, tagId);
  }

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  assign(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: AssignTagsDto,
  ) {
    return this.campaignService.assignTags(tenantId, dto);
  }

  @Delete('contacts/:contactId/tags/:tagId')
  @HttpCode(HttpStatus.OK)
  removeFromContact(
    @CurrentUser('tenantId') tenantId: string,
    @Param('contactId') contactId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.campaignService.removeTagFromContact(
      tenantId,
      contactId,
      tagId,
    );
  }
}
