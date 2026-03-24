import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleBusinessProvider } from './google-business.provider';
import { OpenAIProvider } from '../ai/openai.provider';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class GoogleReviewService {
  private readonly logger = new Logger(GoogleReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly googleProvider: GoogleBusinessProvider,
    private readonly openAIProvider: OpenAIProvider,
    private readonly auditService: AuditService,
  ) {}

  // ── Plan Enforcement ───────────────────────

  private async enforceTier3(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new ForbiddenException('Tenant not found');

    if (tenant.planType !== 'SMS_VOICE_AI') {
      throw new ForbiddenException(
        'Google Review Responder requires the SMS + Voice + AI plan (Tier 3). Please upgrade.',
      );
    }

    if (!tenant.trialActive && tenant.subscriptionStatus !== 'ACTIVE') {
      throw new ForbiddenException(
        'An active subscription is required to use this feature.',
      );
    }

    return tenant;
  }

  // ── Token Management ───────────────────────

  /**
   * Get a fresh access token for a connection, auto-refreshing if expired.
   */
  private async getFreshToken(connectionId: string): Promise<string> {
    const conn = await this.prisma.googleBusinessConnection.findUnique({
      where: { id: connectionId },
    });
    if (!conn)
      throw new NotFoundException('Google Business connection not found');

    if (new Date() < conn.tokenExpiresAt) {
      return conn.accessToken;
    }

    this.logger.log(
      `Refreshing expired Google token for connection ${connectionId}`,
    );
    const tokens = await this.googleProvider.refreshAccessToken(
      conn.refreshToken,
    );

    if (!tokens) {
      throw new BadRequestException(
        'Failed to refresh Google access token. Please reconnect your Google Business account.',
      );
    }

    await this.prisma.googleBusinessConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
      },
    });

    return tokens.accessToken;
  }

  // ── OAuth Connect Flow ─────────────────────

  /**
   * Step 1: Return the OAuth URL for the user to authorize.
   * State encodes the tenantId as a base64 string (not signed — add HMAC in production).
   */
  getConnectUrl(tenantId: string): { url: string } {
    const state = Buffer.from(
      JSON.stringify({ tenantId, ts: Date.now() }),
    ).toString('base64url');
    const url = this.googleProvider.buildAuthUrl(state);
    return { url };
  }

  /**
   * Step 2: Handle OAuth callback — exchange code, fetch first location, save connection.
   * Returns the tenant's first location list so the user can select which one to track.
   */
  async handleOAuthCallback(
    code: string,
    state: string,
  ): Promise<{
    tenantId: string;
    locations: Array<{ locationId: string; locationName: string }>;
  }> {
    let tenantId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      tenantId = decoded.tenantId;
    } catch {
      throw new BadRequestException('Invalid OAuth state parameter');
    }

    await this.enforceTier3(tenantId);

    const tokens = await this.googleProvider.exchangeCode(code);
    if (!tokens)
      throw new BadRequestException(
        'Failed to exchange authorization code with Google',
      );

    const accountInfo = await this.googleProvider.getAccount(
      tokens.accessToken,
    );
    if (!accountInfo)
      throw new BadRequestException(
        'No Google Business account found for this Google account',
      );

    const locations = await this.googleProvider.listLocations(
      tokens.accessToken,
      accountInfo.accountId,
    );

    // Store tokens + account ID temporarily so the user can select a location
    // Use a temp DB record with no locationId yet, or return to frontend for location selection
    // We'll upsert with the first location as a default — user can change via PATCH /connection/location
    const defaultLocation = locations[0];

    await this.prisma.googleBusinessConnection.upsert({
      where: { tenantId },
      create: {
        tenantId,
        googleAccountId: accountInfo.accountId,
        locationId: defaultLocation?.locationId || '',
        locationName: defaultLocation?.locationName || '',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
      },
      update: {
        googleAccountId: accountInfo.accountId,
        locationId: defaultLocation?.locationId || '',
        locationName: defaultLocation?.locationName || '',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
      },
    });

    await this.auditService.log({
      tenantId,
      action: 'CREATE',
      entity: 'GoogleBusinessConnection',
      entityId: tenantId,
      newValues: {
        accountId: accountInfo.accountId,
        locationCount: locations.length,
      },
    });

    this.logger.log(
      `Google Business connected for tenant ${tenantId} — ${locations.length} location(s)`,
    );

    return {
      tenantId,
      locations: locations.map((l) => ({
        locationId: l.locationId,
        locationName: l.locationName,
      })),
    };
  }

  /**
   * Step 3 (optional): Let user pick which location to track reviews for.
   */
  async selectLocation(
    tenantId: string,
    locationId: string,
    locationName?: string,
  ) {
    await this.enforceTier3(tenantId);

    const conn = await this.prisma.googleBusinessConnection.findUnique({
      where: { tenantId },
    });
    if (!conn)
      throw new NotFoundException(
        'No Google Business connection found. Please connect first.',
      );

    // Validate the location belongs to their account
    const accessToken = await this.getFreshToken(conn.id);
    const locations = await this.googleProvider.listLocations(
      accessToken,
      conn.googleAccountId,
    );
    const match = locations.find((l) => l.locationId === locationId);
    if (!match)
      throw new BadRequestException(
        'Location not found in your Google Business account',
      );

    await this.prisma.googleBusinessConnection.update({
      where: { id: conn.id },
      data: { locationId, locationName: locationName || match.locationName },
    });

    return { locationId, locationName: locationName || match.locationName };
  }

  // ── Connection Status ──────────────────────

  async getConnectionStatus(tenantId: string) {
    await this.enforceTier3(tenantId);

    const conn = await this.prisma.googleBusinessConnection.findUnique({
      where: { tenantId },
      select: {
        id: true,
        googleAccountId: true,
        locationId: true,
        locationName: true,
        connectedAt: true,
        tokenExpiresAt: true,
      },
    });

    const stats = conn
      ? await this.prisma.googleReview.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: true,
        })
      : null;

    const counts = { pending: 0, suggested: 0, approved: 0, skipped: 0 };
    if (stats) {
      for (const row of stats) {
        counts[row.status.toLowerCase() as keyof typeof counts] = row._count;
      }
    }

    return {
      connected: !!conn,
      connection: conn
        ? {
            googleAccountId: conn.googleAccountId,
            locationId: conn.locationId,
            locationName: conn.locationName,
            connectedAt: conn.connectedAt,
          }
        : null,
      reviewCounts: counts,
    };
  }

  async disconnect(tenantId: string, userId: string) {
    const conn = await this.prisma.googleBusinessConnection.findUnique({
      where: { tenantId },
    });
    if (!conn) return { disconnected: false, message: 'No connection found' };

    await this.prisma.googleBusinessConnection.delete({ where: { tenantId } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entity: 'GoogleBusinessConnection',
      entityId: conn.id,
    });

    return { disconnected: true };
  }

  // ── Sync Reviews ───────────────────────────

  /**
   * Fetch new reviews from Google, skip ones already in DB.
   * Auto-generates AI suggestions for reviews with comments.
   */
  async syncReviews(
    tenantId: string,
    userId: string,
  ): Promise<{ synced: number; alreadyKnown: number }> {
    await this.enforceTier3(tenantId);

    const conn = await this.prisma.googleBusinessConnection.findUnique({
      where: { tenantId },
    });
    if (!conn)
      throw new NotFoundException(
        'No Google Business connection found. Connect your account first.',
      );
    if (!conn.locationId)
      throw new BadRequestException(
        'No location selected. Please select a location first.',
      );

    const accessToken = await this.getFreshToken(conn.id);

    let synced = 0;
    let alreadyKnown = 0;
    let pageToken: string | undefined;

    do {
      const { reviews, nextPageToken } = await this.googleProvider.listReviews(
        accessToken,
        conn.googleAccountId,
        conn.locationId,
        pageToken,
      );

      for (const review of reviews) {
        const existing = await this.prisma.googleReview.findUnique({
          where: { googleReviewId: review.reviewId },
        });

        if (existing) {
          alreadyKnown++;
          continue;
        }

        // Skip reviews that already have a reply on Google
        const initialStatus = review.reviewReply ? 'APPROVED' : 'PENDING';

        await this.prisma.googleReview.create({
          data: {
            tenantId,
            connectionId: conn.id,
            googleReviewId: review.reviewId,
            reviewerName: review.reviewerName,
            reviewerPhotoUrl: review.reviewerPhotoUrl,
            rating: review.starRating,
            comment: review.comment,
            reviewedAt: new Date(review.createTime),
            draftReply: review.reviewReply?.comment || null,
            status: initialStatus as any,
            repliedAt: review.reviewReply ? new Date() : null,
          },
        });

        synced++;
      }

      pageToken = nextPageToken;
    } while (pageToken);

    // Auto-generate AI suggestions for new PENDING reviews that have comments
    const pendingWithComments = await this.prisma.googleReview.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        comment: { not: null },
        aiSuggestion: null,
      },
    });

    for (const review of pendingWithComments) {
      await this.generateSuggestion(
        tenantId,
        userId,
        review.id,
        'professional',
      ).catch((err) => {
        this.logger.warn(
          `Auto-generate failed for review ${review.id}: ${err.message}`,
        );
      });
    }

    this.logger.log(
      `Sync complete for tenant ${tenantId}: ${synced} new, ${alreadyKnown} known`,
    );
    return { synced, alreadyKnown };
  }

  // ── List Reviews ───────────────────────────

  async listReviews(
    tenantId: string,
    params: { status?: string; page?: number; limit?: number },
  ) {
    await this.enforceTier3(tenantId);

    const { status, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (status) where.status = status.toUpperCase();

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.googleReview.findMany({
        where,
        orderBy: { reviewedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          googleReviewId: true,
          reviewerName: true,
          reviewerPhotoUrl: true,
          rating: true,
          comment: true,
          reviewedAt: true,
          aiSuggestion: true,
          draftReply: true,
          status: true,
          repliedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.googleReview.count({ where }),
    ]);

    return {
      data: reviews,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getReview(tenantId: string, reviewId: string) {
    await this.enforceTier3(tenantId);

    const review = await this.prisma.googleReview.findFirst({
      where: { id: reviewId, tenantId },
    });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  // ── AI Generation ──────────────────────────

  async generateSuggestion(
    tenantId: string,
    userId: string,
    reviewId: string,
    tone?: string,
  ) {
    const tenant = await this.enforceTier3(tenantId);

    // Check AI usage limits
    const isInTrial = tenant.trialActive;
    if (isInTrial && tenant.aiUsageCount >= tenant.aiTrialLimit) {
      throw new ForbiddenException(
        `AI trial limit reached (${tenant.aiTrialLimit}). Please upgrade.`,
      );
    }
    if (!isInTrial && tenant.aiUsageCount >= tenant.aiMonthlyLimit) {
      throw new ForbiddenException(
        `Monthly AI limit reached (${tenant.aiMonthlyLimit}). Resets next billing cycle.`,
      );
    }

    const review = await this.prisma.googleReview.findFirst({
      where: { id: reviewId, tenantId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status === 'APPROVED') {
      throw new BadRequestException(
        'Cannot regenerate a reply for an already-approved review',
      );
    }

    const ratingLabel = [
      '',
      'very negative',
      'negative',
      'neutral',
      'positive',
      'very positive',
    ][review.rating];
    const requestedTone = tone || 'professional and warm';

    const systemPrompt = `You are an expert business reputation manager. You write concise, genuine Google review replies that:
- Thank the reviewer by name
- Address the specific feedback
- Are ${requestedTone} in tone
- Are 2-4 sentences maximum
- Never sound templated or robotic
- Do NOT use phrases like "We appreciate your feedback" or "Thank you for your review" as openers — be more creative
You return ONLY the reply text. No formatting, no quotes, no preamble.`;

    const userPrompt = `Write a reply to this Google Business review:
Reviewer: ${review.reviewerName}
Rating: ${review.rating}/5 stars (${ratingLabel})
Review: "${review.comment || '(No comment — just a star rating)'}"
Tone: ${requestedTone}
Return ONLY the reply text.`;

    const result = await this.openAIProvider.complete({
      systemPrompt,
      userPrompt,
      maxTokens: 200,
      temperature: 0.75,
    });

    if (!result.success)
      throw new BadRequestException(`AI generation failed: ${result.error}`);

    // Log AI usage
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { aiUsageCount: { increment: 1 } },
    });
    await this.prisma.aIUsageLog.create({
      data: {
        tenantId,
        feature: 'review_reply_generation',
        tokensUsed: result.tokensUsed || 0,
        model: result.model || 'unknown',
        inputText: userPrompt,
        outputText: result.text!,
        costUsd: this.estimateCost(result.tokensUsed || 0, result.model || ''),
      },
    });

    // Update review with suggestion
    const updated = await this.prisma.googleReview.update({
      where: { id: reviewId },
      data: {
        aiSuggestion: result.text,
        draftReply: result.text, // prime the draft with the suggestion
        status: 'SUGGESTED',
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'GoogleReviewSuggestion',
      entityId: reviewId,
      newValues: { tokens: result.tokensUsed, tone },
    });

    return {
      suggestion: result.text,
      tokensUsed: result.tokensUsed,
      review: updated,
    };
  }

  private estimateCost(tokens: number, model: string): number {
    const rates: Record<string, number> = {
      'gpt-4o-mini': 0.00015,
      'gpt-4o': 0.005,
      'gpt-4': 0.03,
    };
    return ((rates[model] || 0.001) * tokens) / 1000;
  }

  // ── Draft Management ───────────────────────

  async updateDraft(tenantId: string, reviewId: string, draftReply: string) {
    await this.enforceTier3(tenantId);

    const review = await this.prisma.googleReview.findFirst({
      where: { id: reviewId, tenantId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status === 'APPROVED') {
      throw new BadRequestException(
        'Cannot edit a reply that has already been posted',
      );
    }

    const updated = await this.prisma.googleReview.update({
      where: { id: reviewId },
      data: {
        draftReply,
        status: review.aiSuggestion ? 'SUGGESTED' : 'PENDING',
      },
    });

    return updated;
  }

  // ── Approve & Post ─────────────────────────

  async approveAndPost(tenantId: string, userId: string, reviewId: string) {
    await this.enforceTier3(tenantId);

    const review = await this.prisma.googleReview.findFirst({
      where: { id: reviewId, tenantId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status === 'APPROVED') {
      throw new BadRequestException('This review has already been replied to');
    }
    if (!review.draftReply?.trim()) {
      throw new BadRequestException(
        'No reply draft found. Generate or write a reply first.',
      );
    }

    const conn = await this.prisma.googleBusinessConnection.findUnique({
      where: { tenantId },
    });
    if (!conn)
      throw new NotFoundException('Google Business connection not found');

    const accessToken = await this.getFreshToken(conn.id);

    const posted = await this.googleProvider.replyToReview(
      accessToken,
      conn.googleAccountId,
      conn.locationId,
      review.googleReviewId,
      review.draftReply,
    );

    if (!posted) {
      throw new BadRequestException(
        'Failed to post reply to Google. Please try again.',
      );
    }

    const updated = await this.prisma.googleReview.update({
      where: { id: reviewId },
      data: {
        status: 'APPROVED',
        repliedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entity: 'GoogleReview',
      entityId: reviewId,
      newValues: { status: 'APPROVED', repliedAt: updated.repliedAt },
    });

    this.logger.log(
      `Review ${reviewId} reply posted to Google by user ${userId}`,
    );
    return updated;
  }

  // ── Skip ──────────────────────────────────

  async skipReview(tenantId: string, userId: string, reviewId: string) {
    await this.enforceTier3(tenantId);

    const review = await this.prisma.googleReview.findFirst({
      where: { id: reviewId, tenantId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status === 'APPROVED') {
      throw new BadRequestException(
        'Cannot skip a review that has already been replied to',
      );
    }

    const updated = await this.prisma.googleReview.update({
      where: { id: reviewId },
      data: { status: 'SKIPPED' },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entity: 'GoogleReview',
      entityId: reviewId,
      newValues: { status: 'SKIPPED' },
    });

    return updated;
  }
}
