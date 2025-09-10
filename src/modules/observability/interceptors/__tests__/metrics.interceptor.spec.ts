import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { MetricsInterceptor } from '../metrics.interceptor';
import { MetricsService } from '../../services/metrics.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let metricsService: MetricsService;

  const mockRequest = {
    method: 'GET',
    url: '/test',
    route: { path: '/test' },
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

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2025, 0, 1));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsInterceptor,
        {
          provide: MetricsService,
          useValue: {
            recordHttpRequest: jest.fn(),
            recordError: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<MetricsInterceptor>(MetricsInterceptor);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('When handling a successful request', () => {
    beforeEach(() => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));
    });

    it('Then should record HTTP request metrics with correct parameters', () => {
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe();

      // Assert
      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/test',
        200,
        expect.any(Number),
        'api-key-123',
      );
    });

    it('Then should calculate duration in seconds', () => {
      // Arrange
      const startTime = Date.now();
      
      // Mock Date.now to simulate elapsed time
      const originalDateNow = Date.now;
      Date.now = jest.fn().mockReturnValueOnce(startTime).mockReturnValueOnce(startTime + 1500);
      
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe();
      
      // Assert
      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/test',
        200,
        1.5,
        'api-key-123',
      );
      
      // Restore original Date.now
      Date.now = originalDateNow;
    });

    it('Then should use route path when available', () => {
      // Arrange
      const requestWithCustomRoute = {
        ...mockRequest,
        route: { path: '/custom-route' },
      };
      
      const contextWithCustomRoute = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithCustomRoute),
          getResponse: jest.fn().mockReturnValue(mockResponse),
        }),
      } as unknown as ExecutionContext;
      
      // Act
      interceptor.intercept(contextWithCustomRoute, mockCallHandler).subscribe();
      
      // Assert
      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/custom-route',
        200,
        expect.any(Number),
        'api-key-123',
      );
    });
  });

  describe('When handling a failed request', () => {
    const mockError = new Error('Test error');
    mockError['status'] = 400;

    beforeEach(() => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(throwError(() => mockError));
    });

    it('Then should record HTTP request metrics with error status code', (done) => {
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          done.fail('Expected error but got success');
        },
        error: (err) => {
          // Assert
          expect(err).toBe(mockError);
          expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
            'GET',
            '/test',
            400,
            expect.any(Number),
            'api-key-123',
          );
          done();
        }
      });
    });

    it('Then should record error metric', (done) => {
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          done.fail('Expected error but got success');
        },
        error: (err) => {
          // Assert
          expect(err).toBe(mockError);
          expect(metricsService.recordError).toHaveBeenCalledWith(
            'http',
            'Error',
          );
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
          expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
            'GET',
            '/test',
            500,
            expect.any(Number),
            'api-key-123',
          );
          done();
        }
      });
    });

    it('Then should record unknown error type when error has no name', (done) => {
      // Arrange
      const errorWithoutName = new Error();
      Object.defineProperty(errorWithoutName, 'name', { value: undefined });
      (mockCallHandler.handle as jest.Mock).mockReturnValue(throwError(() => errorWithoutName));
      
      // Act
      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          done.fail('Expected error but got success');
        },
        error: (err) => {
          // Assert
          expect(err).toBe(errorWithoutName);
          expect(metricsService.recordError).toHaveBeenCalledWith(
            'http',
            'UnknownError',
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
      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/test',
        200,
        expect.any(Number),
        'api-key-123',
      );
    });

    it('Then should handle requests without API key', () => {
      // Arrange
      const requestWithoutApiKey = {
        ...mockRequest,
        apiKey: undefined,
      };
      
      const contextWithoutApiKey = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithoutApiKey),
          getResponse: jest.fn().mockReturnValue(mockResponse),
        }),
      } as unknown as ExecutionContext;
      
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));
      
      // Act
      interceptor.intercept(contextWithoutApiKey, mockCallHandler).subscribe();
      
      // Assert
      expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
        'GET',
        '/test',
        200,
        expect.any(Number),
        undefined,
      );
    });
  });
});
