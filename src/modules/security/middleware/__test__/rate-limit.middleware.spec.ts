import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitMiddleware } from '../rate-limit.middleware';
import Redis from 'ioredis';
import { Request, Response } from 'express';

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockRedis: jest.Mocked<Redis>;
  let mockRequest: Partial<Request> & { rateLimitOverride?: number };
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockRedis = {
      pipeline: jest.fn(),
    } as any;

    mockRequest = {
      headers: {},
      connection: { remoteAddress: '127.0.0.1' } as any,
    };
    Object.defineProperty(mockRequest, 'ip', {
      value: '127.0.0.1',
      configurable: true,
    });

    mockResponse = {};
    mockNext = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitMiddleware,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    middleware = module.get<RateLimitMiddleware>(RateLimitMiddleware);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('When initializing middleware', () => {
    it('Then should set default values from config', () => {
      // Arrange
      mockConfigService.get.mockImplementation((key, defaultValue) => {
        if (key === 'RATE_LIMIT_LIMIT') return 100;
        if (key === 'RATE_LIMIT_TTL') return 60;
        return defaultValue;
      });

      // Act
      const newMiddleware = new RateLimitMiddleware(
        mockConfigService,
        mockRedis,
      );

      // Assert
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'RATE_LIMIT_LIMIT',
        100,
      );
      expect(mockConfigService.get).toHaveBeenCalledWith('RATE_LIMIT_TTL', 60);
    });
  });

  describe('When processing a request with Redis available', () => {
    it('Then should allow request when under rate limit', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key, defaultValue) => {
        if (key === 'RATE_LIMIT_LIMIT') return 100;
        if (key === 'RATE_LIMIT_TTL') return 60;
        return defaultValue;
      });

      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 50], // incr result
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRedis.pipeline).toHaveBeenCalledTimes(1);
      expect(mockPipeline.incr).toHaveBeenCalledTimes(1);
      expect(mockPipeline.expire).toHaveBeenCalledTimes(1);
    });

    it('Then should block request when over rate limit', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key, defaultValue) => {
        if (key === 'RATE_LIMIT_LIMIT') return 100;
        if (key === 'RATE_LIMIT_TTL') return 60;
        return defaultValue;
      });

      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 101], // incr result - over the limit
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      // Create a new instance with our mocks for this test
      const testMiddleware = new RateLimitMiddleware(mockConfigService, mockRedis);

      // Act & Assert
      await expect(async () => {
        await testMiddleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      }).rejects.toThrow(HttpException);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRedis.pipeline).toHaveBeenCalledTimes(1);
      expect(mockPipeline.incr).toHaveBeenCalledTimes(1);
    });

    it('Then should use API key as identifier when available', async () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer test-api-key',
      };

      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1], // incr result
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockPipeline.incr).toHaveBeenCalledWith(
        'rate_limit:api_key:test-api-key',
      );
    });

    it('Then should use x-api-key header when available', async () => {
      // Arrange
      mockRequest.headers = {
        'x-api-key': 'test-api-key-header',
      };

      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1], // incr result
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockPipeline.incr).toHaveBeenCalledWith(
        'rate_limit:api_key:test-api-key-header',
      );
    });

    it('Then should use IP address as identifier when no API key is available', async () => {
      // Arrange
      mockRequest.headers = {};
      Object.defineProperty(mockRequest, 'ip', {
        value: '192.168.1.1',
        configurable: true,
      });

      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1], // incr result
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockPipeline.incr).toHaveBeenCalledWith(
        'rate_limit:ip:192.168.1.1',
      );
    });
  });

  describe('When Redis is not available', () => {
    it('Then should allow request to proceed', async () => {
      // Arrange
      const moduleWithoutRedis: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimitMiddleware,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const middlewareWithoutRedis =
        moduleWithoutRedis.get<RateLimitMiddleware>(RateLimitMiddleware);

      // Act
      await middlewareWithoutRedis.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('Then should allow request when Redis throws an error', async () => {
      // Arrange
      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis connection error')),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('When handling custom rate limits', () => {
    it('Then should use custom rate limit when provided', async () => {
      // Arrange
      const customLimit = 200;
      mockRequest = {
        headers: {},
        connection: { remoteAddress: '127.0.0.1' } as any,
        rateLimitOverride: customLimit,
      };
      Object.defineProperty(mockRequest, 'ip', {
        value: '127.0.0.1',
        configurable: true,
      });

      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 150], // incr result - under custom limit
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      // Act
      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('Then should block request when over custom rate limit', async () => {
      // Arrange
      const customLimit = 50;
      mockRequest = {
        headers: {},
        connection: { remoteAddress: '127.0.0.1' } as any,
        rateLimitOverride: customLimit,
      };
      Object.defineProperty(mockRequest, 'ip', {
        value: '127.0.0.1',
        configurable: true,
      });

      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 51], // incr result - over custom limit
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      // Create a new instance with our mocks for this test
      const testMiddleware = new RateLimitMiddleware(mockConfigService, mockRedis);

      // Act & Assert
      await expect(async () => {
        await testMiddleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      }).rejects.toThrow(HttpException);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('When handling rate limit errors', () => {
    it('Then should return correct HTTP exception with retry information', async () => {
      // Arrange
      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 101], // incr result - over limit
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      // Mock Date.now to return a fixed timestamp
      const originalDateNow = Date.now;
      const mockNow = 1600000000000; // Fixed timestamp
      global.Date.now = jest.fn(() => mockNow);

      // Create a test HttpException to throw
      const testError = new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter: 60,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );

      // Create a new middleware instance that will throw our test error
      const testMiddleware = new RateLimitMiddleware(mockConfigService, mockRedis);
      jest.spyOn(testMiddleware as any, 'checkRateLimit').mockImplementation(() => {
        return Promise.resolve({
          count: 101,
          resetTime: mockNow + 60000,
          limit: 100
        });
      });

      // Act & Assert
      try {
        await testMiddleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        fail('Expected HttpException to be thrown');
      } catch (error) {
        // Assert
        expect(error instanceof HttpException).toBe(true);
        if (error instanceof HttpException) {
          expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
          const response = error.getResponse() as any;
          expect(response).toHaveProperty('message', 'Rate limit exceeded');
          expect(response).toHaveProperty('retryAfter');
        }
      } finally {
        // Restore original Date.now
        global.Date.now = originalDateNow;
      }
    });
  });
});
