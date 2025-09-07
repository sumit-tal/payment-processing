import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentsModule } from './modules/payments/payments.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { Transaction } from './database/entities/transaction.entity';
import { ApiKey } from './database/entities/api-key.entity';
import { AuditLog } from './database/entities/audit-log.entity';
import { PaymentMethod } from './database/entities/payment-method.entity';
import { SubscriptionPayment } from './database/entities/subscription-payment.entity';
import { SubscriptionPlan } from './database/entities/subscription-plan.entity';
import { Subscription } from './database/entities/subscription.entity';
import { WebhookEvent } from './database/entities/webhook-event.entity';

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
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url:
          configService.get('DB_URL') ||
          `postgresql://${encodeURIComponent(configService.get('DB_USERNAME', 'postgres'))}:${encodeURIComponent(configService.get('DB_PASSWORD', 'password'))}@${configService.get('DB_HOST', 'localhost')}:${configService.get('DB_PORT', 5432)}/${configService.get('DB_NAME', 'payment_processing')}`,
        entities: [
          Transaction,
          ApiKey,
          AuditLog,
          PaymentMethod,
          SubscriptionPayment,
          SubscriptionPlan,
          Subscription,
          WebhookEvent,
        ],
        synchronize: configService.get('DB_SYNCHRONIZE', 'false') === 'true',
        logging: configService.get('DB_LOGGING', 'false') === 'true',
        poolSize: parseInt(configService.get('DB_MAX_CONNECTIONS', '10')),
        migrations: [`${__dirname}/database/migrations/*{.ts,.js}`],
        migrationsTableName: 'migration_history',
      }),
      inject: [ConfigService],
    }),
    ObservabilityModule,
    HealthModule,
    PaymentsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
