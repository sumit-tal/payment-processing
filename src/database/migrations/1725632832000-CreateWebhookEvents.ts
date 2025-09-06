import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateWebhookEvents1725632832000 implements MigrationInterface {
  name = 'CreateWebhookEvents1725632832000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create webhook_events table
    await queryRunner.createTable(
      new Table({
        name: 'webhook_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'eventType',
            type: 'enum',
            enum: [
              'payment.authorized',
              'payment.captured',
              'payment.settled',
              'payment.failed',
              'payment.refunded',
              'payment.voided',
              'subscription.created',
              'subscription.updated',
              'subscription.cancelled',
              'subscription.expired',
              'subscription.payment.success',
              'subscription.payment.failed',
            ],
            isNullable: false,
          },
          {
            name: 'externalId',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'signature',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'processed', 'failed', 'retrying'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'maxRetries',
            type: 'int',
            default: 3,
            isNullable: false,
          },
          {
            name: 'processedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'processingResult',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_event_type_status" ON "webhook_events" ("eventType", "status")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_webhook_events_external_id" ON "webhook_events" ("externalId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_created_at" ON "webhook_events" ("createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_status" ON "webhook_events" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_processed_at" ON "webhook_events" ("processedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_processed_at');
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_status');
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_created_at');
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_external_id');
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_event_type_status');

    // Drop table
    await queryRunner.dropTable('webhook_events');
  }
}
