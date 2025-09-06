import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateSecurityTables1694000000005 implements MigrationInterface {
  name = 'CreateSecurityTables1694000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create api_keys table
    await queryRunner.createTable(
      new Table({
        name: 'api_keys',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'client_id',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'client_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'key_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'key_prefix',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'permissions',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'rate_limit',
            type: 'integer',
            default: 1000,
          },
          {
            name: 'last_used_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expires_at',
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
          {
            name: 'created_by',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
        ],
      }),
      true,
    );

    // Create audit_logs table
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'action',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'entity_type',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'entity_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'request_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'success',
            type: 'boolean',
            default: true,
          },
          {
            name: 'error_message',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'duration_ms',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for api_keys table
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_api_keys_key_hash" ON "api_keys" ("key_hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_api_keys_client_id" ON "api_keys" ("client_id")`);

    // Create indexes for audit_logs table
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_ip_address" ON "audit_logs" ("ip_address")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_ip_address');
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_created_at');
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_user_id');
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_entity');
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_action');
    await queryRunner.dropIndex('api_keys', 'IDX_api_keys_client_id');
    await queryRunner.dropIndex('api_keys', 'IDX_api_keys_key_hash');

    // Drop tables
    await queryRunner.dropTable('audit_logs');
    await queryRunner.dropTable('api_keys');
  }
}
