import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookEventType {
  PAYMENT_AUTHORIZED = 'payment.authorized',
  PAYMENT_CAPTURED = 'payment.captured',
  PAYMENT_SETTLED = 'payment.settled',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_VOIDED = 'payment.voided',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',
  SUBSCRIPTION_PAYMENT_SUCCESS = 'subscription.payment.success',
  SUBSCRIPTION_PAYMENT_FAILED = 'subscription.payment.failed',
}

export enum WebhookEventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('webhook_events')
@Index(['eventType', 'status'])
@Index(['createdAt'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  readonly id: string;

  @Column({
    type: 'enum',
    enum: WebhookEventType,
    nullable: false,
  })
  eventType: WebhookEventType;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  @Index()
  externalId: string;

  @Column({
    type: 'jsonb',
    nullable: false,
  })
  readonly payload: Record<string, any>;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  readonly signature: string;

  @Column({
    type: 'enum',
    enum: WebhookEventStatus,
    default: WebhookEventStatus.PENDING,
  })
  status: WebhookEventStatus;

  @Column({
    type: 'int',
    default: 0,
  })
  retryCount: number;

  @Column({
    type: 'int',
    default: 3,
  })
  readonly maxRetries: number;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  processedAt: Date;

  @Column({
    type: 'text',
    nullable: true,
  })
  errorMessage: string;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  processingResult: Record<string, any>;

  @CreateDateColumn()
  readonly createdAt: Date;

  @UpdateDateColumn()
  readonly updatedAt: Date;

  /**
   * Check if the webhook event can be retried
   */
  canRetry(): boolean {
    return (
      this.retryCount < this.maxRetries &&
      this.status !== WebhookEventStatus.PROCESSED
    );
  }

  /**
   * Mark the event as processing
   */
  markAsProcessing(): void {
    this.status = WebhookEventStatus.PROCESSING;
  }

  /**
   * Mark the event as processed
   */
  markAsProcessed(result?: Record<string, any>): void {
    this.status = WebhookEventStatus.PROCESSED;
    this.processedAt = new Date();
    if (result) {
      this.processingResult = result;
    }
  }

  /**
   * Mark the event as failed
   */
  markAsFailed(errorMessage: string): void {
    this.status = WebhookEventStatus.FAILED;
    this.errorMessage = errorMessage;
  }

  /**
   * Increment retry count and update status
   */
  incrementRetry(): void {
    this.retryCount += 1;
    this.status = this.canRetry()
      ? WebhookEventStatus.RETRYING
      : WebhookEventStatus.FAILED;
  }
}
