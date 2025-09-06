import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum, Min } from 'class-validator';
import { AuditAction } from '../entities/audit-log.entity';

export class CreateAuditLogDto {
  @IsEnum(AuditAction)
  readonly action: AuditAction;

  @IsOptional()
  @IsString()
  readonly entityType?: string;

  @IsOptional()
  @IsString()
  readonly entityId?: string;

  @IsOptional()
  @IsString()
  readonly userId?: string;

  @IsOptional()
  @IsString()
  readonly ipAddress?: string;

  @IsOptional()
  @IsString()
  readonly userAgent?: string;

  @IsOptional()
  @IsString()
  readonly requestId?: string;

  @IsOptional()
  readonly metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  readonly success?: boolean;

  @IsOptional()
  @IsString()
  readonly errorMessage?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  readonly durationMs?: number;
}
