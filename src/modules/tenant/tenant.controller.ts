import { Controller, Get, Patch, Body } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CurrentUser } from '../../common/decorators';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantService.findAll(tenantId);
  }

  @Get('settings')
  getSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantService.getSettings(tenantId);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser('tenantId') tenantId: string,
    @Body('settings') settings: Record<string, unknown>,
  ) {
    return this.tenantService.updateSettings(tenantId, settings);
  }

  @Get('sender-identity')
  getSenderIdentity(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantService.getSenderIdentity(tenantId);
  }

  @Patch('sender-identity')
  updateSenderIdentity(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { senderName?: string; senderEmail?: string; senderPhone?: string },
  ) {
    return this.tenantService.updateSenderIdentity(tenantId, dto);
  }
}
