import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private static readonly logger = new Logger('GoogleStrategy');

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const clientSecret =
      configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    const callbackURL = configService.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3001/api/auth/google/callback',
    );

    if (!configService.get('GOOGLE_CLIENT_ID')) {
      GoogleStrategy.logger.warn(
        'GOOGLE_CLIENT_ID not set — Google OAuth will be disabled.',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails } = profile;
    const email = emails[0].value;
    const firstName = name?.givenName || 'User';
    const lastName = name?.familyName || '';

    try {
      const user = await this.authService.validateOAuthLogin(
        email,
        id,
        'google',
        firstName,
        lastName,
      );
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
}
