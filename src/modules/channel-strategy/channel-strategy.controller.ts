import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ChannelStrategyService } from './channel-strategy.service';
import { CreateChannelStrategyDto, UpdateChannelStrategyDto } from './dto';
import { CurrentUser } from '../../common/decorators';

@Controller('channel-strategies')
export class ChannelStrategyController {
  constructor(private readonly service: ChannelStrategyService) {}

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateChannelStrategyDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(tenantId, id);
  }

  @Put(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelStrategyDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(tenantId, id);
  }
}
