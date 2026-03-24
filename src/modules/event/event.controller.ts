import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { EventService } from './event.service';
import {
  CreateEventDto,
  UpdateEventDto,
  ReplaceParticipantDto,
} from './dto/event.dto';
import { InviteDto, RespondDto, BroadcastDto } from './dto/event-actions.dto';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventService.create(tenantId, userId, dto);
  }

  @Get('active')
  findActive(@CurrentUser('tenantId') tenantId: string) {
    return this.eventService.findActive(tenantId);
  }

  @Get()
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.eventService.findAll(tenantId, page, limit);
  }

  @Get('calendar')
  getCalendarFeed(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = to
      ? new Date(to)
      : new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return this.eventService.getCalendarFeed(tenantId, fromDate, toDate);
  }

  @Get(':id')
  findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventService.findOne(id, tenantId);
  }

  @Get(':id/stats')
  getStats(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventService.getStats(tenantId, id);
  }

  @Get(':id/smart-reminders')
  getSmartReminders(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventService.getSmartReminders(tenantId, id);
  }

  @Put(':id')
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventService.remove(tenantId, id);
  }

  @Post(':id/invite')
  invite(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteDto,
  ) {
    return this.eventService.invite(id, tenantId, dto.contactIds);
  }

  @Post(':id/respond')
  respond(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondDto,
  ) {
    return this.eventService.respond(id, tenantId, dto.contactId, dto.response);
  }

  @Post(':id/broadcast')
  broadcast(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BroadcastDto,
  ) {
    return this.eventService.broadcastAction(id, tenantId, dto);
  }

  @Get(':id/suggest-replacements')
  suggestReplacements(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.eventService.suggestReplacements(tenantId, id, limit);
  }

  @Post(':id/replace')
  replaceParticipant(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceParticipantDto,
  ) {
    return this.eventService.replaceParticipant(
      tenantId,
      id,
      dto.oldParticipantId,
      dto.newContactId,
    );
  }
}
