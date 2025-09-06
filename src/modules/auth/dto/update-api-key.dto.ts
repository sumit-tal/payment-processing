import { IsString, IsOptional, IsArray, IsNumber, IsDateString, IsBoolean, Min, Max, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateApiKeyDto {
  @ApiProperty({
    description: 'Human-readable name for the client',
    example: 'Updated E-commerce Store API',
    maxLength: 255,
    required: false
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  readonly clientName?: string;

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
    example: 2000,
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
    description: 'Whether the API key is active',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;

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
}
