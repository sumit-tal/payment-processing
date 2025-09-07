import { DataSource } from 'typeorm';
import configuration from './configuration';
import { Transaction } from '../database/entities/transaction.entity';
import { ApiKey } from '../database/entities/api-key.entity';
import { AuditLog } from '../database/entities/audit-log.entity';
import { PaymentMethod } from '../database/entities/payment-method.entity';
import { SubscriptionPayment } from '../database/entities/subscription-payment.entity';
import { SubscriptionPlan } from '../database/entities/subscription-plan.entity';
import { Subscription } from '../database/entities/subscription.entity';
import { WebhookEvent } from '../database/entities/webhook-event.entity';

/**
 * Default DataSource for TypeORM CLI and migrations.
 */
const connectionSource = new DataSource({
  type: 'postgres',
  url: configuration.db.dbConnectionString,
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
  synchronize: configuration.db.synchronize,
  logging: configuration.db.logging,
  migrations: [`${__dirname}/../database/migrations/*{.ts,.js}`],
  migrationsTableName: 'migration_history',
});

export default connectionSource;
