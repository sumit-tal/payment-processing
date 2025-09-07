import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
  // Authentication actions
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_UPDATED = 'API_KEY_UPDATED',
  API_KEY_DEACTIVATED = 'API_KEY_DEACTIVATED',
  API_KEY_DELETED = 'API_KEY_DELETED',
  API_KEY_USED = 'API_KEY_USED',
  
  // Payment actions
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_AUTHORIZED = 'PAYMENT_AUTHORIZED',
  PAYMENT_CAPTURED = 'PAYMENT_CAPTURED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  PAYMENT_VOIDED = 'PAYMENT_VOIDED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  
  // Subscription actions
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_RENEWED = 'SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_FAILED = 'SUBSCRIPTION_FAILED',
  
  // Webhook actions
  WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
  WEBHOOK_PROCESSED = 'WEBHOOK_PROCESSED',
  WEBHOOK_FAILED = 'WEBHOOK_FAILED',
  
  // Security actions
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

@Entity('audit_logs')
@Index(['action'])
@Index(['entityType', 'entityId'])
@Index(['userId'])
@Index(['createdAt'])
@Index(['ipAddress'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ name: 'entity_type', length: 100, nullable: true })
  entityType: string;

  @Column({ name: 'entity_id', length: 100, nullable: true })
  entityId: string;

  @Column({ name: 'user_id', length: 100, nullable: true })
  userId: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent: string;

  @Column({ name: 'request_id', length: 100, nullable: true })
  requestId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'success', default: true })
  success: boolean;

  @Column({ name: 'error_message', length: 1000, nullable: true })
  errorMessage: string;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
