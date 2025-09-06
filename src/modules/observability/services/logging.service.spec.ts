import { Test, TestingModule } from '@nestjs/testing';
import { LoggingService, LogContext } from './logging.service';
import { Request } from 'express';

describe('LoggingService', () => {
  let service: LoggingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingService],
    }).compile();

    service = module.get<LoggingService>(LoggingService);
  });

  describe('When logging messages', () => {
    it('Then should log info messages with context', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        userId: 'user-123',
        component: 'test',
      };

      const logSpy = jest.spyOn(service['logger'], 'log');

      service.info('Test message', context);

      expect(logSpy).toHaveBeenCalledWith(
        'info',
        expect.objectContaining({
          message: 'Test message',
          correlationId: 'test-correlation-id',
          userId: 'user-123',
          component: 'test',
        }),
      );
    });

    it('Then should log error messages with error details', () => {
      const error = new Error('Test error');
      const context: LogContext = { correlationId: 'test-id' };

      const logSpy = jest.spyOn(service['logger'], 'log');

      service.error('Error occurred', error, context);

      expect(logSpy).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Error occurred',
          correlationId: 'test-id',
          error: {
            name: 'Error',
            message: 'Test error',
            stack: expect.any(String),
          },
        }),
      );
    });
  });

  describe('When logging payment operations', () => {
    it('Then should log payment operations with proper context', () => {
      const logSpy = jest.spyOn(service, 'info');

      service.logPaymentOperation(
        'purchase',
        'txn-123',
        100.0,
        'USD',
        'completed',
        { correlationId: 'test-id' },
      );

      expect(logSpy).toHaveBeenCalledWith(
        'Payment purchase completed',
        expect.objectContaining({
          operation: 'purchase',
          component: 'payment',
          transactionId: 'txn-123',
          amount: 100.0,
          currency: 'USD',
          status: 'completed',
        }),
      );
    });
  });

  describe('When logging security events', () => {
    it('Then should log security events with proper severity', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logSecurityEvent(
        'unauthorized_access',
        'high',
        { endpoint: '/api/payments' },
        { correlationId: 'test-id' },
      );

      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'Security event: unauthorized_access',
        expect.objectContaining({
          component: 'security',
          event: 'unauthorized_access',
          severity: 'high',
        }),
      );
    });
  });

  describe('When masking sensitive data', () => {
    it('Then should mask credit card numbers', () => {
      const sensitiveData = {
        cardNumber: '4111111111111111',
        cvv: '123',
        normalField: 'normal-value',
      };

      const masked = service['maskSensitiveData'](sensitiveData);

      expect(masked.cardNumber).toBe('41**********11');
      expect(masked.cvv).toBe('[MASKED]');
      expect(masked.normalField).toBe('normal-value');
    });

    it('Then should mask nested sensitive data', () => {
      const nestedData = {
        payment: {
          cardNumber: '4111111111111111',
          amount: 100,
        },
        user: {
          name: 'John Doe',
          ssn: '123456789',
        },
      };

      const masked = service['maskSensitiveData'](nestedData);

      expect(masked.payment.cardNumber).toBe('41**********11');
      expect(masked.payment.amount).toBe(100);
      expect(masked.user.name).toBe('John Doe');
      expect(masked.user.ssn).toBe('12*****89');
    });
  });

  describe('When extracting request context', () => {
    it('Then should extract context from request object', () => {
      const mockRequest = {
        correlationId: 'test-correlation-id',
        user: { id: 'user-123' },
        apiKey: { id: 'api-key-456' },
        method: 'POST',
        url: '/api/payments',
        get: jest.fn().mockReturnValue('test-user-agent'),
        ip: '127.0.0.1',
      } as unknown as Request;

      const context = service.getRequestContext(mockRequest);

      expect(context).toEqual({
        correlationId: 'test-correlation-id',
        userId: 'user-123',
        apiKeyId: 'api-key-456',
        method: 'POST',
        url: '/api/payments',
        userAgent: 'test-user-agent',
        ip: '127.0.0.1',
      });
    });
  });
});
