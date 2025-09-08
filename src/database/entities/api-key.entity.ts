import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('api_keys')
@Index(['keyHash'], { unique: true })
@Index(['clientId'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', length: 100 })
  clientId: string;

  @Column({ name: 'client_name', length: 255 })
  clientName: string;

  @Column({ name: 'key_hash', length: 255 })
  keyHash: string;

  @Column({ name: 'key_prefix', length: 20 })
  keyPrefix: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'permissions', type: 'jsonb', default: '[]' })
  permissions: string[];

  @Column({ name: 'rate_limit', default: 1000 })
  rateLimit: number;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'created_by', length: 100 })
  createdBy: string;

  @Column({ name: 'metadata', type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;
}
