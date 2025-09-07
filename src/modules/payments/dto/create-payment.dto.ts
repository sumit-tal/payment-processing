import { IsString, IsNumber, IsOptional, IsUUID, IsEnum, ValidateNested, Min, Max, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodType } from '@/database/entities';

export class BillingAddressDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  company?: string;

  @ApiProperty({ description: 'Street address' })
  @IsString()
  @Length(1, 100)
  address: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @Length(1, 50)
  city: string;

  @ApiProperty({ description: 'State or province' })
  @IsString()
  @Length(2, 50)
  state: string;

  @ApiProperty({ description: 'ZIP or postal code' })
  @IsString()
  @Length(3, 10)
  zip: string;

  @ApiProperty({ description: 'Country code (ISO 3166-1 alpha-2)' })
  @IsString()
  @Length(2, 2)
  country: string;
}

export class CreditCardDto {
  @ApiProperty({ description: 'Credit card number' })
  @IsString()
  @Length(13, 19)
  cardNumber: string;

  @ApiProperty({ description: 'Expiration month (MM)' })
  @IsNumber()
  @Min(1)
  @Max(12)
  expiryMonth: number;

  @ApiProperty({ description: 'Expiration year (YYYY)' })
  @IsNumber()
  @Min(new Date().getFullYear())
  @Max(new Date().getFullYear() + 20)
  expiryYear: number;

  @ApiProperty({ description: 'CVV/CVC code' })
  @IsString()
  @Length(3, 4)
  cvv: string;

  @ApiProperty({ description: 'Cardholder name' })
  @IsString()
  @Length(1, 100)
  cardholderName: string;

  @ApiProperty({ description: 'Billing address', type: BillingAddressDto })
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress: BillingAddressDto;
}

export class CreatePaymentDto {
  @ApiProperty({ description: 'Payment amount', example: 99.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)', example: 'USD' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ description: 'Payment method type', enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  paymentMethod: PaymentMethodType;

  @ApiProperty({ description: 'Credit card details', type: CreditCardDto })
  @ValidateNested()
  @Type(() => CreditCardDto)
  creditCard: CreditCardDto;

  @ApiPropertyOptional({ description: 'Customer ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Order ID' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  orderId?: string;

  @ApiPropertyOptional({ description: 'Payment description' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  description?: string;

  @ApiProperty({ description: 'Idempotency key for duplicate prevention' })
  @IsString()
  @Length(1, 255)
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}
