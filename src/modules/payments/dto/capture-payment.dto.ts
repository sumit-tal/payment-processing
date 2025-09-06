import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CapturePaymentDto {
  @ApiProperty({ description: 'Transaction ID to capture' })
  @IsString()
  transactionId: string;

  @ApiPropertyOptional({ description: 'Amount to capture (if partial capture)', example: 50.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ description: 'Capture description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Idempotency key for duplicate prevention' })
  @IsString()
  idempotencyKey: string;
}
