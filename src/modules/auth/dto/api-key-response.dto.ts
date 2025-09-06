import { ApiProperty } from '@nestjs/swagger';

export class ApiKeyResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the API key',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  readonly id: string;

  @ApiProperty({
    description: 'Unique identifier for the client',
    example: 'client-001'
  })
  readonly clientId: string;

  @ApiProperty({
    description: 'Human-readable name for the client',
    example: 'E-commerce Store API'
  })
  readonly clientName: string;

  @ApiProperty({
    description: 'API key prefix for identification',
    example: 'pk_live_'
  })
  readonly keyPrefix: string;

  @ApiProperty({
    description: 'Whether the API key is active',
    example: true
  })
  readonly isActive: boolean;

  @ApiProperty({
    description: 'Array of permissions granted to this API key',
    example: ['payments:read', 'payments:write']
  })
  readonly permissions: string[];

  @ApiProperty({
    description: 'Rate limit for requests per hour',
    example: 1000
  })
  readonly rateLimit: number;

  @ApiProperty({
    description: 'Last time the API key was used',
    example: '2024-01-15T10:30:00.000Z',
    nullable: true
  })
  readonly lastUsedAt: Date | null;

  @ApiProperty({
    description: 'Expiration date for the API key',
    example: '2024-12-31T23:59:59.000Z',
    nullable: true
  })
  readonly expiresAt: Date | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z'
  })
  readonly createdAt: Date;

  @ApiProperty({
    description: 'User who created this API key',
    example: 'admin@company.com'
  })
  readonly createdBy: string;

  @ApiProperty({
    description: 'Additional metadata',
    example: { department: 'engineering' }
  })
  readonly metadata: Record<string, any>;
}

export class CreateApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({
    description: 'The actual API key (only shown once during creation)',
    example: 'pk_live_1234567890abcdef1234567890abcdef'
  })
  readonly apiKey: string;
}
