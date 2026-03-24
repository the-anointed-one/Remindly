import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email?: string }[];
}

@Injectable()
export class GoogleCalendarProvider {
  private readonly logger = new Logger(GoogleCalendarProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = config.get('GOOGLE_CALENDAR_CLIENT_ID', '');
    this.clientSecret = config.get('GOOGLE_CALENDAR_CLIENT_SECRET', '');
    this.redirectUri = config.get('GOOGLE_CALENDAR_REDIRECT_URI', '');
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope:
        'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeCode(code: string): Promise<GoogleTokens> {
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const email = await this.getEmail(data.access_token);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      email,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  private async getEmail(accessToken: string): Promise<string> {
    const { data } = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return data.email || '';
  }

  async listEvents(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
    pageToken?: string,
  ): Promise<{ events: GoogleCalendarEvent[]; nextPageToken?: string }> {
    const params: Record<string, string> = {
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await axios.get(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      },
    );

    return {
      events: (data.items || []) as GoogleCalendarEvent[],
      nextPageToken: data.nextPageToken,
    };
  }
}
