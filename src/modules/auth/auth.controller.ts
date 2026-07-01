import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { Public, CurrentUser } from '../../common/decorators';

/** 15 minutes in milliseconds */
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
/** 7 days in milliseconds */
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ────────────────────────────────────────────
  // Cookie helpers
  // ────────────────────────────────────────────

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    // `Secure` cookies are silently dropped by browsers on plain HTTP —
    // NODE_ENV=production alone isn't a reliable signal for that, since this
    // same docker-compose config runs both "real prod behind HTTPS" and
    // "local docker testing over http://localhost" with NODE_ENV=production
    // in both cases. COOKIE_SECURE lets an operator override explicitly;
    // it defaults to the NODE_ENV check so real deployments stay secure by
    // default without extra config.
    const nodeEnvIsProd = this.configService.get('NODE_ENV') === 'production';
    const cookieSecureOverride = this.configService.get('COOKIE_SECURE');
    const secureCookies =
      cookieSecureOverride !== undefined
        ? cookieSecureOverride === 'true'
        : nodeEnvIsProd;

    // Access token — short-lived, sent on every API request
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: secureCookies ? 'strict' : 'lax',
      maxAge: ACCESS_TOKEN_TTL_MS,
      path: '/',
    });

    // Refresh token — long-lived, scoped to the refresh endpoint only
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: secureCookies ? 'strict' : 'lax',
      maxAge: REFRESH_TOKEN_TTL_MS,
      path: '/api/auth/refresh',
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  }

  // ────────────────────────────────────────────
  // Register / Login
  // ────────────────────────────────────────────

  /**
   * Throttled to 5 attempts per minute to prevent automated account creation.
   */
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    // Return user info only — tokens live in HttpOnly cookies
    return { user: result.user };
  }

  /**
   * Throttled to 5 attempts per minute to prevent brute-force / credential stuffing.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @CurrentUser('userId') userId: string,
    @CurrentUser('refreshToken') refreshToken: string,
    @Body() _dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refreshTokens(userId, refreshToken);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(userId);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  // ────────────────────────────────────────────
  // Forgot / Reset Password
  // ────────────────────────────────────────────

  /**
   * Always returns 200 to prevent email enumeration.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ────────────────────────────────────────────
  // Google OAuth
  // ────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() _req: Request) {
    // Passport guard redirects to Google — no body needed
  }

  /**
   * Google redirects here after successful auth.
   * We set HttpOnly cookies and redirect to the frontend.
   * Tokens are NEVER exposed in the URL.
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const { accessToken, refreshToken } = req.user;
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3002',
    );

    this.setAuthCookies(res, accessToken, refreshToken);

    // Redirect with a simple success flag — no tokens in URL
    res.redirect(`${frontendUrl}/auth/callback?success=true`);
  }
}
