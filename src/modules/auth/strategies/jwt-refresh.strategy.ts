import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    const options: StrategyOptionsWithRequest = {
      // Read refresh token from HttpOnly cookie (primary) or request body (fallback)
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['refreshToken'] ?? null,
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    };
    super(options);
  }

  async validate(req: Request, payload: any) {
    // Prefer cookie; fall back to body (for API clients that POST the token)
    const refreshToken =
      req.cookies?.['refreshToken'] ?? req.body?.refreshToken;
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      refreshToken,
    };
  }
}
