import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/reactivation.dto';
import { ChannelType } from '@prisma/client';

@Injectable()
export class ReactivationService {
  private readonly logger = new Logger(ReactivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
  ) {}

  async create(tenantId: string, dto: CreateCampaignDto) {
    return this.prisma.reactivationCampaign.create({
      data: {
        tenantId,
        name: dto.name,
        inactivityDays: dto.inactivityDays ?? 60,
        discountOffer: dto.discountOffer,
        messageTemplate: dto.messageTemplate,
        channel: dto.channel ?? ChannelType.SMS,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.reactivationCampaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { contacts: true } } },
    });
  }

  async findOne(tenantId: string, id: string) {
    const campaign = await this.prisma.reactivationCampaign.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { contacts: true } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(tenantId: string, id: string, dto: UpdateCampaignDto) {
    await this.findOne(tenantId, id);
    return this.prisma.reactivationCampaign.update({
      where: { id },
      data: {
        name: dto.name,
        inactivityDays: dto.inactivityDays,
        discountOffer: dto.discountOffer,
        messageTemplate: dto.messageTemplate,
        channel: dto.channel,
        status: dto.status as any,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.reactivationCampaign.delete({ where: { id } });
    return { deleted: true };
  }

  async runCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<{ contacted: number; skipped: number }> {
    const campaign = await this.findOne(tenantId, campaignId);
    if (campaign.status !== 'ACTIVE') {
      return { contacted: 0, skipped: 0 };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - campaign.inactivityDays);

    const inactiveCustomers = await this.findInactiveCustomers(
      tenantId,
      cutoffDate,
    );

    const alreadyContacted = await this.prisma.reactivationContact.findMany({
      where: { campaignId },
      select: { customerId: true },
    });
    const alreadyContactedIds = new Set(
      alreadyContacted.map((c) => c.customerId),
    );

    let contacted = 0;
    let skipped = 0;

    for (const customer of inactiveCustomers) {
      if (alreadyContactedIds.has(customer.id) || !customer.phone) {
        skipped++;
        continue;
      }

      const message = this.buildMessage(
        campaign.messageTemplate,
        customer.firstName,
        campaign.discountOffer,
      );

      try {
        await this.messagingService.send(
          tenantId,
          campaign.channel,
          customer.phone,
          message,
        );

        await this.prisma.reactivationContact.create({
          data: {
            tenantId,
            campaignId,
            customerId: customer.id,
            phone: customer.phone,
          },
        });

        contacted++;
      } catch (err) {
        this.logger.error(
          `Failed to contact customer ${customer.id}: ${err.message}`,
        );
        skipped++;
      }
    }

    await this.prisma.reactivationCampaign.update({
      where: { id: campaignId },
      data: {
        lastRunAt: new Date(),
        totalContacted: { increment: contacted },
      },
    });

    this.logger.log(
      `Campaign ${campaignId} run: ${contacted} contacted, ${skipped} skipped`,
    );
    return { contacted, skipped };
  }

  async getInactiveCount(
    tenantId: string,
    inactivityDays: number,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactivityDays);
    const customers = await this.findInactiveCustomers(tenantId, cutoffDate);
    return customers.length;
  }

  private async findInactiveCustomers(tenantId: string, cutoffDate: Date) {
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        unsubscribed: false,
        phone: { not: null },
        OR: [
          {
            appointments: {
              none: {
                scheduledAt: { gte: cutoffDate },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
    });
  }

  private buildMessage(
    template: string,
    firstName: string,
    discount?: string | null,
  ): string {
    let msg = template.replace(/\{\{name\}\}/gi, firstName);
    if (discount) {
      msg = msg.replace(/\{\{discount\}\}/gi, discount);
    }
    return msg;
  }
}
