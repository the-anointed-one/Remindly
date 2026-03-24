import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChannelStrategyDto, UpdateChannelStrategyDto } from './dto';

export interface ResolvedStrategy {
  id: string;
  chain: ChannelType[];
  fallbackOnFailed: boolean;
  fallbackOnUndelivered: boolean;
  fallbackOnUnread: boolean;
  unreadWindowMinutes: number;
}

@Injectable()
export class ChannelStrategyService {
  private readonly logger = new Logger(ChannelStrategyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateChannelStrategyDto) {
    if (dto.isDefault) {
      await this.prisma.channelStrategy.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.channelStrategy.create({
      data: {
        tenantId,
        name: dto.name,
        chain: dto.chain,
        fallbackOnFailed: dto.fallbackOnFailed ?? true,
        fallbackOnUndelivered: dto.fallbackOnUndelivered ?? true,
        fallbackOnUnread: dto.fallbackOnUnread ?? false,
        unreadWindowMinutes:
          dto.unreadWindowMinutes ??
          parseInt(process.env.UNREAD_WINDOW_MINUTES ?? '30', 10),
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.channelStrategy.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const strategy = await this.prisma.channelStrategy.findFirst({
      where: { id, tenantId },
    });
    if (!strategy) throw new NotFoundException('Channel strategy not found');
    return strategy;
  }

  async update(tenantId: string, id: string, dto: UpdateChannelStrategyDto) {
    await this.findOne(tenantId, id);

    if (dto.isDefault) {
      await this.prisma.channelStrategy.updateMany({
        where: { tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.channelStrategy.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.channelStrategy.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
