import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiKeyAuthGuard } from '../api-key-auth.guard';
import { ApiKeyService } from '@/modules/auth/services/api-key.service';
import { AuditLogService } from '@/modules/audit/services/audit-log.service';
import { AuditAction } from '@/database/entities/audit-log.entity';
import {
  PERMISSIONS_KEY,
  SKIP_AUTH_KEY,
} from '@/common/decorators/auth.decorator';

interface MockApiKeyEntity {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly permissions: readonly string[];
  readonly rateLimit: number;
}

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let reflector: jest.Mocked<Reflector>;

  const createExecutionContext = (req: Request): ExecutionContext => {
    const httpArgumentsHost = {
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => undefined,
    } as const;

    return {
      switchToHttp: () => httpArgumentsHost as any,
      getClass: () => class TestClass {} as any,
      getHandler: () => function testHandler() {} as any,
      getType: () => 'http',
      getArgs: () => [],
      getArgByIndex: () => undefined,
    } as unknown as ExecutionContext;
  };

  const buildRequest = (
    headers: Record<string, string>,
    extras?: Partial<Request>,
  ): Request => {
    const base: Partial<Request> = {
      headers: headers as any,
      method: 'GET',
      path: '/v1/payments',
      ip: '127.0.0.1',
      connection: { remoteAddress: '10.0.0.1' } as any,
      ...extras,
    };
    return base as Request;
  };

  const mockApiKeyEntity = (
    overrides?: Partial<MockApiKeyEntity>,
  ): MockApiKeyEntity => ({
    id: 'key_123',
    clientId: 'client_abc',
    clientName: 'Test Client',
    permissions: ['payments:read'],
    rateLimit: 1000,
    ...overrides,
  });

  beforeEach(() => {
    apiKeyService = {
      validateApiKey: jest.fn(),
    } as unknown as jest.Mocked<ApiKeyService>;

    auditLogService = {
      logActivity: jest.fn().mockResolvedValue(undefined),
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogService>;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new ApiKeyAuthGuard(apiKeyService, auditLogService, reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When SKIP_AUTH is true, should allow request without validating API key', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === SKIP_AUTH_KEY) return true as any;
      if (key === PERMISSIONS_KEY) return undefined as any;
      return undefined as any;
    });
    const req = buildRequest({});
    const ctx = createExecutionContext(req);

    // Act
    const result = await guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
    expect(apiKeyService.validateApiKey).not.toHaveBeenCalled();
    expect(auditLogService.logActivity).not.toHaveBeenCalled();
  });

  it('When API key is missing, should log and throw UnauthorizedException', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === SKIP_AUTH_KEY) return false as any;
      if (key === PERMISSIONS_KEY) return undefined as any;
      return undefined as any;
    });
    const req = buildRequest({});
    const ctx = createExecutionContext(req);

    // Act + Assert
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(auditLogService.logSecurityEvent).toHaveBeenCalledWith(
      AuditAction.UNAUTHORIZED_ACCESS,
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({
        endpoint: `${req.method} ${req.path}`,
        message: 'No API key provided',
      }),
    );
  });

  it('When API key is invalid, should log and throw UnauthorizedException', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === SKIP_AUTH_KEY) return false as any;
      if (key === PERMISSIONS_KEY) return undefined as any;
      return undefined as any;
    });
    const req = buildRequest({ authorization: 'Bearer invalid' });
    const ctx = createExecutionContext(req);
    apiKeyService.validateApiKey.mockResolvedValue(null as any);

    // Act + Assert
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(apiKeyService.validateApiKey).toHaveBeenCalledWith('invalid');
    expect(auditLogService.logSecurityEvent).toHaveBeenCalledWith(
      AuditAction.UNAUTHORIZED_ACCESS,
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({ message: 'Invalid API key' }),
    );
  });

  it('When valid API key and no permissions required, should allow and log activity', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === SKIP_AUTH_KEY) return false as any;
      if (key === PERMISSIONS_KEY) return undefined as any;
      return undefined as any;
    });
    const req = buildRequest({ 'x-api-key': 'pk_live_abc' });
    const ctx = createExecutionContext(req);
    const entity = mockApiKeyEntity();
    apiKeyService.validateApiKey.mockResolvedValue(entity as any);

    // Act
    const result = await guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
    expect((req as any).apiKey).toEqual(entity);
    expect((req as any).rateLimitOverride).toBe(entity.rateLimit);
    expect(auditLogService.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.API_KEY_USED,
        entityType: 'ApiKey',
        entityId: entity.id,
        userId: entity.clientId,
        metadata: expect.objectContaining({
          endpoint: `${req.method} ${req.path}`,
        }),
      }),
    );
  });

  it('When required permissions are satisfied, should allow', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === SKIP_AUTH_KEY) return false as any;
      if (key === PERMISSIONS_KEY) return ['payments:read'] as any;
      return undefined as any;
    });
    const req = buildRequest({ authorization: 'Bearer token_ok' });
    const ctx = createExecutionContext(req);
    const entity = mockApiKeyEntity({
      permissions: ['payments:read', 'payments:write'],
    });
    apiKeyService.validateApiKey.mockResolvedValue(entity as any);

    // Act
    const result = await guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
    expect(auditLogService.logActivity).toHaveBeenCalled();
  });

  it('When wildcard permission is present, should allow', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === SKIP_AUTH_KEY) return false as any;
      if (key === PERMISSIONS_KEY) return ['payments:write'] as any;
      return undefined as any;
    });
    const req = buildRequest({ 'x-api-key': 'token_ok' });
    const ctx = createExecutionContext(req);
    const entity = mockApiKeyEntity({ permissions: ['*'] });
    apiKeyService.validateApiKey.mockResolvedValue(entity as any);

    // Act
    const result = await guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
  });

  it('When required permissions are not satisfied, should log and throw ForbiddenException', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === SKIP_AUTH_KEY) return false as any;
      if (key === PERMISSIONS_KEY) return ['payments:write'] as any;
      return undefined as any;
    });
    const req = buildRequest({ 'x-api-key': 'token_ok' });
    const ctx = createExecutionContext(req);
    const entity = mockApiKeyEntity({ permissions: ['payments:read'] });
    apiKeyService.validateApiKey.mockResolvedValue(entity as any);

    // Act + Assert
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(auditLogService.logSecurityEvent).toHaveBeenCalledWith(
      AuditAction.UNAUTHORIZED_ACCESS,
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining('Insufficient permissions'),
      }),
    );
  });

  it('When internal error occurs, should log and throw generic UnauthorizedException', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === SKIP_AUTH_KEY) return false as any;
      if (key === PERMISSIONS_KEY) return undefined as any;
      return undefined as any;
    });
    const req = buildRequest(
      { authorization: 'Bearer token_ok' },
      {
        headers: {
          authorization: 'Bearer token_ok',
          'user-agent': 'jest',
        } as any,
      },
    );
    const ctx = createExecutionContext(req);
    apiKeyService.validateApiKey.mockRejectedValue(new Error('db down'));

    // Act + Assert
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(auditLogService.logSecurityEvent).toHaveBeenCalledWith(
      AuditAction.UNAUTHORIZED_ACCESS,
      expect.any(String),
      'jest',
      undefined,
      expect.objectContaining({
        message: expect.stringContaining('Authentication error:'),
      }),
    );
  });

  it('When Authorization and X-API-Key provided, should prioritize Authorization Bearer', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === SKIP_AUTH_KEY) return false as any;
      if (key === PERMISSIONS_KEY) return undefined as any;
      return undefined as any;
    });
    const headers = {
      authorization: 'Bearer from-auth',
      'x-api-key': 'from-header',
    };
    const req = buildRequest(headers);
    const ctx = createExecutionContext(req);
    apiKeyService.validateApiKey.mockResolvedValue(mockApiKeyEntity() as any);

    // Act
    await guard.canActivate(ctx);

    // Assert
    expect(apiKeyService.validateApiKey).toHaveBeenCalledWith('from-auth');
  });
});
