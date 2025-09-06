import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';
import { PaymentsModule } from './modules/payments/payments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ObservabilityModule } from './modules/observability/observability.module';

/**
 * Minimal application module for testing
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    ObservabilityModule,
    HealthModule,
    PaymentsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppMinimalModule {}
