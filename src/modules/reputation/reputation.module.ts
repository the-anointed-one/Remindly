import { Module, forwardRef } from '@nestjs/common';
import { ReputationService } from './reputation.service';
import { ReputationController } from './reputation.controller';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [forwardRef(() => MessagingModule)],
  controllers: [ReputationController],
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}
