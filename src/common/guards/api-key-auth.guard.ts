import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiKeyService } from '../../modules/auth/services/api-key.service';
import { AuditLogService } from '../../modules/audit/services/audit-log.service';
import { AuditAction } from '../../modules/audit/entities/audit-log.entity';
import { PERMISSIONS_KEY, SKIP_AUTH_KEY } from '../decorators/auth.decorator';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipAuth = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAuth) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      await this.logSecurityEvent(request, AuditAction.UNAUTHORIZED_ACCESS, 'No API key provided');
      throw new UnauthorizedException('API key is required');
    }

    try {
      const apiKeyEntity = await this.apiKeyService.validateApiKey(apiKey);

      if (!apiKeyEntity) {
        await this.logSecurityEvent(request, AuditAction.UNAUTHORIZED_ACCESS, 'Invalid API key');
        throw new UnauthorizedException('Invalid API key');
      }

      // Check required permissions
      const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasPermission = requiredPermissions.every(permission =>
          apiKeyEntity.permissions.includes(permission) || apiKeyEntity.permissions.includes('*')
        );

        if (!hasPermission) {
          await this.logSecurityEvent(
            request,
            AuditAction.UNAUTHORIZED_ACCESS,
            `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
          );
          throw new ForbiddenException('Insufficient permissions');
        }
      }

      // Attach API key info to request for rate limiting and logging
      (request as any).apiKey = apiKeyEntity;
      (request as any).rateLimitOverride = apiKeyEntity.rateLimit;

      // Log successful API key usage
      await this.auditLogService.logActivity({
        action: AuditAction.API_KEY_USED,
        entityType: 'ApiKey',
        entityId: apiKeyEntity.id,
        userId: apiKeyEntity.clientId,
        ipAddress: this.getClientIp(request),
        userAgent: request.headers['user-agent'],
        metadata: {
          endpoint: `${request.method} ${request.path}`,
          clientName: apiKeyEntity.clientName,
        },
      });

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }

      await this.logSecurityEvent(request, AuditAction.UNAUTHORIZED_ACCESS, `Authentication error: ${error.message}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractApiKey(request: Request): string | null {
    // Check Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    const apiKeyHeader = request.headers['x-api-key'] as string;
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    return null;
  }

  private getClientIp(request: Request): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  private async logSecurityEvent(request: Request, action: AuditAction, message: string): Promise<void> {
    await this.auditLogService.logSecurityEvent(
      action,
      this.getClientIp(request),
      request.headers['user-agent'],
      undefined,
      {
        endpoint: `${request.method} ${request.path}`,
        message,
      }
    );
  }
}
