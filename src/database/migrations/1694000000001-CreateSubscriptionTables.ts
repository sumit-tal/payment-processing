import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSubscriptionTables1694000000001 implements MigrationInterface {
  name = 'CreateSubscriptionTables1694000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create subscription_plans table
    await queryRunner.createTable(
      new Table({
        name: 'subscription_plans',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
          },
          {
            name: 'billing_interval',
            type: 'enum',
            enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
            default: "'monthly'",
          },
          {
            name: 'billing_interval_count',
            type: 'int',
            default: 1,
          },
          {
            name: 'trial_period_days',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'setup_fee',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'max_billing_cycles',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'archived'],
            default: "'active'",
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create subscriptions table
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'customer_id',
            type: 'uuid',
          },
          {
            name: 'subscription_plan_id',
            type: 'uuid',
          },
          {
            name: 'payment_method_id',
            type: 'uuid',
          },
          {
            name: 'gateway_subscription_id',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'past_due', 'cancelled', 'expired', 'suspended', 'trial'],
            default: "'active'",
          },
          {
            name: 'current_period_start',
            type: 'timestamp',
          },
          {
            name: 'current_period_end',
            type: 'timestamp',
          },
          {
            name: 'next_billing_date',
            type: 'timestamp',
          },
          {
            name: 'trial_start',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'trial_end',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'ended_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'billing_cycle_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'failed_payment_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'last_payment_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_payment_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'gateway_response',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create subscription_payments table
    await queryRunner.createTable(
      new Table({
        name: 'subscription_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'subscription_id',
            type: 'uuid',
          },
          {
            name: 'transaction_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
          },
          {
            name: 'billing_date',
            type: 'timestamp',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'failed', 'retrying', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'billing_cycle_number',
            type: 'int',
          },
          {
            name: 'retry_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'max_retry_attempts',
            type: 'int',
            default: 3,
          },
          {
            name: 'next_retry_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'processed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failure_reason',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'gateway_response',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for subscription_plans table
    await queryRunner.createIndex('subscription_plans', new TableIndex({
      name: 'IDX_subscription_plans_name',
      columnNames: ['name'],
      isUnique: true,
    }));
    await queryRunner.createIndex('subscription_plans', new TableIndex({
      name: 'IDX_subscription_plans_status',
      columnNames: ['status'],
    }));
    await queryRunner.createIndex('subscription_plans', new TableIndex({
      name: 'IDX_subscription_plans_is_active',
      columnNames: ['is_active'],
    }));

    // Create indexes for subscriptions table
    await queryRunner.createIndex('subscriptions', new TableIndex({
      name: 'IDX_subscriptions_customer_id',
      columnNames: ['customer_id'],
    }));
    await queryRunner.createIndex('subscriptions', new TableIndex({
      name: 'IDX_subscriptions_status',
      columnNames: ['status'],
    }));
    await queryRunner.createIndex('subscriptions', new TableIndex({
      name: 'IDX_subscriptions_gateway_subscription_id',
      columnNames: ['gateway_subscription_id'],
    }));
    await queryRunner.createIndex('subscriptions', new TableIndex({
      name: 'IDX_subscriptions_next_billing_date',
      columnNames: ['next_billing_date'],
    }));
    await queryRunner.createIndex('subscriptions', new TableIndex({
      name: 'IDX_subscriptions_created_at',
      columnNames: ['created_at'],
    }));

    // Create indexes for subscription_payments table
    await queryRunner.createIndex('subscription_payments', new TableIndex({
      name: 'IDX_subscription_payments_subscription_id',
      columnNames: ['subscription_id'],
    }));
    await queryRunner.createIndex('subscription_payments', new TableIndex({
      name: 'IDX_subscription_payments_status',
      columnNames: ['status'],
    }));
    await queryRunner.createIndex('subscription_payments', new TableIndex({
      name: 'IDX_subscription_payments_billing_date',
      columnNames: ['billing_date'],
    }));
    await queryRunner.createIndex('subscription_payments', new TableIndex({
      name: 'IDX_subscription_payments_created_at',
      columnNames: ['created_at'],
    }));

    // Create foreign key constraints
    await queryRunner.createForeignKey('subscriptions', new TableForeignKey({
      columnNames: ['subscription_plan_id'],
      referencedColumnNames: ['id'],
      referencedTableName: 'subscription_plans',
      onDelete: 'RESTRICT',
    }));

    await queryRunner.createForeignKey('subscriptions', new TableForeignKey({
      columnNames: ['payment_method_id'],
      referencedColumnNames: ['id'],
      referencedTableName: 'payment_methods',
      onDelete: 'RESTRICT',
    }));

    await queryRunner.createForeignKey('subscription_payments', new TableForeignKey({
      columnNames: ['subscription_id'],
      referencedColumnNames: ['id'],
      referencedTableName: 'subscriptions',
      onDelete: 'CASCADE',
    }));

    await queryRunner.createForeignKey('subscription_payments', new TableForeignKey({
      columnNames: ['transaction_id'],
      referencedColumnNames: ['id'],
      referencedTableName: 'transactions',
      onDelete: 'SET NULL',
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const subscriptionPaymentsTable = await queryRunner.getTable('subscription_payments');
    const subscriptionPaymentsTransactionFk = subscriptionPaymentsTable.foreignKeys.find(fk => fk.columnNames.indexOf('transaction_id') !== -1);
    const subscriptionPaymentsSubscriptionFk = subscriptionPaymentsTable.foreignKeys.find(fk => fk.columnNames.indexOf('subscription_id') !== -1);
    
    const subscriptionsTable = await queryRunner.getTable('subscriptions');
    const subscriptionsPaymentMethodFk = subscriptionsTable.foreignKeys.find(fk => fk.columnNames.indexOf('payment_method_id') !== -1);
    const subscriptionsSubscriptionPlanFk = subscriptionsTable.foreignKeys.find(fk => fk.columnNames.indexOf('subscription_plan_id') !== -1);

    if (subscriptionPaymentsTransactionFk) {
      await queryRunner.dropForeignKey('subscription_payments', subscriptionPaymentsTransactionFk);
    }
    if (subscriptionPaymentsSubscriptionFk) {
      await queryRunner.dropForeignKey('subscription_payments', subscriptionPaymentsSubscriptionFk);
    }
    if (subscriptionsPaymentMethodFk) {
      await queryRunner.dropForeignKey('subscriptions', subscriptionsPaymentMethodFk);
    }
    if (subscriptionsSubscriptionPlanFk) {
      await queryRunner.dropForeignKey('subscriptions', subscriptionsSubscriptionPlanFk);
    }

    // Drop indexes
    await queryRunner.dropIndex('subscription_payments', 'IDX_subscription_payments_created_at');
    await queryRunner.dropIndex('subscription_payments', 'IDX_subscription_payments_billing_date');
    await queryRunner.dropIndex('subscription_payments', 'IDX_subscription_payments_status');
    await queryRunner.dropIndex('subscription_payments', 'IDX_subscription_payments_subscription_id');
    
    await queryRunner.dropIndex('subscriptions', 'IDX_subscriptions_created_at');
    await queryRunner.dropIndex('subscriptions', 'IDX_subscriptions_next_billing_date');
    await queryRunner.dropIndex('subscriptions', 'IDX_subscriptions_gateway_subscription_id');
    await queryRunner.dropIndex('subscriptions', 'IDX_subscriptions_status');
    await queryRunner.dropIndex('subscriptions', 'IDX_subscriptions_customer_id');
    
    await queryRunner.dropIndex('subscription_plans', 'IDX_subscription_plans_is_active');
    await queryRunner.dropIndex('subscription_plans', 'IDX_subscription_plans_status');
    await queryRunner.dropIndex('subscription_plans', 'IDX_subscription_plans_name');

    // Drop tables
    await queryRunner.dropTable('subscription_payments');
    await queryRunner.dropTable('subscriptions');
    await queryRunner.dropTable('subscription_plans');
  }
}
