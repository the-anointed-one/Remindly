import { Global, Module, forwardRef } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventInviteService } from './event-invite.service';
import { AutomationModule } from '../automation/automation.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ReminderModule } from '../reminder/reminder.module';

@Global()
@Module({
  imports: [
    AutomationModule,
    forwardRef(() => MessagingModule),
    ReminderModule,
  ],
  controllers: [EventController],
  providers: [EventService, EventInviteService],
  exports: [EventService, EventInviteService],
})
export class EventModule {}
