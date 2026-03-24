import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { ChannelType, ActivityType } from '@prisma/client';

const FEEDBACK_EXPIRY_HOURS = 24;

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
  ) {}

  async sendFeedbackRequest(
    appointmentId: string,
    tenantId: string,
  ): Promise<void> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { customer: true },
    });

    if (!appointment || !appointment.customer?.phone) {
      this.logger.warn(`No phone for appointment ${appointmentId}`);
      return;
    }

    // Avoid duplicate feedback requests for same appointment
    const existing = await this.prisma.feedbackRequest.findFirst({
      where: { appointmentId, tenantId },
    });
    if (existing) return;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + FEEDBACK_EXPIRY_HOURS);

    await this.prisma.feedbackRequest.create({
      data: {
        tenantId,
        appointmentId,
        customerId: appointment.customerId!,
        phone: appointment.customer.phone,
        channel: ChannelType.SMS,
        expiresAt,
      },
    });

    const customerName = appointment.customer.firstName;
    const message = `Hi ${customerName}! How was your appointment? Reply:\n1 Great\n2 Okay\n3 Not Great\n\nYour feedback helps us improve!`;

    await this.messagingService.send(
      tenantId,
      ChannelType.SMS,
      appointment.customer.phone,
      message,
    );
    this.logger.log(`Feedback request sent for appointment ${appointmentId}`);

    // Log review_requested activity for the contact
    this.prisma.contact
      .findFirst({
        where: { tenantId, phone: appointment.customer.phone },
        select: { id: true },
      })
      .then((contact) => {
        if (contact) {
          return this.prisma.contactActivity.create({
            data: {
              tenantId,
              contactId: contact.id,
              activityType: ActivityType.review_requested,
              referenceId: appointmentId,
              metadata: { phone: appointment.customer!.phone },
            },
          });
        }
      })
      .catch(() => {});
  }

  async hasPendingFeedbackRequest(
    phone: string,
    tenantId: string,
  ): Promise<{ has: boolean; requestId?: string }> {
    const request = await this.prisma.feedbackRequest.findFirst({
      where: {
        phone,
        tenantId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { sentAt: 'desc' },
    });
    return { has: !!request, requestId: request?.id };
  }

  async processFeedbackReply(
    phone: string,
    rating: number,
    tenantId: string,
    requestId: string,
  ): Promise<string> {
    const request = await this.prisma.feedbackRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) return 'Thank you for your feedback!';

    const sentiment =
      rating === 1 ? 'POSITIVE' : rating === 2 ? 'NEUTRAL' : 'NEGATIVE';

    await this.prisma.feedbackResponse.create({
      data: {
        tenantId,
        requestId,
        customerId: request.customerId,
        rating,
        sentiment,
      },
    });

    await this.prisma.feedbackRequest.update({
      where: { id: requestId },
      data: { status: 'RESPONDED' },
    });

    if (rating === 1) {
      // Positive — send review link
      const connection = await this.prisma.googleBusinessConnection.findUnique({
        where: { tenantId },
      });

      let reviewMessage =
        "We're so glad you had a great experience! Thank you for your kind words.";

      if (connection) {
        const reviewLink = `https://search.google.com/local/writereview?placeid=${connection.locationId}`;
        reviewMessage = `We're so glad you had a great experience! Would you mind leaving us a Google review? It means the world to us:\n${reviewLink}`;

        await this.prisma.feedbackResponse.updateMany({
          where: { requestId },
          data: { reviewLinkSent: true },
        });
      }

      this.messagingService
        .send(tenantId, ChannelType.SMS, phone, reviewMessage)
        .catch((err) =>
          this.logger.error(`Review link send failed: ${err.message}`),
        );

      return reviewMessage;
    }

    if (rating === 3) {
      // Negative — private feedback + notify owner
      await this.prisma.feedbackResponse.updateMany({
        where: { requestId },
        data: { privateFormSent: true },
      });

      this.notifyOwnerOfNegativeFeedback(
        tenantId,
        request.appointmentId,
        request.eventId,
        request.customerId,
      ).catch((err) =>
        this.logger.error(`Owner notification failed: ${err.message}`),
      );

      const privateMessage =
        "We're sorry to hear that. We'd love to make it right — a team member will reach out to you shortly. Thank you for letting us know.";

      this.messagingService
        .send(tenantId, ChannelType.SMS, phone, privateMessage)
        .catch((err) =>
          this.logger.error(`Negative feedback SMS failed: ${err.message}`),
        );

      return privateMessage;
    }

    // Neutral
    const neutralMessage =
      "Thank you for your feedback! We're always working to improve your experience.";

    this.messagingService
      .send(tenantId, ChannelType.SMS, phone, neutralMessage)
      .catch((err) =>
        this.logger.error(`Neutral feedback SMS failed: ${err.message}`),
      );

    return neutralMessage;
  }

  private async notifyOwnerOfNegativeFeedback(
    tenantId: string,
    appointmentId: string | null,
    eventId: string | null,
    customerId: string,
  ): Promise<void> {
    const owner = await this.prisma.user.findFirst({
      where: { tenantId, role: 'OWNER' },
    });

    if (!owner?.email) return;

    this.logger.warn(
      `[NEGATIVE FEEDBACK] Tenant ${tenantId} — Appointment/Event ${appointmentId || eventId} — Customer ${customerId} — Owner email: ${owner.email}`,
    );
    // Email notification would be sent here via EmailService
  }

  async getStats(tenantId: string) {
    const [total, positive, neutral, negative, recentResponses] =
      await Promise.all([
        this.prisma.feedbackResponse.count({ where: { tenantId } }),
        this.prisma.feedbackResponse.count({
          where: { tenantId, sentiment: 'POSITIVE' },
        }),
        this.prisma.feedbackResponse.count({
          where: { tenantId, sentiment: 'NEUTRAL' },
        }),
        this.prisma.feedbackResponse.count({
          where: { tenantId, sentiment: 'NEGATIVE' },
        }),
        this.prisma.feedbackResponse.findMany({
          where: { tenantId },
          orderBy: { receivedAt: 'desc' },
          take: 10,
          include: {
            request: { select: { appointmentId: true, phone: true } },
          },
        }),
      ]);

    const avgRating =
      total > 0 ? (positive * 1 + neutral * 2 + negative * 3) / total : 0;
    const satisfactionRate =
      total > 0 ? Math.round((positive / total) * 100) : 0;

    return {
      total,
      positive,
      neutral,
      negative,
      avgRating: Math.round(avgRating * 10) / 10,
      satisfactionRate,
      recentResponses,
    };
  }

  async getResponses(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.feedbackResponse.findMany({
        where: { tenantId },
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
        include: { request: { select: { phone: true, appointmentId: true } } },
      }),
      this.prisma.feedbackResponse.count({ where: { tenantId } }),
    ]);
    return { data, total, page, limit };
  }
}
