import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// Redis integration will be handled directly in services
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuthModule } from './modules/auth/auth.module';
import { SecurityModule } from './modules/security/security.module';
import { AuditModule } from './modules/audit/audit.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { DatabaseConfig } from './config/database.config';
import securityConfig from './config/security.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { ApiKeyAuthGuard } from './common/guards/api-key-auth.guard';
// import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { LoggingInterceptor } from './modules/observability/interceptors/logging.interceptor';
import { MetricsInterceptor } from './modules/observability/interceptors/metrics.interceptor';
import { RateLimitMiddleware } from './modules/security/middleware/rate-limit.middleware';
import { CorrelationIdMiddleware } from './modules/observability/middleware/correlation-id.middleware';

/**
 * Root application module with security, audit, and compliance features
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [securityConfig],
    }),
    // TypeOrmModule.forRootAsync({
    //   useClass: DatabaseConfig,
    // }),
    ObservabilityModule,
    SecurityModule,
    // AuditModule,
    // AuthModule,
    HealthModule,
    // PaymentsModule,
    // WebhooksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // {
    //   provide: APP_GUARD,
    //   useClass: ApiKeyAuthGuard,
    // },
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: AuditInterceptor,
    // },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*');
  }
}
