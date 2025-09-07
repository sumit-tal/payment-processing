import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { BillingInterval, SubscriptionPlanStatus } from '@/database/entities/subscription-plan.entity';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ description: 'Unique name for the subscription plan' })
  @IsString()
  readonly name: string;

  @ApiPropertyOptional({ description: 'Description of the subscription plan' })
  @IsOptional()
  @IsString()
  readonly description?: string;

  @ApiProperty({ description: 'Amount to charge per billing cycle', example: 29.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  readonly amount: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  readonly currency?: string;

  @ApiPropertyOptional({ 
    description: 'Billing interval',
    enum: BillingInterval,
    default: BillingInterval.MONTHLY
  })
  @IsOptional()
  @IsEnum(BillingInterval)
  readonly billingInterval?: BillingInterval;

  @ApiPropertyOptional({ description: 'Number of billing intervals between charges', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  readonly billingIntervalCount?: number;

  @ApiPropertyOptional({ description: 'Number of trial days before first charge' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  readonly trialPeriodDays?: number;

  @ApiPropertyOptional({ description: 'One-time setup fee', default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  readonly setupFee?: number;

  @ApiPropertyOptional({ description: 'Maximum number of billing cycles (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  readonly maxBillingCycles?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  readonly metadata?: Record<string, any>;
}

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({ description: 'Description of the subscription plan' })
  @IsOptional()
  @IsString()
  readonly description?: string;

  @ApiPropertyOptional({ description: 'Number of trial days before first charge' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  readonly trialPeriodDays?: number;

  @ApiPropertyOptional({ description: 'One-time setup fee' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  readonly setupFee?: number;

  @ApiPropertyOptional({ description: 'Maximum number of billing cycles (null for unlimited)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  readonly maxBillingCycles?: number;

  @ApiPropertyOptional({ 
    description: 'Plan status',
    enum: SubscriptionPlanStatus
  })
  @IsOptional()
  @IsEnum(SubscriptionPlanStatus)
  readonly status?: SubscriptionPlanStatus;

  @ApiPropertyOptional({ description: 'Whether the plan is active' })
  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  readonly metadata?: Record<string, any>;
}

export class SubscriptionPlanResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty()
  readonly name: string;

  @ApiProperty()
  readonly description?: string;

  @ApiProperty()
  readonly amount: number;

  @ApiProperty()
  readonly currency: string;

  @ApiProperty({ enum: BillingInterval })
  readonly billingInterval: BillingInterval;

  @ApiProperty()
  readonly billingIntervalCount: number;

  @ApiProperty()
  readonly trialPeriodDays?: number;

  @ApiProperty()
  readonly setupFee: number;

  @ApiProperty()
  readonly maxBillingCycles?: number;

  @ApiProperty({ enum: SubscriptionPlanStatus })
  readonly status: SubscriptionPlanStatus;

  @ApiProperty()
  readonly isActive: boolean;

  @ApiProperty()
  readonly metadata?: Record<string, any>;

  @ApiProperty()
  readonly createdAt: Date;

  @ApiProperty()
  readonly updatedAt: Date;
}
