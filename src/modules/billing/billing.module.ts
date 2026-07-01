import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaystackProvider } from './paystack.provider';
import { PaypalProvider } from './paypal.provider';
import { CryptoProvider } from './crypto.provider';
import { PaystackWebhookController } from './paystack-webhook.controller';
import { PaypalWebhookController } from './paypal-webhook.controller';
import { CryptoWebhookController } from './crypto-webhook.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    BillingController,
    PaystackWebhookController,
    PaypalWebhookController,
    CryptoWebhookController,
  ],
  providers: [BillingService, PaystackProvider, PaypalProvider, CryptoProvider],
  exports: [BillingService, PaystackProvider, PaypalProvider, CryptoProvider],
})
export class BillingModule {}
