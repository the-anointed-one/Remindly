import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CurrentUser } from '../../common/decorators';

interface CreateMessageDto {
  contactId?: string;
  eventId?: string;
  channel: 'SMS' | 'VOICE' | 'EMAIL' | 'WHATSAPP';
  to: string;
  message: string;
}

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  async sendMessage(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateMessageDto,
  ) {
    if (!dto.channel || !dto.to || !dto.message) {
      throw new BadRequestException('channel, to, and message are required');
    }

    const result = await this.messagingService.send(
      tenantId,
      dto.channel,
      dto.to,
      dto.message,
    );

    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to send message');
    }

    return {
      success: true,
      recipient: dto.to,
      channel: dto.channel,
      eventId: dto.eventId,
      contactId: dto.contactId,
      providerMessageId: result.providerMessageId,
      sentAt: new Date(),
    };
  }
}
