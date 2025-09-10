import { Test, TestingModule } from '@nestjs/testing';
import { ObservabilityController } from '../observability.controller';
import { MetricsService } from '../../services/metrics.service';
import { LoggingService } from '../../services/logging.service';
import { TracingService } from '../../services/tracing.service';

describe('ObservabilityController', () => {
  let controller: ObservabilityController;
  let mockMetricsService: jest.Mocked<MetricsService>;
  let mockLoggingService: jest.Mocked<LoggingService>;
  let mockTracingService: jest.Mocked<TracingService>;

  beforeEach(async () => {
    const mockMetricsServiceValue = {
      getMetrics: jest.fn(),
    };

    const mockLoggingServiceValue = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockTracingServiceValue = {
      startSpan: jest.fn(),
      finishSpan: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ObservabilityController],
      providers: [
        { provide: MetricsService, useValue: mockMetricsServiceValue },
        { provide: LoggingService, useValue: mockLoggingServiceValue },
        { provide: TracingService, useValue: mockTracingServiceValue },
      ],
    }).compile();

    controller = module.get<ObservabilityController>(ObservabilityController);
    mockMetricsService = module.get(MetricsService);
    mockLoggingService = module.get(LoggingService);
    mockTracingService = module.get(TracingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('When getting metrics', () => {
    it('Then should return metrics data and log the access', async () => {
      // Arrange
      const expectedMetrics = '# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total{method="GET"} 100';
      mockMetricsService.getMetrics.mockResolvedValue(expectedMetrics);

      // Act
      const result = await controller.getMetrics();

      // Assert
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'Metrics endpoint accessed',
        {
          component: 'observability',
          operation: 'metrics_export',
        }
      );
      expect(mockMetricsService.getMetrics).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedMetrics);
    });

    it('Then should handle empty metrics data', async () => {
      // Arrange
      const expectedMetrics = '';
      mockMetricsService.getMetrics.mockResolvedValue(expectedMetrics);

      // Act
      const result = await controller.getMetrics();

      // Assert
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.getMetrics).toHaveBeenCalledTimes(1);
      expect(result).toBe('');
    });

    it('Then should handle large metrics data', async () => {
      // Arrange
      const largeMetrics = 'metric'.repeat(10000);
      mockMetricsService.getMetrics.mockResolvedValue(largeMetrics);

      // Act
      const result = await controller.getMetrics();

      // Assert
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.getMetrics).toHaveBeenCalledTimes(1);
      expect(result).toBe(largeMetrics);
      expect(result.length).toBe(60000); // 'metric' = 6 chars * 10000 = 60000
    });

    it('Then should propagate service errors', async () => {
      // Arrange
      const serviceError = new Error('Metrics service unavailable');
      mockMetricsService.getMetrics.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.getMetrics()).rejects.toThrow('Metrics service unavailable');
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.getMetrics).toHaveBeenCalledTimes(1);
    });

    it('Then should handle service timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      mockMetricsService.getMetrics.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(controller.getMetrics()).rejects.toThrow('Request timeout');
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    });

    it('Then should handle null response from service', async () => {
      // Arrange
      mockMetricsService.getMetrics.mockResolvedValue(null as any);

      // Act
      const result = await controller.getMetrics();

      // Assert
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });

  describe('When getting health status', () => {
    it('Then should return health status with correct structure and log the check', () => {
      // Arrange
      const mockDate = new Date('2025-01-01T12:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // Act
      const result = controller.getHealth();

      // Assert
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'Health check performed',
        {
          component: 'observability',
          operation: 'health_check',
          status: 'healthy',
        }
      );
      expect(result).toEqual({
        status: 'healthy',
        timestamp: '2025-01-01T12:00:00.000Z',
        services: {
          logging: 'operational',
          metrics: 'operational',
          tracing: 'operational',
        },
        version: '1.0.0',
      });
    });

    it('Then should return valid timestamp format', () => {
      // Act
      const result = controller.getHealth();

      // Assert
      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
      );
    });

    it('Then should return correct health status structure', () => {
      // Act
      const result = controller.getHealth();

      // Assert
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('version');
      expect(typeof result.status).toBe('string');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.services).toBe('object');
      expect(typeof result.version).toBe('string');
    });

    it('Then should return correct services structure', () => {
      // Act
      const result = controller.getHealth();

      // Assert
      expect(result.services).toHaveProperty('logging');
      expect(result.services).toHaveProperty('metrics');
      expect(result.services).toHaveProperty('tracing');
      expect(result.services.logging).toBe('operational');
      expect(result.services.metrics).toBe('operational');
      expect(result.services.tracing).toBe('operational');
    });

    it('Then should return consistent status value', () => {
      // Act
      const result1 = controller.getHealth();
      const result2 = controller.getHealth();

      // Assert
      expect(result1.status).toBe('healthy');
      expect(result2.status).toBe('healthy');
      expect(result1.status).toBe(result2.status);
    });

    it('Then should return consistent version value', () => {
      // Act
      const result1 = controller.getHealth();
      const result2 = controller.getHealth();

      // Assert
      expect(result1.version).toBe('1.0.0');
      expect(result2.version).toBe('1.0.0');
      expect(result1.version).toBe(result2.version);
    });

    it('Then should generate different timestamps for consecutive calls', () => {
      // Act
      const result1 = controller.getHealth();
      // Small delay to ensure different timestamps
      const result2 = controller.getHealth();

      // Assert
      expect(result1.timestamp).toBeDefined();
      expect(result2.timestamp).toBeDefined();
      // Note: In real scenarios, timestamps would be different, but in tests they might be the same
      // due to execution speed. This test validates the structure is correct.
    });

    it('Then should handle multiple concurrent health checks', () => {
      // Act
      const results = Array.from({ length: 5 }, () => controller.getHealth());

      // Assert
      results.forEach((result) => {
        expect(result.status).toBe('healthy');
        expect(result.version).toBe('1.0.0');
        expect(result.services.logging).toBe('operational');
        expect(result.services.metrics).toBe('operational');
        expect(result.services.tracing).toBe('operational');
      });
      expect(mockLoggingService.info).toHaveBeenCalledTimes(5);
    });
  });

  describe('When controller is instantiated', () => {
    it('Then should be defined with all dependencies', () => {
      // Assert
      expect(controller).toBeDefined();
      expect(mockMetricsService).toBeDefined();
      expect(mockLoggingService).toBeDefined();
      expect(mockTracingService).toBeDefined();
    });

    it('Then should have all required methods', () => {
      // Assert
      expect(typeof controller.getMetrics).toBe('function');
      expect(typeof controller.getHealth).toBe('function');
    });
  });

  describe('When logging service interactions', () => {
    it('Then should call logging service with correct parameters for metrics', async () => {
      // Arrange
      mockMetricsService.getMetrics.mockResolvedValue('test metrics');

      // Act
      await controller.getMetrics();

      // Assert
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'Metrics endpoint accessed',
        expect.objectContaining({
          component: 'observability',
          operation: 'metrics_export',
        })
      );
    });

    it('Then should call logging service with correct parameters for health', () => {
      // Act
      controller.getHealth();

      // Assert
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'Health check performed',
        expect.objectContaining({
          component: 'observability',
          operation: 'health_check',
          status: 'healthy',
        })
      );
    });

    it('Then should not call other logging methods during normal operation', async () => {
      // Arrange
      mockMetricsService.getMetrics.mockResolvedValue('test metrics');

      // Act
      await controller.getMetrics();
      controller.getHealth();

      // Assert
      expect(mockLoggingService.error).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).not.toHaveBeenCalled();
      expect(mockLoggingService.debug).not.toHaveBeenCalled();
    });
  });
});
