import { Module } from '@nestjs/common';
import {
  BookingWidgetController,
  PublicBookingController,
} from './booking-widget.controller';
import { BookingWidgetService } from './booking-widget.service';
import { ReminderModule } from '../reminder/reminder.module';
import { AppointmentModule } from '../appointment/appointment.module';

@Module({
  imports: [ReminderModule, AppointmentModule],
  controllers: [BookingWidgetController, PublicBookingController],
  providers: [BookingWidgetService],
  exports: [BookingWidgetService],
})
export class BookingWidgetModule {}
