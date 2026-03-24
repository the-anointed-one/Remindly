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
import { ReminderService } from './reminder.service';
import {
  CreateReminderRuleDto,
  UpdateReminderRuleDto,
} from './dto/reminder-rule.dto';
import { CurrentUser } from '../../common/decorators';

@Controller('reminder-rules')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReminderRuleDto,
  ) {
    return this.reminderService.createRule(tenantId, userId, dto);
  }

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.reminderService.findAllRules(tenantId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reminderService.findOneRule(tenantId, id);
  }

  @Put(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReminderRuleDto,
  ) {
    return this.reminderService.updateRule(tenantId, userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reminderService.removeRule(tenantId, userId, id);
  }

  @Get(':id/preview')
  preview(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reminderService.previewRule(tenantId, id);
  }
}
