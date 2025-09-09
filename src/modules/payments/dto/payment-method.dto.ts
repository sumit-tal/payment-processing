import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  ValidateNested,
  Length,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BillingAddressDto {
  @ApiProperty({ description: 'First name', required: false })
  @IsOptional()
  @IsString()
  readonly firstName?: string;

  @ApiProperty({ description: 'Last name', required: false })
  @IsOptional()
  @IsString()
  readonly lastName?: string;

  @ApiProperty({ description: 'Company name', required: false })
  @IsOptional()
  @IsString()
  readonly company?: string;

  @ApiProperty({ description: 'Street address', required: false })
  @IsOptional()
  @IsString()
  readonly address?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  readonly city?: string;

  @ApiProperty({ description: 'State/Province', required: false })
  @IsOptional()
  @IsString()
  readonly state?: string;

  @ApiProperty({ description: 'Postal/ZIP code', required: false })
  @IsOptional()
  @IsString()
  readonly zip?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsOptional()
  @IsString()
  readonly country?: string;
}

export class CreatePaymentMethodDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  @IsNotEmpty()
  readonly customerId: string;

  @ApiProperty({ description: 'Credit card number' })
  @IsString()
  @IsNotEmpty()
  readonly cardNumber: string;

  @ApiProperty({ description: 'Card security code (CVV/CVC)' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 4)
  readonly cardCode: string;

  @ApiProperty({ description: 'Card expiration month (1-12)' })
  @IsNumber()
  @Min(1)
  @Max(12)
  readonly expiryMonth: number;

  @ApiProperty({ description: 'Card expiration year (4-digit)' })
  @IsNumber()
  @Min(2000)
  readonly expiryYear: number;

  @ApiProperty({ description: 'Cardholder name' })
  @IsString()
  @IsNotEmpty()
  readonly cardholderName: string;

  @ApiProperty({ description: 'Billing address', required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  readonly billingAddress?: BillingAddressDto;

  @ApiProperty({ description: 'Set as default payment method', default: false })
  @IsOptional()
  @IsBoolean()
  readonly isDefault?: boolean;
}

export class UpdatePaymentMethodDto {
  @ApiProperty({ description: 'Set as default payment method', required: true })
  @IsBoolean()
  readonly isDefault: boolean;
}

export class PaymentMethodResponseDto {
  @ApiProperty({ description: 'Payment method ID' })
  readonly id: string;

  @ApiProperty({ description: 'Customer ID' })
  readonly customerId: string;

  @ApiProperty({ description: 'Last 4 digits of card' })
  readonly cardLastFour: string;

  @ApiProperty({ description: 'Card brand (Visa, Mastercard, etc.)' })
  readonly cardBrand: string;

  @ApiProperty({ description: 'Card expiration month' })
  readonly cardExpiryMonth: number;

  @ApiProperty({ description: 'Card expiration year' })
  readonly cardExpiryYear: number;

  @ApiProperty({ description: 'Billing address' })
  readonly billingAddress?: BillingAddressDto;

  @ApiProperty({ description: 'Is default payment method' })
  readonly isDefault: boolean;

  @ApiProperty({ description: 'Is active payment method' })
  readonly isActive: boolean;

  @ApiProperty({ description: 'Created date' })
  readonly createdAt: Date;
}
