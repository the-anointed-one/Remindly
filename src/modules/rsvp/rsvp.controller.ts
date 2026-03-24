import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { EventService } from '../event/event.service';
import { RecordResponseDto } from '../event/dto/event.dto';
import { CurrentUser } from '../../common/decorators';

@Controller('rsvp')
export class RsvpController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  async recordRsvp(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: RecordResponseDto & { eventId: string },
  ) {
    if (!body.contactId || !body.response || !body.response.trim()) {
      throw new BadRequestException('contactId and response are required');
    }

    if (!body.eventId) {
      throw new BadRequestException('eventId is required');
    }

    return this.eventService.respond(
      body.eventId,
      tenantId,
      body.contactId,
      body.response,
    );
  }
}
