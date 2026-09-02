import { Module, forwardRef } from '@nestjs/common';
import { RsvpProcessorService } from './rsvp-processor.service';
import { RsvpQueueService } from './rsvp-queue.service';
import { RsvpQueueConsumer } from './rsvp-queue-consumer.service';
import { RsvpController } from './rsvp.controller';
import { AutomationModule } from '../automation/automation.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  // MessagingModule already imports RsvpModule (forwardRef) for the inbound
  // webhook, so this side must be a forwardRef too or the cycle won't resolve.
  imports: [forwardRef(() => AutomationModule), forwardRef(() => MessagingModule)],
  providers: [RsvpProcessorService, RsvpQueueService, RsvpQueueConsumer],
  controllers: [RsvpController],
  exports: [RsvpProcessorService, RsvpQueueService],
})
export class RsvpModule {}
