import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CancelPaymentDto {
  @ApiProperty({ description: 'Transaction ID to cancel/void' })
  @IsString()
  transactionId: string;

  @ApiPropertyOptional({ description: 'Cancellation reason' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ description: 'Idempotency key for duplicate prevention' })
  @IsString()
  idempotencyKey: string;
}
