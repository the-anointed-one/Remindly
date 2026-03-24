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
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/automation.dto';
import { CurrentUser } from '../../common/decorators';

@Controller('automations')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.automationService.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.automationService.findAll(tenantId);
  }

  @Get('triggers/supported')
  getSupportedTriggers() {
    return this.automationService.getSupportedTriggers();
  }

  @Get('actions/supported')
  getSupportedActions() {
    return this.automationService.getSupportedActions();
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.automationService.findOne(tenantId, id);
  }

  @Get(':id/executions')
  getExecutions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.automationService.getExecutions(
      tenantId,
      id,
      Math.min(limit, 200),
    );
  }

  @Patch(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.automationService.update(tenantId, id, dto);
  }

  @Patch(':id/toggle')
  toggle(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.automationService.toggleActive(tenantId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.automationService.remove(tenantId, id);
  }
}
