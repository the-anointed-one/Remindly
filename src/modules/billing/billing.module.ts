import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaystackProvider } from './paystack.provider';
import { PaystackWebhookController } from './paystack-webhook.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BillingController, PaystackWebhookController],
  providers: [BillingService, PaystackProvider],
  exports: [BillingService, PaystackProvider],
})
export class BillingModule {}
