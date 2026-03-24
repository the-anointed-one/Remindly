import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface GoogleLocation {
  name: string; // full resource name e.g. "accounts/123/locations/456"
  locationId: string; // just the ID part
  locationName: string;
}

export interface GoogleReviewData {
  reviewId: string;
  reviewerName: string;
  reviewerPhotoUrl?: string;
  starRating: number; // 1-5
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const REVIEWS_BASE = 'https://mybusiness.googleapis.com/v4';
const ACCOUNTS_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';

const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

@Injectable()
export class GoogleBusinessProvider {
  private readonly logger = new Logger(GoogleBusinessProvider.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>(
      'GOOGLE_REVIEWS_CLIENT_ID',
      '',
    );
    this.clientSecret = this.configService.get<string>(
      'GOOGLE_REVIEWS_CLIENT_SECRET',
      '',
    );
    this.redirectUri = this.configService.get<string>(
      'GOOGLE_REVIEWS_REDIRECT_URI',
      'http://localhost:3001/api/google-reviews/oauth/callback',
    );

    if (!this.clientId) {
      this.logger.warn(
        'GOOGLE_REVIEWS_CLIENT_ID not configured — Google Reviews will be unavailable.',
      );
    }
  }

  // ── OAuth ──────────────────────────────────

  /**
   * Build the OAuth consent URL to redirect the user to.
   * `state` is a CSRF token encoded with tenantId.
   */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/business.manage',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access + refresh tokens.
   */
  async exchangeCode(code: string): Promise<GoogleTokens | null> {
    try {
      const response = await axios.post(
        TOKEN_URL,
        new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const data = response.data;
      const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
      };
    } catch (error: any) {
      this.logger.error(
        `Token exchange failed: ${error.response?.data?.error_description || error.message}`,
      );
      return null;
    }
  }

  /**
   * Refresh an expired access token using the stored refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleTokens | null> {
    try {
      const response = await axios.post(
        TOKEN_URL,
        new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const data = response.data;
      const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Google may not return a new refresh token
        expiresAt,
      };
    } catch (error: any) {
      this.logger.error(
        `Token refresh failed: ${error.response?.data?.error_description || error.message}`,
      );
      return null;
    }
  }

  // ── Account / Locations ────────────────────

  /**
   * Fetch the first Google Business account linked to these tokens.
   */
  async getAccount(
    accessToken: string,
  ): Promise<{ accountId: string; accountName: string } | null> {
    try {
      const response = await axios.get(`${ACCOUNTS_BASE}/accounts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const accounts = response.data.accounts || [];
      if (!accounts.length) return null;

      const account = accounts[0];
      const accountId = account.name.split('/').pop(); // "accounts/123" → "123"
      return { accountId, accountName: account.accountName };
    } catch (error: any) {
      this.logger.error(
        `getAccount failed: ${error.response?.data?.error?.message || error.message}`,
      );
      return null;
    }
  }

  /**
   * List all locations for an account.
   */
  async listLocations(
    accessToken: string,
    accountId: string,
  ): Promise<GoogleLocation[]> {
    try {
      const response = await axios.get(
        `${ACCOUNTS_BASE}/accounts/${accountId}/locations`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const locations = response.data.locations || [];
      return locations.map((loc: any) => ({
        name: loc.name,
        locationId: loc.name.split('/').pop(),
        locationName: loc.title || loc.locationName || 'Unknown Location',
      }));
    } catch (error: any) {
      this.logger.error(
        `listLocations failed: ${error.response?.data?.error?.message || error.message}`,
      );
      return [];
    }
  }

  // ── Reviews ────────────────────────────────

  /**
   * Fetch reviews for a location, newest first.
   * pageToken allows pagination.
   */
  async listReviews(
    accessToken: string,
    accountId: string,
    locationId: string,
    pageToken?: string,
  ): Promise<{ reviews: GoogleReviewData[]; nextPageToken?: string }> {
    try {
      const params: Record<string, string> = { pageSize: '50' };
      if (pageToken) params.pageToken = pageToken;

      const response = await axios.get(
        `${REVIEWS_BASE}/accounts/${accountId}/locations/${locationId}/reviews`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params,
        },
      );

      const raw = response.data.reviews || [];
      const reviews: GoogleReviewData[] = raw.map((r: any) => ({
        reviewId: r.reviewId,
        reviewerName: r.reviewer?.displayName || 'Anonymous',
        reviewerPhotoUrl: r.reviewer?.profilePhotoUrl,
        starRating: STAR_RATING_MAP[r.starRating] || 3,
        comment: r.comment || undefined,
        createTime: r.createTime,
        updateTime: r.updateTime,
        reviewReply: r.reviewReply
          ? {
              comment: r.reviewReply.comment,
              updateTime: r.reviewReply.updateTime,
            }
          : undefined,
      }));

      return { reviews, nextPageToken: response.data.nextPageToken };
    } catch (error: any) {
      this.logger.error(
        `listReviews failed: ${error.response?.data?.error?.message || error.message}`,
      );
      return { reviews: [] };
    }
  }

  /**
   * Post a reply to a Google review.
   */
  async replyToReview(
    accessToken: string,
    accountId: string,
    locationId: string,
    reviewId: string,
    replyText: string,
  ): Promise<boolean> {
    try {
      await axios.put(
        `${REVIEWS_BASE}/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
        { comment: replyText },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `replyToReview failed: ${error.response?.data?.error?.message || error.message}`,
      );
      return false;
    }
  }
}
