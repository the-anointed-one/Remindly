import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { emailAddress?: { address?: string } }[];
}

@Injectable()
export class OutlookCalendarProvider {
  private readonly logger = new Logger(OutlookCalendarProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly tenantId: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = config.get('OUTLOOK_CLIENT_ID', '');
    this.clientSecret = config.get('OUTLOOK_CLIENT_SECRET', '');
    this.redirectUri = config.get('OUTLOOK_REDIRECT_URI', '');
    this.tenantId = config.get('OUTLOOK_TENANT_ID', 'common');
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope:
        'https://graph.microsoft.com/Calendars.Read offline_access User.Read',
      state,
    });
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<OutlookTokens> {
    const params = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
      scope:
        'https://graph.microsoft.com/Calendars.Read offline_access User.Read',
    });

    const { data } = await axios.post(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

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
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Calendars.Read offline_access',
    });

    const { data } = await axios.post(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  private async getEmail(accessToken: string): Promise<string> {
    const { data } = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.mail || data.userPrincipalName || '';
  }

  async listEvents(
    accessToken: string,
    startDateTime: Date,
    endDateTime: Date,
    skipToken?: string,
  ): Promise<{ events: OutlookCalendarEvent[]; nextSkipToken?: string }> {
    const params: Record<string, string> = {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      $top: '100',
      $select: 'id,subject,start,end,attendees',
      $orderby: 'start/dateTime asc',
    };
    if (skipToken) params.$skiptoken = skipToken;

    const url = 'https://graph.microsoft.com/v1.0/me/calendarView';
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
    });

    const nextLink: string | undefined = data['@odata.nextLink'];
    let nextSkipToken: string | undefined;
    if (nextLink) {
      const match = nextLink.match(/\$skiptoken=([^&]+)/);
      if (match) nextSkipToken = decodeURIComponent(match[1]);
    }

    return {
      events: (data.value || []) as OutlookCalendarEvent[],
      nextSkipToken,
    };
  }
}
