import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsUUID, IsString, IsNumber, IsEnum, IsOptional, IsDate } from 'class-validator';
import { Subscription } from './subscription.entity';
import { Transaction } from './transaction.entity';

export enum SubscriptionPaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled',
}

@Entity('subscription_payments')
@Index(['subscriptionId'])
@Index(['status'])
@Index(['billingDate'])
@Index(['createdAt'])
export class SubscriptionPayment {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  readonly id: string;

  @Column({ name: 'subscription_id' })
  @IsUUID()
  readonly subscriptionId: string;

  @ManyToOne(() => Subscription)
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  @Column({ name: 'transaction_id', nullable: true })
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id' })
  transaction?: Transaction;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber({ maxDecimalPlaces: 2 })
  readonly amount: number;

  @Column({ length: 3, default: 'USD' })
  @IsString()
  readonly currency: string;

  @Column({ name: 'billing_date' })
  @IsDate()
  readonly billingDate: Date;

  @Column({
    type: 'enum',
    enum: SubscriptionPaymentStatus,
    default: SubscriptionPaymentStatus.PENDING,
  })
  @IsEnum(SubscriptionPaymentStatus)
  status: SubscriptionPaymentStatus;

  @Column({ name: 'billing_cycle_number' })
  @IsNumber()
  readonly billingCycleNumber: number;

  @Column({ name: 'retry_count', default: 0 })
  @IsNumber()
  retryCount: number;

  @Column({ name: 'max_retry_attempts', default: 3 })
  @IsNumber()
  maxRetryAttempts: number;

  @Column({ name: 'next_retry_date', nullable: true })
  @IsOptional()
  @IsDate()
  nextRetryDate?: Date;

  @Column({ name: 'processed_at', nullable: true })
  @IsOptional()
  @IsDate()
  processedAt?: Date;

  @Column({ name: 'failure_reason', nullable: true })
  @IsOptional()
  @IsString()
  failureReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'gateway_response', type: 'jsonb', nullable: true })
  gatewayResponse?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  readonly createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  constructor(partial: Partial<SubscriptionPayment>) {
    Object.assign(this, partial);
  }
}
