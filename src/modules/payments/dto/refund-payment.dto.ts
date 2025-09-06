import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiProperty({ description: 'Transaction ID to refund' })
  @IsString()
  transactionId: string;

  @ApiPropertyOptional({ description: 'Amount to refund (if partial refund)', example: 25.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ description: 'Refund reason' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ description: 'Idempotency key for duplicate prevention' })
  @IsString()
  idempotencyKey: string;
}
