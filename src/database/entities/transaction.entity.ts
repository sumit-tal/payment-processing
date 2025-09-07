import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  IsEnum,
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
} from 'class-validator';

export enum TransactionType {
  PURCHASE = 'purchase',
  AUTHORIZATION = 'authorization',
  CAPTURE = 'capture',
  REFUND = 'refund',
  VOID = 'void',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
}

@Entity('transactions')
@Index(['merchantTransactionId'], { unique: true })
@Index(['gatewayTransactionId'])
@Index(['status'])
@Index(['type'])
@Index(['createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  readonly id: string;

  @Column({ name: 'merchant_transaction_id', unique: true })
  @IsString()
  readonly merchantTransactionId: string;

  @Column({ name: 'gateway_transaction_id', nullable: true })
  @IsOptional()
  @IsString()
  gatewayTransactionId?: string;

  @Column({ name: 'parent_transaction_id', nullable: true })
  @IsOptional()
  @IsUUID()
  parentTransactionId?: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  @IsEnum(TransactionType)
  readonly type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  @IsEnum(PaymentMethod)
  readonly paymentMethod: PaymentMethod;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber({ maxDecimalPlaces: 2 })
  readonly amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  refundedAmount: number;

  @Column({ length: 3 })
  @IsString()
  readonly currency: string;

  @Column({ name: 'customer_id', nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Column({ name: 'order_id', nullable: true })
  @IsOptional()
  @IsString()
  orderId?: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'gateway_response', type: 'jsonb', nullable: true })
  gatewayResponse?: Record<string, any>;

  @Column({ name: 'failure_reason', nullable: true })
  @IsOptional()
  @IsString()
  failureReason?: string;

  @Column({ name: 'idempotency_key', unique: true })
  @IsString()
  readonly idempotencyKey: string;

  @Column({ name: 'processed_at', nullable: true })
  processedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  readonly createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  constructor(partial: Partial<Transaction>) {
    Object.assign(this, partial);
  }
}
