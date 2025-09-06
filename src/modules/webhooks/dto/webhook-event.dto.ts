import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookEventType, WebhookEventStatus } from '../entities/webhook-event.entity';

export class CreateWebhookEventDto {
  @ApiProperty({
    description: 'Type of the webhook event',
    enum: WebhookEventType,
    example: WebhookEventType.PAYMENT_AUTHORIZED,
  })
  @IsEnum(WebhookEventType)
  @IsNotEmpty()
  readonly eventType: WebhookEventType;

  @ApiProperty({
    description: 'External ID from the payment gateway',
    example: '12345678',
  })
  @IsString()
  @IsNotEmpty()
  readonly externalId: string;

  @ApiProperty({
    description: 'Event payload data',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsNotEmpty()
  readonly payload: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Webhook signature for verification',
    example: 'sha256=abc123...',
  })
  @IsString()
  @IsOptional()
  readonly signature?: string;
}

export class WebhookEventResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the webhook event',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  readonly id: string;

  @ApiProperty({
    description: 'Type of the webhook event',
    enum: WebhookEventType,
  })
  readonly eventType: WebhookEventType;

  @ApiProperty({
    description: 'External ID from the payment gateway',
  })
  readonly externalId: string;

  @ApiProperty({
    description: 'Current status of the webhook event',
    enum: WebhookEventStatus,
  })
  readonly status: WebhookEventStatus;

  @ApiProperty({
    description: 'Number of processing attempts',
  })
  readonly retryCount: number;

  @ApiProperty({
    description: 'Maximum number of retry attempts allowed',
  })
  readonly maxRetries: number;

  @ApiPropertyOptional({
    description: 'Timestamp when the event was processed',
  })
  readonly processedAt?: Date;

  @ApiPropertyOptional({
    description: 'Error message if processing failed',
  })
  readonly errorMessage?: string;

  @ApiProperty({
    description: 'Timestamp when the event was created',
  })
  readonly createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the event was last updated',
  })
  readonly updatedAt: Date;
}

export class AuthorizeNetWebhookDto {
  @ApiProperty({
    description: 'Notification ID from Authorize.Net',
    example: '12345678-1234-1234-1234-123456789012',
  })
  @IsString()
  @IsNotEmpty()
  readonly notificationId: string;

  @ApiProperty({
    description: 'Event type from Authorize.Net',
    example: 'net.authorize.payment.authcapture.created',
  })
  @IsString()
  @IsNotEmpty()
  readonly eventType: string;

  @ApiProperty({
    description: 'Event date from Authorize.Net',
    example: '2023-09-06T14:30:00Z',
  })
  @IsString()
  @IsNotEmpty()
  readonly eventDate: string;

  @ApiProperty({
    description: 'Webhook ID from Authorize.Net',
    example: 'webhook123',
  })
  @IsString()
  @IsNotEmpty()
  readonly webhookId: string;

  @ApiProperty({
    description: 'Payload containing transaction or subscription data',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsNotEmpty()
  readonly payload: Record<string, any>;
}

export class ProcessWebhookEventDto {
  @ApiProperty({
    description: 'ID of the webhook event to process',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly eventId: string;
}

export class RetryWebhookEventDto {
  @ApiProperty({
    description: 'ID of the webhook event to retry',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly eventId: string;

  @ApiPropertyOptional({
    description: 'Force retry even if max retries exceeded',
    default: false,
  })
  @IsOptional()
  readonly forceRetry?: boolean;
}

export class WebhookEventQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by event type',
    enum: WebhookEventType,
  })
  @IsEnum(WebhookEventType)
  @IsOptional()
  readonly eventType?: WebhookEventType;

  @ApiPropertyOptional({
    description: 'Filter by event status',
    enum: WebhookEventStatus,
  })
  @IsEnum(WebhookEventStatus)
  @IsOptional()
  readonly status?: WebhookEventStatus;

  @ApiPropertyOptional({
    description: 'Filter by external ID',
  })
  @IsString()
  @IsOptional()
  readonly externalId?: string;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
  })
  @IsOptional()
  readonly limit?: number;

  @ApiPropertyOptional({
    description: 'Page offset',
    default: 0,
  })
  @IsOptional()
  readonly offset?: number;
}
