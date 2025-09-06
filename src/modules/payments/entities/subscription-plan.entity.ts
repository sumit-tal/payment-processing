import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { IsUUID, IsString, IsNumber, IsEnum, IsBoolean, IsOptional } from 'class-validator';

export enum BillingInterval {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum SubscriptionPlanStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

@Entity('subscription_plans')
@Index(['name'], { unique: true })
@Index(['status'])
@Index(['isActive'])
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  readonly id: string;

  @Column({ unique: true })
  @IsString()
  readonly name: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsNumber({ maxDecimalPlaces: 2 })
  readonly amount: number;

  @Column({ length: 3, default: 'USD' })
  @IsString()
  readonly currency: string;

  @Column({
    type: 'enum',
    enum: BillingInterval,
    default: BillingInterval.MONTHLY,
  })
  @IsEnum(BillingInterval)
  readonly billingInterval: BillingInterval;

  @Column({ name: 'billing_interval_count', default: 1 })
  @IsNumber()
  readonly billingIntervalCount: number;

  @Column({ name: 'trial_period_days', nullable: true })
  @IsOptional()
  @IsNumber()
  trialPeriodDays?: number;

  @Column({ name: 'setup_fee', type: 'decimal', precision: 10, scale: 2, default: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  setupFee: number;

  @Column({ name: 'max_billing_cycles', nullable: true })
  @IsOptional()
  @IsNumber()
  maxBillingCycles?: number;

  @Column({
    type: 'enum',
    enum: SubscriptionPlanStatus,
    default: SubscriptionPlanStatus.ACTIVE,
  })
  @IsEnum(SubscriptionPlanStatus)
  status: SubscriptionPlanStatus;

  @Column({ name: 'is_active', default: true })
  @IsBoolean()
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  readonly createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  constructor(partial: Partial<SubscriptionPlan>) {
    Object.assign(this, partial);
  }
}
