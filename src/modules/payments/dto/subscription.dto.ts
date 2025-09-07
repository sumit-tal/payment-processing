import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { SubscriptionStatus } from '@/database/entities/subscription.entity';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  readonly customerId: string;

  @ApiProperty({ description: 'Subscription plan ID' })
  @IsUUID()
  readonly subscriptionPlanId: string;

  @ApiProperty({ description: 'Payment method ID' })
  @IsUUID()
  readonly paymentMethodId: string;

  @ApiPropertyOptional({ description: 'Start date for the subscription (defaults to now)' })
  @IsOptional()
  @IsDateString()
  readonly startDate?: string;

  @ApiPropertyOptional({ description: 'Trial end date (overrides plan trial period)' })
  @IsOptional()
  @IsDateString()
  readonly trialEnd?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  readonly metadata?: Record<string, any>;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ description: 'New payment method ID' })
  @IsOptional()
  @IsUUID()
  readonly paymentMethodId?: string;

  @ApiPropertyOptional({ 
    description: 'Subscription status',
    enum: SubscriptionStatus
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  readonly status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  readonly metadata?: Record<string, any>;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  readonly cancellationReason?: string;

  @ApiPropertyOptional({ description: 'Whether to cancel immediately or at period end', default: false })
  @IsOptional()
  readonly cancelImmediately?: boolean;
}

export class SubscriptionResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty()
  readonly customerId: string;

  @ApiProperty()
  readonly subscriptionPlanId: string;

  @ApiProperty()
  readonly paymentMethodId: string;

  @ApiProperty()
  readonly gatewaySubscriptionId: string;

  @ApiProperty({ enum: SubscriptionStatus })
  readonly status: SubscriptionStatus;

  @ApiProperty()
  readonly currentPeriodStart: Date;

  @ApiProperty()
  readonly currentPeriodEnd: Date;

  @ApiProperty()
  readonly nextBillingDate: Date;

  @ApiProperty()
  readonly trialStart?: Date;

  @ApiProperty()
  readonly trialEnd?: Date;

  @ApiProperty()
  readonly cancelledAt?: Date;

  @ApiProperty()
  readonly endedAt?: Date;

  @ApiProperty()
  readonly billingCycleCount: number;

  @ApiProperty()
  readonly failedPaymentCount: number;

  @ApiProperty()
  readonly lastPaymentDate?: Date;

  @ApiProperty()
  readonly lastPaymentAmount?: number;

  @ApiProperty()
  readonly metadata?: Record<string, any>;

  @ApiProperty()
  readonly createdAt: Date;

  @ApiProperty()
  readonly updatedAt: Date;

  @ApiProperty()
  readonly subscriptionPlan?: any;

  @ApiProperty()
  readonly paymentMethod?: any;
}
