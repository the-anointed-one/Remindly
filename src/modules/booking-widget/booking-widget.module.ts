import { Module } from '@nestjs/common';
import {
  BookingWidgetController,
  PublicBookingController,
} from './booking-widget.controller';
import { BookingWidgetService } from './booking-widget.service';
import { ReminderModule } from '../reminder/reminder.module';

@Module({
  imports: [ReminderModule],
  controllers: [BookingWidgetController, PublicBookingController],
  providers: [BookingWidgetService],
  exports: [BookingWidgetService],
})
export class BookingWidgetModule {}
