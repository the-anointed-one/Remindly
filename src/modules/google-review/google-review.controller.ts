import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Redirect,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { GoogleReviewService } from './google-review.service';
import { ConnectLocationDto, UpdateDraftDto, GenerateReplyDto } from './dto';
import { ConfigService } from '@nestjs/config';

@Controller('google-reviews')
export class GoogleReviewController {
  constructor(
    private readonly service: GoogleReviewService,
    private readonly configService: ConfigService,
  ) {}

  // ── OAuth Connect ──────────────────────────

  /**
   * GET /google-reviews/connect
   * Returns the Google OAuth URL. Frontend redirects the user there.
   */
  @Get('connect')
  getConnectUrl(@CurrentUser('tenantId') tenantId: string) {
    return this.service.getConnectUrl(tenantId);
  }

  /**
   * GET /google-reviews/oauth/callback  (Public — Google redirects here)
   * Exchanges the code, stores tokens, then redirects the user to the
   * dashboard page where they can select their location.
   */
  @Public()
  @Get('oauth/callback')
  @Redirect()
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
  ) {
    const frontendBase = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    if (error) {
      return {
        url: `${frontendBase}/dashboard/settings?google_error=${encodeURIComponent(error)}`,
      };
    }

    try {
      const result = await this.service.handleOAuthCallback(code, state);
      const locationsParam = encodeURIComponent(
        JSON.stringify(result.locations),
      );
      return {
        url: `${frontendBase}/dashboard/settings?google_connected=true&locations=${locationsParam}`,
      };
    } catch (err: any) {
      return {
        url: `${frontendBase}/dashboard/settings?google_error=${encodeURIComponent(err.message)}`,
      };
    }
  }

  // ── Connection Management ──────────────────

  /**
   * GET /google-reviews/connection
   * Returns whether this tenant has a connected Google Business account.
   */
  @Get('connection')
  getConnectionStatus(@CurrentUser('tenantId') tenantId: string) {
    return this.service.getConnectionStatus(tenantId);
  }

  /**
   * PATCH /google-reviews/connection/location
   * Let the user choose which business location to track.
   */
  @Patch('connection/location')
  selectLocation(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: ConnectLocationDto,
  ) {
    return this.service.selectLocation(
      tenantId,
      body.locationId,
      body.locationName,
    );
  }

  /**
   * DELETE /google-reviews/connection
   * Disconnect the Google Business account.
   */
  @Delete('connection')
  @HttpCode(HttpStatus.OK)
  disconnect(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.disconnect(tenantId, userId);
  }

  // ── Sync ──────────────────────────────────

  /**
   * POST /google-reviews/sync
   * Fetch new reviews from Google and auto-generate AI suggestions.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  syncReviews(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.syncReviews(tenantId, userId);
  }

  // ── Review Listing ─────────────────────────

  /**
   * GET /google-reviews
   * List all reviews for this tenant. Filter by status.
   */
  @Get()
  listReviews(
    @CurrentUser('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listReviews(tenantId, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  /**
   * GET /google-reviews/:id
   * Get a single review with full details.
   */
  @Get(':id')
  getReview(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getReview(tenantId, id);
  }

  // ── AI Generation ──────────────────────────

  /**
   * POST /google-reviews/:id/generate
   * (Re)generate an AI reply suggestion for a review.
   */
  @Post(':id/generate')
  @HttpCode(HttpStatus.OK)
  generateReply(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() body: GenerateReplyDto,
  ) {
    return this.service.generateSuggestion(tenantId, userId, id, body.tone);
  }

  // ── Draft ──────────────────────────────────

  /**
   * PATCH /google-reviews/:id/draft
   * Save an edited reply draft before approving.
   */
  @Patch(':id/draft')
  updateDraft(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: UpdateDraftDto,
  ) {
    return this.service.updateDraft(tenantId, id, body.draftReply);
  }

  // ── Approve / Skip ─────────────────────────

  /**
   * POST /google-reviews/:id/approve
   * Approve the draft and post it to Google.
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approveAndPost(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.approveAndPost(tenantId, userId, id);
  }

  /**
   * POST /google-reviews/:id/skip
   * Mark a review as intentionally skipped (no reply needed).
   */
  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  skipReview(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.skipReview(tenantId, userId, id);
  }
}
