import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePaymentTables1694000000000 implements MigrationInterface {
  name = 'CreatePaymentTables1694000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create transactions table
    await queryRunner.createTable(
      new Table({
        name: 'transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchant_transaction_id',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'gateway_transaction_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'parent_transaction_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['purchase', 'authorization', 'capture', 'refund', 'void'],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
            default: "'pending'",
          },
          {
            name: 'payment_method',
            type: 'enum',
            enum: ['credit_card', 'debit_card', 'bank_transfer'],
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'refunded_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'order_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
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
            name: 'failure_reason',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'processed_at',
            type: 'timestamp',
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

    // Create payment_methods table
    await queryRunner.createTable(
      new Table({
        name: 'payment_methods',
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
            name: 'gateway_payment_method_id',
            type: 'varchar',
          },
          {
            name: 'card_last_four',
            type: 'varchar',
            length: '4',
            isNullable: true,
          },
          {
            name: 'card_brand',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'card_expiry_month',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'card_expiry_year',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'billing_address',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'is_default',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
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

    // Create indexes for transactions table
    await queryRunner.createIndex('transactions', new TableIndex({
      name: 'IDX_transactions_merchant_transaction_id',
      columnNames: ['merchant_transaction_id'],
      isUnique: true,
    }));
    await queryRunner.createIndex('transactions', new TableIndex({
      name: 'IDX_transactions_gateway_transaction_id',
      columnNames: ['gateway_transaction_id'],
    }));
    await queryRunner.createIndex('transactions', new TableIndex({
      name: 'IDX_transactions_status',
      columnNames: ['status'],
    }));
    await queryRunner.createIndex('transactions', new TableIndex({
      name: 'IDX_transactions_type',
      columnNames: ['type'],
    }));
    await queryRunner.createIndex('transactions', new TableIndex({
      name: 'IDX_transactions_created_at',
      columnNames: ['created_at'],
    }));
    await queryRunner.createIndex('transactions', new TableIndex({
      name: 'IDX_transactions_idempotency_key',
      columnNames: ['idempotency_key'],
      isUnique: true,
    }));

    // Create indexes for payment_methods table
    await queryRunner.createIndex('payment_methods', new TableIndex({
      name: 'IDX_payment_methods_customer_id',
      columnNames: ['customer_id'],
    }));
    await queryRunner.createIndex('payment_methods', new TableIndex({
      name: 'IDX_payment_methods_is_default',
      columnNames: ['is_default'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('payment_methods', 'IDX_payment_methods_is_default');
    await queryRunner.dropIndex('payment_methods', 'IDX_payment_methods_customer_id');
    await queryRunner.dropIndex('transactions', 'IDX_transactions_idempotency_key');
    await queryRunner.dropIndex('transactions', 'IDX_transactions_created_at');
    await queryRunner.dropIndex('transactions', 'IDX_transactions_type');
    await queryRunner.dropIndex('transactions', 'IDX_transactions_status');
    await queryRunner.dropIndex('transactions', 'IDX_transactions_gateway_transaction_id');
    await queryRunner.dropIndex('transactions', 'IDX_transactions_merchant_transaction_id');

    // Drop tables
    await queryRunner.dropTable('payment_methods');
    await queryRunner.dropTable('transactions');
  }
}
