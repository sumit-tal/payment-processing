import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { LoggingInterceptor } from '../logging.interceptor';
import { LoggingService } from '../../services/logging.service';
import { TracingService } from '../../services/tracing.service';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let loggingService: LoggingService;
  let tracingService: TracingService;

  const mockRequest = {
    method: 'GET',
    url: '/test',
    route: { path: '/test' },
    user: { id: 'user-123' },
    apiKey: { id: 'api-key-123' },
  };

  const mockResponse = {
    statusCode: 200,
  };

  const mockContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue(mockResponse),
    }),
  } as unknown as ExecutionContext;

  const mockCallHandler: CallHandler = {
    handle: jest.fn(),
  };

  const mockSpan = {
    traceId: 'trace-123',
    spanId: 'span-123',
  };

  const mockRequestContext = {
    correlationId: 'correlation-123',
    userId: 'user-123',
    apiKeyId: 'api-key-123',
    method: 'GET',
    url: '/test',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2025, 0, 1));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingInterceptor,
        {
          provide: LoggingService,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            getRequestContext: jest.fn().mockReturnValue(mockRequestContext),
          },
        },
        {
          provide: TracingService,
          useValue: {
            getCorrelationId: jest.fn().mockReturnValue('correlation-123'),
            startSpan: jest.fn().mockReturnValue(mockSpan),
            setSpanTags: jest.fn(),
            finishSpan: jest.fn(),
            logToSpan: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
    loggingService = module.get<LoggingService>(LoggingService);
    tracingService = module.get<TracingService>(TracingService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('When handling a successful request', () => {
    beforeEach(() => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));
    });

    it('Then should log incoming request and successful response', () => {
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe();

      // Assert
      expect(tracingService.getCorrelationId).toHaveBeenCalledWith(mockRequest);
      expect(tracingService.startSpan).toHaveBeenCalledWith(
        'GET /test',
        'correlation-123',
      );
      expect(tracingService.setSpanTags).toHaveBeenCalledWith(mockSpan.spanId, {
        'http.method': 'GET',
        'http.url': '/test',
        'http.route': '/test',
        'user.id': 'user-123',
        'api_key.id': 'api-key-123',
      });
      expect(loggingService.getRequestContext).toHaveBeenCalledWith(mockRequest);
      expect(loggingService.info).toHaveBeenCalledWith(
        'Incoming GET /test',
        expect.objectContaining({
          component: 'http',
          operation: 'request',
        }),
      );
      expect(loggingService.info).toHaveBeenCalledWith(
        'Completed GET /test - 200',
        expect.objectContaining({
          component: 'http',
          operation: 'response',
          statusCode: 200,
          duration: expect.any(Number),
          responseSize: expect.any(Number),
        }),
      );
      expect(tracingService.finishSpan).toHaveBeenCalledWith(mockSpan.spanId);
    });

    it('Then should calculate response size correctly', () => {
      // Arrange
      const responseData = { data: 'test', nested: { value: 123 } };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(responseData));
      
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe();
      
      // Assert
      expect(tracingService.setSpanTags).toHaveBeenCalledWith(
        mockSpan.spanId,
        expect.objectContaining({
          'response.size': JSON.stringify(responseData).length,
        }),
      );
      expect(loggingService.info).toHaveBeenCalledWith(
        'Completed GET /test - 200',
        expect.objectContaining({
          responseSize: JSON.stringify(responseData).length,
        }),
      );
    });

    it('Then should handle empty response data', () => {
      // Arrange
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(null));
      
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe();
      
      // Assert
      expect(tracingService.setSpanTags).toHaveBeenCalledWith(
        mockSpan.spanId,
        expect.objectContaining({
          'response.size': 2, // "{}" length
        }),
      );
    });
  });

  describe('When handling a failed request', () => {
    const mockError = new Error('Test error');
    mockError['status'] = 400;

    beforeEach(() => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(throwError(() => mockError));
    });

    it('Then should log error and finish span', (done) => {
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          done.fail('Expected error but got success');
        },
        error: (err) => {
          // Assert
          expect(err).toBe(mockError);
          expect(loggingService.error).toHaveBeenCalledWith(
            'Failed GET /test - 400',
            mockError,
            expect.objectContaining({
              component: 'http',
              operation: 'error',
              statusCode: 400,
              duration: expect.any(Number),
            }),
          );

          expect(tracingService.setSpanTags).toHaveBeenCalledWith(mockSpan.spanId, {
            'error': true,
            'error.name': 'Error',
            'error.message': 'Test error',
            'http.status_code': 400,
          });

          expect(tracingService.logToSpan).toHaveBeenCalledWith(
            mockSpan.spanId,
            'error',
            'Test error',
            { stack: mockError.stack },
          );

          expect(tracingService.finishSpan).toHaveBeenCalledWith(mockSpan.spanId);
          done();
        }
      });
    });

    it('Then should use default 500 status code when error has no status', (done) => {
      // Arrange
      const errorWithoutStatus = new Error('Internal error');
      (mockCallHandler.handle as jest.Mock).mockReturnValue(throwError(() => errorWithoutStatus));
      
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          done.fail('Expected error but got success');
        },
        error: (err) => {
          // Assert
          expect(err).toBe(errorWithoutStatus);
          expect(loggingService.error).toHaveBeenCalledWith(
            'Failed GET /test - 500',
            errorWithoutStatus,
            expect.objectContaining({
              statusCode: 500,
            }),
          );

          expect(tracingService.setSpanTags).toHaveBeenCalledWith(
            mockSpan.spanId,
            expect.objectContaining({
              'http.status_code': 500,
            }),
          );
          done();
        }
      });
    });
  });

  describe('When handling edge cases', () => {
    it('Then should handle requests without route path', () => {
      // Arrange
      const requestWithoutRoute = {
        ...mockRequest,
        route: undefined,
      };
      
      const contextWithoutRoute = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithoutRoute),
          getResponse: jest.fn().mockReturnValue(mockResponse),
        }),
      } as unknown as ExecutionContext;
      
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));
      
      // Act
      interceptor.intercept(contextWithoutRoute, mockCallHandler).subscribe();
      
      // Assert
      expect(tracingService.startSpan).toHaveBeenCalledWith(
        'GET /test',
        'correlation-123',
      );
    });

    it('Then should handle requests without user or API key', () => {
      // Arrange
      const requestWithoutAuth = {
        ...mockRequest,
        user: undefined,
        apiKey: undefined,
      };
      
      const contextWithoutAuth = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithoutAuth),
          getResponse: jest.fn().mockReturnValue(mockResponse),
        }),
      } as unknown as ExecutionContext;
      
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));
      
      // Act
      interceptor.intercept(contextWithoutAuth, mockCallHandler).subscribe();
      
      // Assert
      expect(tracingService.setSpanTags).toHaveBeenCalledWith(mockSpan.spanId, {
        'http.method': 'GET',
        'http.url': '/test',
        'http.route': '/test',
        'user.id': undefined,
        'api_key.id': undefined,
      });
    });
  });
});
