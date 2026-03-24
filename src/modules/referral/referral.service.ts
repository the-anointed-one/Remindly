import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplyReferralCodeDto } from './dto/referral.dto';

const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous chars (no O/0/I/1)
const REFERRAL_REWARD_SMS = 50; // SMS credits per successful referral

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────
  // Get or generate a referral code for the user
  // ────────────────────────────────────────────

  async getOrCreateCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.referralCode) return user.referralCode;

    // Generate unique 8-char code; retry on collision (extremely rare)
    let code: string;
    let attempts = 0;
    do {
      code = this.generateCode();
      attempts++;
      if (attempts > 10)
        throw new Error('Failed to generate unique referral code');
    } while (
      await this.prisma.user.findUnique({ where: { referralCode: code } })
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });

    return code;
  }

  // ────────────────────────────────────────────
  // Stats for the current user
  // ────────────────────────────────────────────

  async getStats(userId: string, tenantId: string) {
    const code = await this.getOrCreateCode(userId);

    const referrals = await this.prisma.referral.findMany({
      where: { referrerUserId: userId },
      include: {
        referred: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            tenant: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rewardsIssued = referrals.filter((r) => r.rewardIssued).length;
    const totalCreditsEarned = referrals
      .filter((r) => r.rewardIssued)
      .reduce((sum, r) => sum + r.rewardValue, 0);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return {
      code,
      referralLink: `${frontendUrl}/register?ref=${code}`,
      totalReferrals: referrals.length,
      rewardsIssued,
      totalCreditsEarned,
      rewardPerReferral: REFERRAL_REWARD_SMS,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredAt: r.createdAt,
        rewardIssued: r.rewardIssued,
        rewardIssuedAt: r.rewardIssuedAt,
        rewardValue: r.rewardValue,
        referred: {
          id: r.referred.id,
          name:
            [r.referred.firstName, r.referred.lastName]
              .filter(Boolean)
              .join(' ') || r.referred.email,
          tenantName: r.referred.tenant.name,
          joinedAt: r.referred.createdAt,
        },
      })),
    };
  }

  // ────────────────────────────────────────────
  // Apply someone else's referral code
  // ────────────────────────────────────────────

  async applyCode(referredUserId: string, dto: ApplyReferralCodeDto) {
    const normalizedCode = dto.code.trim().toUpperCase();

    // Check not already referred
    const existingReferral = await this.prisma.referral.findUnique({
      where: { referredUserId },
    });
    if (existingReferral) {
      throw new ConflictException(
        'A referral code has already been applied to your account',
      );
    }

    // Find referrer by code
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: normalizedCode },
    });
    if (!referrer) {
      throw new NotFoundException('Referral code not found');
    }

    // Cannot refer yourself
    if (referrer.id === referredUserId) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    // Create referral record and immediately issue reward (credits to referrer's tenant)
    const referral = await this.prisma.$transaction(async (tx) => {
      const created = await tx.referral.create({
        data: {
          referrerUserId: referrer.id,
          referredUserId,
          rewardType: 'SMS_CREDITS',
          rewardValue: REFERRAL_REWARD_SMS,
          rewardIssued: true,
          rewardIssuedAt: new Date(),
        },
      });

      // Credit SMS to referrer's tenant (add to smsTrialLimit)
      await tx.tenant.update({
        where: { id: referrer.tenantId },
        data: { smsTrialLimit: { increment: REFERRAL_REWARD_SMS } },
      });

      return created;
    });

    this.logger.log(
      `Referral applied: ${referrer.email} referred user ${referredUserId} — +${REFERRAL_REWARD_SMS} SMS credits issued`,
    );

    return {
      applied: true,
      referrerName:
        [referrer.firstName, referrer.lastName].filter(Boolean).join(' ') ||
        referrer.email,
      rewardIssued: true,
      rewardValue: referral.rewardValue,
      rewardType: referral.rewardType,
    };
  }

  // ────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code +=
        REFERRAL_CODE_CHARS[
          Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)
        ];
    }
    return code;
  }
}
