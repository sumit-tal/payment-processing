import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus } from '@/database/entities';

export class PaymentResponseDto {
  @ApiProperty({ description: 'Unique transaction identifier', format: 'uuid' })
  readonly transactionId: string;

  @ApiProperty({ description: 'Transaction status', enum: TransactionStatus })
  readonly status: TransactionStatus;

  @ApiProperty({ description: 'Transaction amount', example: 99.99 })
  readonly amount: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  readonly currency: string;

  @ApiPropertyOptional({ description: 'Gateway transaction ID' })
  readonly gatewayTransactionId?: string;

  @ApiPropertyOptional({ description: 'Authorization code from gateway' })
  readonly authCode?: string;

  @ApiPropertyOptional({ description: 'Response message from gateway' })
  readonly responseText?: string;

  @ApiProperty({ description: 'Transaction creation timestamp' })
  readonly createdAt: Date;
}
