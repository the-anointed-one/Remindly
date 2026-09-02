import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailProvider } from '../email/email.provider';
import { UpdateUserDto } from './dto/update-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

const MEMBER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  createdAt: true,
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailProvider: EmailProvider,
  ) {}

  // ── Self ───────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...MEMBER_SELECT,
        tenantId: true,
        tenant: { select: { settings: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    // Surface the business timezone (settings.timezone, default UTC) so the
    // client can default the DateTimePicker to it instead of the browser zone.
    const settings = (user.tenant?.settings as Record<string, unknown>) ?? {};
    const tz = settings.timezone;
    const { tenant: _tenant, ...rest } = user;
    return {
      ...rest,
      tenantTimezone: typeof tz === 'string' && tz.trim() ? tz : 'UTC',
    };
  }

  async updateMe(userId: string, data: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { firstName: data.firstName, lastName: data.lastName },
      select: { ...MEMBER_SELECT, tenantId: true },
    });
  }

  // ── Team management ────────────────────────

  async listMembers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: MEMBER_SELECT,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async inviteMember(
    tenantId: string,
    inviterId: string,
    inviterRole: string,
    dto: InviteUserDto,
  ) {
    if (inviterRole === 'ADMIN' && dto.role === 'ADMIN') {
      throw new ForbiddenException('Admins can only invite Staff members');
    }

    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('A team member with that email already exists');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const tempHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    const member = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        passwordHash: tempHash,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
      select: MEMBER_SELECT,
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const setPasswordUrl = `${frontendUrl}/reset-password?token=${rawToken}&invite=1`;

    this.sendInviteEmail(dto.email, dto.firstName, setPasswordUrl).catch(() => {});

    this.logger.log(`Member invited: ${dto.email} as ${dto.role} by user ${inviterId}`);
    return member;
  }

  async updateMemberRole(
    tenantId: string,
    updaterRole: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const member = await this.prisma.user.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.role === 'OWNER') throw new ForbiddenException('Cannot change the role of the account owner');
    if (updaterRole === 'ADMIN' && dto.role === 'ADMIN') throw new ForbiddenException('Admins cannot promote others to Admin');

    return this.prisma.user.update({
      where: { id: memberId },
      data: { role: dto.role },
      select: MEMBER_SELECT,
    });
  }

  async removeMember(
    tenantId: string,
    removerId: string,
    removerRole: string,
    memberId: string,
  ) {
    if (removerId === memberId) throw new ForbiddenException('You cannot remove yourself');

    const member = await this.prisma.user.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.role === 'OWNER') throw new ForbiddenException('Cannot remove the account owner');
    if (removerRole === 'ADMIN' && member.role !== 'STAFF') throw new ForbiddenException('Admins can only remove Staff members');

    await this.prisma.user.delete({ where: { id: memberId } });
    this.logger.log(`Member ${memberId} removed by ${removerId}`);
    return { success: true };
  }

  private async sendInviteEmail(to: string, firstName: string | undefined, setPasswordUrl: string) {
    const name = firstName || 'there';
    await this.emailProvider.send({
      to,
      subject: "You've been invited to Meetora",
      text: `Hi ${name},\n\nYou've been invited to join a team on Meetora.\n\nSet your password here: ${setPasswordUrl}\n\nThis link expires in 7 days.`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, sans-serif; background: #0a0a0b; color: #f8fafc; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #111113; border: 1px solid #1e1e24; border-radius: 12px; padding: 40px;">
    <div style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">⚡ Meetora</div>
    <h1 style="font-size: 22px; font-weight: 700; margin: 24px 0 8px;">You've been invited</h1>
    <p style="color: #94a3b8; margin-bottom: 32px;">Hi ${name}, you've been added to a team on Meetora. Click below to set your password and get started.</p>
    <a href="${setPasswordUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Accept Invitation →</a>
    <p style="margin-top: 32px; font-size: 13px; color: #64748b;">This link expires in 7 days. If you did not expect this, you can ignore it.</p>
  </div>
</body>
</html>`,
    });
  }
}
