import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, IsDateString, Min, Max, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Unique identifier for the client',
    example: 'client-001',
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  readonly clientId: string;

  @ApiProperty({
    description: 'Human-readable name for the client',
    example: 'E-commerce Store API',
    maxLength: 255
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  readonly clientName: string;

  @ApiProperty({
    description: 'Array of permissions granted to this API key',
    example: ['payments:read', 'payments:write', 'subscriptions:read'],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly permissions?: string[];

  @ApiProperty({
    description: 'Rate limit for requests per hour',
    example: 1000,
    minimum: 1,
    maximum: 10000,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  readonly rateLimit?: number;

  @ApiProperty({
    description: 'Expiration date for the API key (ISO string)',
    example: '2024-12-31T23:59:59.000Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  readonly expiresAt?: string;

  @ApiProperty({
    description: 'Additional metadata for the API key',
    example: { department: 'engineering', project: 'checkout' },
    required: false
  })
  @IsOptional()
  readonly metadata?: Record<string, any>;

  @ApiProperty({
    description: 'User who is creating this API key',
    example: 'admin@company.com',
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  readonly createdBy: string;
}
