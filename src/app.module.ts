import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

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
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { ReminderModule } from './modules/reminder/reminder.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { BillingModule } from './modules/billing/billing.module';
import { AIModule } from './modules/ai/ai.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

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
    AuthModule,
    TenantModule,
    UserModule,
    AppointmentModule,
    ReminderModule,
    MessagingModule,
    BillingModule,
    AIModule,
    WebhookModule,
    AnalyticsModule,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
