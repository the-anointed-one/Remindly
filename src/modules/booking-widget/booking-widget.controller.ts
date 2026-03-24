import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { BookingWidgetService } from './booking-widget.service';
import { SaveWidgetConfigDto, CreateBookingDto } from './dto/widget-config.dto';

// ── Authenticated routes (dashboard) ──────────────────────────────────────────

@Controller('booking-widget')
export class BookingWidgetController {
  constructor(private readonly service: BookingWidgetService) {}

  /** GET /booking-widget/config — current widget config */
  @Get('config')
  getConfig(@CurrentUser('tenantId') tenantId: string) {
    return this.service.getWidgetConfig(tenantId);
  }

  /** PUT /booking-widget/config — create / update widget config */
  @Put('config')
  saveConfig(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: SaveWidgetConfigDto,
  ) {
    return this.service.saveWidgetConfig(tenantId, dto);
  }

  /** GET /booking-widget/embed-code — iframe + script snippet */
  @Get('embed-code')
  getEmbedCode(@CurrentUser('tenantId') tenantId: string) {
    return this.service.generateEmbedCode(tenantId);
  }
}

// ── Public routes (embedded widget) ──────────────────────────────────────────

@Controller('public/booking')
export class PublicBookingController {
  constructor(private readonly service: BookingWidgetService) {}

  /** GET /public/booking/:tenantId — widget config (no auth) */
  @Public()
  @Get(':tenantId')
  getWidgetData(@Param('tenantId') tenantId: string) {
    return this.service.getPublicWidgetData(tenantId);
  }

  /**
   * GET /public/booking/:tenantId/slots?date=YYYY-MM-DD&duration=60
   * Returns available time strings for a given date.
   */
  @Public()
  @Get(':tenantId/slots')
  getSlots(
    @Param('tenantId') tenantId: string,
    @Query('date') date: string,
    @Query('duration', new DefaultValuePipe(60), ParseIntPipe) duration: number,
  ) {
    return this.service.getAvailableSlots(tenantId, date, duration);
  }

  /** POST /public/booking/:tenantId — create appointment from widget */
  @Public()
  @Post(':tenantId')
  @HttpCode(HttpStatus.CREATED)
  createBooking(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.service.createAppointmentFromWidget(tenantId, dto);
  }
}
