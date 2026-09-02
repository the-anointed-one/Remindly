import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailProvider } from '../email/email.provider';
import { AuditService } from '../audit/audit.service';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailProvider: EmailProvider,
    private readonly auditService: AuditService,
  ) {}

  // ────────────────────────────────────────────
  // Register
  // ────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const slug = dto.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Create tenant with NO active trial — trial activates only after Paystack webhook
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          slug: `${slug}-${Date.now()}`,
          planType: 'SMS',
          subscriptionStatus: 'TRIALING',
          trialActive: false, // ← false until card authorized
          smsTrialLimit: this.configService.get<number>('TRIAL_SMS_LIMIT', 100),
          aiTrialLimit: this.configService.get<number>('TRIAL_AI_LIMIT', 5),
          aiMonthlyLimit: this.configService.get<number>(
            'AI_MONTHLY_LIMIT',
            50,
          ),
          // Seed the business timezone from the frontend's auto-detected zone,
          // defaulting to UTC. Stored in the settings JSON blob (same place as
          // sender identity) — no dedicated column.
          settings: {
            timezone:
              typeof dto.timezone === 'string' && dto.timezone.trim()
                ? dto.timezone.trim()
                : 'UTC',
          },
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'OWNER',
        },
      });

      return { tenant, user };
    });

    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.user.role,
      result.tenant.id,
    );

    await this.updateRefreshToken(result.user.id, tokens.refreshToken);

    // Send welcome email (non-blocking)
    this.emailProvider
      .sendWelcome(result.user.email, result.user.firstName || 'there')
      .catch(() => {});

    this.logger.log(
      `New tenant "${result.tenant.name}" registered by ${result.user.email}`,
    );

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        tenantId: result.tenant.id,
      },
      ...tokens,
    };
  }

  // ────────────────────────────────────────────
  // Login
  // ────────────────────────────────────────────

  async login(dto: LoginDto) {
    this.logger.debug(`Login attempt for email: [${dto.email}]`);
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (!user) {
      this.logger.warn(`Login failed: User [${dto.email}] not found`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      this.logger.warn(
        `Login failed: User [${dto.email}] has no password hash (likely OAuth only)`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn(`Login failed: Incorrect password for [${dto.email}]`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.tenantId,
    );

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User ${user.email} logged in`);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      ...tokens,
    };
  }

  // ────────────────────────────────────────────
  // Refresh Tokens
  // ────────────────────────────────────────────

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatches) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.tenantId,
    );

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // ────────────────────────────────────────────
  // Logout
  // ────────────────────────────────────────────

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    this.logger.log(`User ${userId} logged out`);
  }

  // ────────────────────────────────────────────
  // Forgot Password
  // ────────────────────────────────────────────

  async forgotPassword(email: string) {
    // Always return success — never reveal whether email exists (enumeration prevention)
    const user = await this.prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      this.logger.debug(
        `Forgot password requested for unknown email: ${email}`,
      );
      return {
        message: 'If that email is registered, a reset link has been sent.',
      };
    }

    // Generate secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.emailProvider.sendPasswordReset(user.email, resetUrl);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'CREATE',
      entity: 'PasswordReset',
      entityId: user.id,
      newValues: { requested: true, expiresAt },
    });

    this.logger.log(`Password reset email sent to ${email}`);

    return {
      message: 'If that email is registered, a reset link has been sent.',
    };
  }

  // ────────────────────────────────────────────
  // Reset Password
  // ────────────────────────────────────────────

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Reset link is invalid or has expired. Please request a new one.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshToken: null, // invalidate all active sessions
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'PasswordReset',
      entityId: user.id,
      newValues: { completed: true, sessionsInvalidated: true },
    });

    this.logger.log(`Password reset completed for user ${user.id}`);

    return {
      message:
        'Password updated successfully. Please log in with your new password.',
    };
  }

  // ────────────────────────────────────────────
  // OAuth Login (Google)
  // ────────────────────────────────────────────

  async validateOAuthLogin(
    email: string,
    providerId: string,
    provider: string,
    firstName: string,
    lastName: string,
  ) {
    let user = await this.prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      // Auto-provision new tenant and user — NO trial until card authorized
      const slugStart = firstName
        ? firstName.toLowerCase().replace(/[^a-z0-9]/g, '')
        : 'tenant';

      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: `${firstName}'s Workspace`,
            slug: `${slugStart}-${Date.now()}`,
            planType: 'SMS',
            subscriptionStatus: 'TRIALING',
            trialActive: false, // ← false until card authorized
            smsTrialLimit: this.configService.get<number>(
              'TRIAL_SMS_LIMIT',
              100,
            ),
            aiTrialLimit: this.configService.get<number>('TRIAL_AI_LIMIT', 5),
            aiMonthlyLimit: this.configService.get<number>(
              'AI_MONTHLY_LIMIT',
              50,
            ),
          },
        });

        const newUser = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email,
            firstName,
            lastName,
            role: 'OWNER',
            passwordHash: null as any,
          },
        });

        return { tenant, user: newUser };
      });

      user = result.user as any;
      this.logger.log(`Provisioned new OAuth user/tenant for ${email}`);
    } else {
      this.logger.log(`Existing user ${email} logged in via OAuth`);
    }

    if (!user) {
      throw new Error('Failed to find or create user during OAuth login');
    }

    const u = user as any;
    const tokens = await this.generateTokens(u.id, u.email, u.role, u.tenantId);
    await this.updateRefreshToken(u.id, tokens.refreshToken);

    return {
      user: { id: u.id, email: u.email, role: u.role, tenantId: u.tenantId },
      ...tokens,
    };
  }

  // ────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    tenantId: string,
  ) {
    const payload = { sub: userId, email, role, tenantId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: (process.env.JWT_ACCESS_EXPIRY as any) ?? '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (process.env.JWT_REFRESH_EXPIRY as any) ?? '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hash },
    });
  }
}
