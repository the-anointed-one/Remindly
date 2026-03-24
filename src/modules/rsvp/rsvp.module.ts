import { Module, forwardRef } from '@nestjs/common';
import { RsvpProcessorService } from './rsvp-processor.service';
import { RsvpQueueService } from './rsvp-queue.service';
import { RsvpController } from './rsvp.controller';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [forwardRef(() => AutomationModule)],
  providers: [RsvpProcessorService, RsvpQueueService],
  controllers: [RsvpController],
  exports: [RsvpProcessorService, RsvpQueueService],
})
export class RsvpModule {}
