import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Config
import { envValidationSchema } from './config/env.validation';

// Infrastructure
import { PrismaModule } from './prisma/prisma.module';

// Common
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Feature modules
import { AuditModule } from './modules/audit/audit.module';
import { PlanModule } from './modules/plan/plan.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { ReminderModule } from './modules/reminder/reminder.module';
import { TemplateModule } from './modules/template/template.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { BillingModule } from './modules/billing/billing.module';
import { AIModule } from './modules/ai/ai.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { EmailModule } from './modules/email/email.module';
import { GoogleReviewModule } from './modules/google-review/google-review.module';
import { CalendarIntegrationModule } from './modules/calendar-integration/calendar-integration.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ReschedulingModule } from './modules/rescheduling/rescheduling.module';
import { BookingWidgetModule } from './modules/booking-widget/booking-widget.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { LocationsModule } from './modules/locations/locations.module';
import { AutomationModule } from './modules/automation/automation.module';
import { ReputationModule } from './modules/reputation/reputation.module';
import { ChannelStrategyModule } from './modules/channel-strategy/channel-strategy.module';
import { RevenueAnalyticsModule } from './modules/revenue-analytics/revenue-analytics.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { EventModule } from './modules/event/event.module';
import { RsvpModule } from './modules/rsvp/rsvp.module';

@Module({
  imports: [
    // Global config with env validation
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),

    // Database
    PrismaModule,

    // Feature modules
    AuditModule,
    PlanModule,
    AuthModule,
    TenantModule,
    UserModule,
    AppointmentModule,
    ReminderModule,
    TemplateModule,
    MessagingModule,
    BillingModule,
    AIModule,
    WebhookModule,
    AnalyticsModule,
    HealthModule,
    EmailModule,
    GoogleReviewModule,
    CalendarIntegrationModule,
    ContactsModule,
    ReschedulingModule,
    BookingWidgetModule,
    ComplianceModule,
    LocationsModule,
    AutomationModule,
    ReputationModule,
    ChannelStrategyModule,
    RevenueAnalyticsModule,
    CampaignModule,
    EventModule,
    RsvpModule,

    // Rate limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Cron jobs (UsageResetJob etc.)
    ScheduleModule.forRoot(),
  ],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global JWT auth guard (respects @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global roles guard (respects @Roles())
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude('webhooks/twilio/(.*)')
      .forRoutes('*path');
  }
}
