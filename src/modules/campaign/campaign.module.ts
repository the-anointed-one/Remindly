import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController, TagsController } from './campaign.controller';

@Module({
  controllers: [CampaignController, TagsController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
