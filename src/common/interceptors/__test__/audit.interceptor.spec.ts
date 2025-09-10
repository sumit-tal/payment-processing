import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { of, throwError, Observable } from 'rxjs';
import { AuditInterceptor } from '../audit.interceptor';
import { AuditLogService } from '@/modules/audit/services/audit-log.service';
import { AuditAction } from '@/database/entities/audit-log.entity';

interface MockApiKey {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
}

interface HttpArgumentsHostMock {
  readonly getRequest: () => Request;
  readonly getResponse: () => unknown;
  readonly getNext: () => unknown;
}

const createExecutionContext = (req: Request): ExecutionContext => {
  const httpHost: HttpArgumentsHostMock = {
    getRequest: () => req,
    getResponse: () => ({}),
    getNext: () => undefined,
  };

  return {
    switchToHttp: () => httpHost as any,
    getClass: () => class TestClass {} as any,
    getHandler: () => function testHandler() {} as any,
    getType: () => 'http',
    getArgs: () => [],
    getArgByIndex: () => undefined,
  } as unknown as ExecutionContext;
};

const buildRequest = (
  method: string,
  path: string,
  options?: Partial<Request> & { apiKey?: MockApiKey },
): Request => {
  const base: Partial<Request> = {
    headers: { 'user-agent': 'jest', ...(options?.headers as any) } as any,
    method,
    path,
    body: options?.body ?? {},
    ip: options?.ip ?? '127.0.0.1',
    connection:
      (options?.connection as any) ?? ({ remoteAddress: '10.0.0.1' } as any),
    ...(options ?? {}),
  };
  if (options?.apiKey) {
    (base as any).apiKey = options.apiKey;
  }
  return base as Request;
};

