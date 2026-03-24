import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  Redirect,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CalendarIntegrationService } from './calendar-integration.service';
import { CalendarProvider } from '@prisma/client';
import { CurrentUser } from '../../common/decorators';
import { Public } from '../../common/decorators';
import { ConfigService } from '@nestjs/config';

@Controller('calendar')
export class CalendarIntegrationController {
  constructor(
    private readonly calendarService: CalendarIntegrationService,
    private readonly config: ConfigService,
  ) {}

  /**
   * GET /calendar/connect?provider=GOOGLE|OUTLOOK
   * Returns the OAuth authorization URL.
   */
  @Get('connect')
  getConnectUrl(
    @CurrentUser('tenantId') tenantId: string,
    @Query('provider') provider: string,
  ) {
    const p = provider?.toUpperCase() as CalendarProvider;
    if (!Object.values(CalendarProvider).includes(p)) {
      return { error: 'Invalid provider. Use GOOGLE or OUTLOOK.' };
    }
    return this.calendarService.getConnectUrl(tenantId, p);
  }

  /**
   * GET /calendar/google/callback  — OAuth redirect from Google
   */
  @Public()
  @Get('google/callback')
  @Redirect()
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
  ) {
    const frontendUrl = this.config.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const base = `${frontendUrl}/dashboard/settings`;

    if (error || !code) {
      return {
        url: `${base}?calendar_error=${encodeURIComponent(error || 'no_code')}`,
      };
    }

    try {
      const result = await this.calendarService.handleOAuthCallback(
        code,
        state,
      );
      return {
        url: `${base}?calendar_connected=google&email=${encodeURIComponent(result.email)}`,
      };
    } catch (err: any) {
      return {
        url: `${base}?calendar_error=${encodeURIComponent(err.message || 'oauth_failed')}`,
      };
    }
  }

  /**
   * GET /calendar/outlook/callback  — OAuth redirect from Microsoft
   */
  @Public()
  @Get('outlook/callback')
  @Redirect()
  async outlookCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
  ) {
    const frontendUrl = this.config.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const base = `${frontendUrl}/dashboard/settings`;

    if (error || !code) {
      return {
        url: `${base}?calendar_error=${encodeURIComponent(error || 'no_code')}`,
      };
    }

    try {
      const result = await this.calendarService.handleOAuthCallback(
        code,
        state,
      );
      return {
        url: `${base}?calendar_connected=outlook&email=${encodeURIComponent(result.email)}`,
      };
    } catch (err: any) {
      return {
        url: `${base}?calendar_error=${encodeURIComponent(err.message || 'oauth_failed')}`,
      };
    }
  }

  /**
   * GET /calendar/connections
   * List all calendar connections for this tenant.
   */
  @Get('connections')
  getConnections(@CurrentUser('tenantId') tenantId: string) {
    return this.calendarService.getConnections(tenantId);
  }

  /**
   * DELETE /calendar/connections/:provider
   * Disconnect a calendar.
   */
  @Delete('connections/:provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @CurrentUser('tenantId') tenantId: string,
    @Param('provider') provider: string,
  ) {
    const p = provider?.toUpperCase() as CalendarProvider;
    await this.calendarService.disconnect(tenantId, p);
  }

  /**
   * POST /calendar/sync/:provider
   * Manually trigger a calendar sync.
   */
  @Post('sync/:provider')
  triggerSync(
    @CurrentUser('tenantId') tenantId: string,
    @Param('provider') provider: string,
  ) {
    const p = provider?.toUpperCase() as CalendarProvider;
    return this.calendarService.enqueueSyncNow(tenantId, p);
  }
}
