import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    // ────────────────────────────────────────────
    // Register
    // ────────────────────────────────────────────

    async register(dto: RegisterDto) {
        // Check if email already exists
        const existingUser = await this.prisma.user.findFirst({
            where: { email: dto.email },
        });

        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);

        // Create tenant + owner in a transaction
        const slug = dto.tenantName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        const result = await this.prisma.$transaction(async (tx) => {
            const trialDays = this.configService.get<number>('TRIAL_DURATION_DAYS', 14);
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + trialDays);

            const tenant = await tx.tenant.create({
                data: {
                    name: dto.tenantName,
                    slug: `${slug}-${Date.now()}`,
                    planType: 'SMS',
                    subscriptionStatus: 'TRIALING',
                    trialStartDate: now,
                    trialEndDate: trialEnd,
                    trialActive: true,
                    smsTrialLimit: this.configService.get<number>('TRIAL_SMS_LIMIT', 100),
                    aiTrialLimit: this.configService.get<number>('TRIAL_AI_LIMIT', 5),
                    aiMonthlyLimit: this.configService.get<number>('AI_MONTHLY_LIMIT', 50),
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
        const user = await this.prisma.user.findFirst({
            where: { email: dto.email },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!passwordValid) {
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
                expiresIn: this.configService.get('JWT_EXPIRATION', '15m') as any,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d') as any,
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