const mockCallHandler = <T>(source$: Observable<T>): CallHandler<T> => ({
  handle: () => source$,
});

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(() => {
    auditLogService = {
      logActivity: jest.fn().mockResolvedValue(undefined),
      logSecurityEvent: jest.fn(), // not used by interceptor but exists on service in repo
    } as unknown as jest.Mocked<AuditLogService>;

    interceptor = new AuditInterceptor(auditLogService);
    jest.spyOn(global.console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('When route does not match any action, should pass through without logging', done => {
    // Arrange
    const req = buildRequest('GET', '/v1/health');
    const ctx = createExecutionContext(req);
    const next = mockCallHandler(of('ok'));

    // Act
    interceptor.intercept(ctx, next).subscribe({
      next: (val: unknown) => {
        // Assert
        expect(val).toBe('ok');
        expect(auditLogService.logActivity).not.toHaveBeenCalled();
        done();
      },
      error: done,
    });
  });

  it('When payment purchase succeeds, should log success with redacted sensitive fields and correct metadata', done => {
    // Arrange
    const apiKey: MockApiKey = {
      id: 'key_1',
      clientId: 'client_1',
      clientName: 'Client One',
    };

    // Mock time to control duration
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1_000); // start
    nowSpy.mockReturnValueOnce(1_250); // end

    const req = buildRequest('POST', '/v1/payments/purchase', {
      apiKey,
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'jest ua',
      } as any,
      body: {
        amount: 1000,
        currency: 'USD',
        cardNumber: '4111111111111111',
        cvv: '123',
        expiryMonth: '12',
        expiryYear: '2030',
        customerEmail: 'a@b.com',
      },
    });
    const ctx = createExecutionContext(req);
    const next = mockCallHandler(of({ status: 'ok' }));

    // Act
    interceptor.intercept(ctx, next).subscribe({
      next: () => {
        // Assert
        expect(auditLogService.logActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.PAYMENT_INITIATED,
            entityType: 'Transaction',
            userId: apiKey.clientId,
            ipAddress: '203.0.113.10',
            userAgent: 'jest ua',
            success: true,
            durationMs: 250,
            metadata: expect.objectContaining({
              endpoint: 'POST /v1/payments/purchase',
              clientName: apiKey.clientName,
              requestBody: expect.objectContaining({
                amount: 1000,
                currency: 'USD',
                cardNumber: '[REDACTED]',
                cvv: '[REDACTED]',
                expiryMonth: '[REDACTED]',
                expiryYear: '[REDACTED]',
                customerEmail: 'a@b.com',
              }),
            }),
          }),
        );
        done();
      },
      error: done,
    });
  });

  it('When handler throws error, should log failure with error message', done => {
    // Arrange
    const apiKey: MockApiKey = {
      id: 'key_2',
      clientId: 'client_2',
      clientName: 'Client Two',
    };
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(2_000); // start
    nowSpy.mockReturnValueOnce(2_100); // end

    const req = buildRequest('POST', '/v1/payments/refund', { apiKey });
    const ctx = createExecutionContext(req);
    const next = mockCallHandler(throwError(() => new Error('boom')));

    // Act
    interceptor.intercept(ctx, next).subscribe({
      next: () => {
        done(new Error('Expected error path'));
      },
      error: (err: unknown) => {
        // Assert
        expect((err as Error).message).toBe('boom');
        expect(auditLogService.logActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.PAYMENT_REFUNDED,
            success: false,
            errorMessage: 'boom',
            durationMs: 100,
          }),
        );
        done();
      },
    });
  });

  it('When audit logging fails, should not break the response flow', done => {
    // Arrange
    auditLogService.logActivity.mockRejectedValueOnce(new Error('db down'));

    const req = buildRequest('POST', '/v1/webhooks/provider-1');
    const ctx = createExecutionContext(req);
    const next = mockCallHandler(of('ok'));

    // Act
    interceptor.intercept(ctx, next).subscribe({
      next: (val: unknown) => {
        // Assert: response still succeeds
        expect(val).toBe('ok');
        // It was attempted even though it failed internally
        expect(auditLogService.logActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.WEBHOOK_RECEIVED,
            success: true,
          }),
        );
        done();
      },
      error: done,
    });
  });

  it('When subscription cancel, should map to SUBSCRIPTION_CANCELLED; when update, map to SUBSCRIPTION_UPDATED', done => {
    // Arrange
    const cancelReq = buildRequest('POST', '/v1/subscriptions/cancel');
    const cancelCtx = createExecutionContext(cancelReq);
    const updateReq = buildRequest('PUT', '/v1/subscriptions/abc');
    const updateCtx = createExecutionContext(updateReq);
    const next = mockCallHandler(of('ok'));

    // Act + Assert (cancel)
    interceptor.intercept(cancelCtx, next).subscribe({
      next: () => {
        expect(auditLogService.logActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.SUBSCRIPTION_CANCELLED,
            entityType: 'Subscription',
          }),
        );

        // Act + Assert (update)
        interceptor.intercept(updateCtx, next).subscribe({
          next: () => {
            expect(auditLogService.logActivity).toHaveBeenCalledWith(
              expect.objectContaining({
                action: AuditAction.SUBSCRIPTION_UPDATED,
                entityType: 'Subscription',
              }),
            );
            done();
          },
          error: done,
        });
      },
      error: done,
    });
  });

  it('When X-Forwarded-For missing, should fallback to X-Real-IP then connection.remoteAddress then req.ip then "unknown"', done => {
    // Arrange: case 1 - x-real-ip present
    const req1 = buildRequest('POST', '/v1/payments/capture', {
      headers: { 'x-real-ip': '198.51.100.7' } as any,
    });
    const ctx1 = createExecutionContext(req1);

    // case 2 - connection.remoteAddress
    const req2 = buildRequest('POST', '/v1/payments/capture', {
      headers: {} as any,
      connection: { remoteAddress: '10.0.0.99' } as any,
    });
    const ctx2 = createExecutionContext(req2);

    // case 3 - req.ip
    const req3 = buildRequest('POST', '/v1/payments/capture', {
      headers: {} as any,
      connection: {} as any,
      ip: '172.16.0.5',
    });
    const ctx3 = createExecutionContext(req3);

    // case 4 - unknown
    const req4 = buildRequest('POST', '/v1/payments/capture', {
      headers: {} as any,
      connection: {} as any,
      ip: undefined as unknown as string,
    });
    const ctx4 = createExecutionContext(req4);

    const next = mockCallHandler(of('ok'));

    // Act
    interceptor.intercept(ctx1, next).subscribe({
      next: () => {
        expect(auditLogService.logActivity).toHaveBeenCalledWith(
          expect.objectContaining({ ipAddress: '198.51.100.7' }),
        );
        interceptor.intercept(ctx2, next).subscribe({
          next: () => {
            expect(auditLogService.logActivity).toHaveBeenCalledWith(
              expect.objectContaining({ ipAddress: '10.0.0.99' }),
            );
            interceptor.intercept(ctx3, next).subscribe({
              next: () => {
                expect(auditLogService.logActivity).toHaveBeenCalledWith(
                  expect.objectContaining({ ipAddress: '172.16.0.5' }),
                );
                interceptor.intercept(ctx4, next).subscribe({
                  next: () => {
                    expect(auditLogService.logActivity).toHaveBeenCalledWith(
                      expect.objectContaining({ ipAddress: 'unknown' }),
                    );
                    done();
                  },
                  error: done,
                });
              },
              error: done,
            });
          },
          error: done,
        });
      },
      error: done,
    });
  });
});
