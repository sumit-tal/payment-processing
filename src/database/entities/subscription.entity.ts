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
import { SubscriptionPlan } from './subscription-plan.entity';
import { PaymentMethod } from './payment-method.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
}

@Entity('subscriptions')
@Index(['customerId'])
@Index(['status'])
@Index(['gatewaySubscriptionId'])
@Index(['nextBillingDate'])
@Index(['createdAt'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  readonly id: string;

  @Column({ name: 'customer_id' })
  @IsUUID()
  readonly customerId: string;

  @Column({ name: 'subscription_plan_id' })
  @IsUUID()
  readonly subscriptionPlanId: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'subscription_plan_id' })
  subscriptionPlan: SubscriptionPlan;

  @Column({ name: 'payment_method_id' })
  @IsUUID()
  paymentMethodId: string;

  @ManyToOne(() => PaymentMethod)
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod;

  @Column({ name: 'gateway_subscription_id', unique: true })
  @IsString()
  gatewaySubscriptionId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;

  @Column({ name: 'current_period_start' })
  @IsDate()
  currentPeriodStart: Date;

  @Column({ name: 'current_period_end' })
  @IsDate()
  currentPeriodEnd: Date;

  @Column({ name: 'next_billing_date' })
  @IsDate()
  nextBillingDate: Date;

  @Column({ name: 'trial_start', nullable: true })
  @IsOptional()
  @IsDate()
  trialStart?: Date;

  @Column({ name: 'trial_end', nullable: true })
  @IsOptional()
  @IsDate()
  trialEnd?: Date;

  @Column({ name: 'cancelled_at', nullable: true })
  @IsOptional()
  @IsDate()
  cancelledAt?: Date;

  @Column({ name: 'ended_at', nullable: true })
  @IsOptional()
  @IsDate()
  endedAt?: Date;

  @Column({ name: 'billing_cycle_count', default: 0 })
  @IsNumber()
  billingCycleCount: number;

  @Column({ name: 'failed_payment_count', default: 0 })
  @IsNumber()
  failedPaymentCount: number;

  @Column({ name: 'last_payment_date', nullable: true })
  @IsOptional()
  @IsDate()
  lastPaymentDate?: Date;

  @Column({ name: 'last_payment_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  lastPaymentAmount?: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'gateway_response', type: 'jsonb', nullable: true })
  gatewayResponse?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  readonly createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  constructor(partial: Partial<Subscription>) {
    Object.assign(this, partial);
  }
}
