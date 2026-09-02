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
    // Callers PATCH a flat partial-settings object (e.g. { onboardingCompleted: true }),
    // which the service deep-merges into the settings JSON. Reading @Body('settings')
    // here would look for a nested `settings` key that no caller sends, silently
    // discarding the update while still returning 200.
    @Body() settings: Record<string, unknown>,
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

  @Get('timezone')
  getTimezone(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantService.getTimezone(tenantId);
  }

  @Patch('timezone')
  updateTimezone(
    @CurrentUser('tenantId') tenantId: string,
    @Body('timezone') timezone: string,
  ) {
    return this.tenantService.updateTimezone(tenantId, timezone);
  }
}
