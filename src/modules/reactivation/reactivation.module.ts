import { Module } from '@nestjs/common';
import { ReactivationService } from './reactivation.service';
import { ReactivationController } from './reactivation.controller';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [MessagingModule],
  controllers: [ReactivationController],
  providers: [ReactivationService],
  exports: [ReactivationService],
})
export class ReactivationModule {}
