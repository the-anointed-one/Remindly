import { Module } from '@nestjs/common';
import { GoogleReviewController } from './google-review.controller';
import { GoogleReviewService } from './google-review.service';
import { GoogleBusinessProvider } from './google-business.provider';
import { AIModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AIModule, // provides OpenAIProvider
    AuditModule, // provides AuditService
  ],
  controllers: [GoogleReviewController],
  providers: [GoogleReviewService, GoogleBusinessProvider],
  exports: [GoogleReviewService],
})
export class GoogleReviewModule {}
