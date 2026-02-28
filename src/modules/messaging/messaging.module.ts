import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MockSendService } from './mock-send.service';

@Module({
    controllers: [MessagingController],
    providers: [MessagingService, MockSendService],
    exports: [MessagingService, MockSendService],
})
export class MessagingModule { }
