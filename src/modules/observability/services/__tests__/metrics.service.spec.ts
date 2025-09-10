import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../metrics.service';
import { register } from 'prom-client';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    // Clear metrics before each test
    register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    register.clear();
  });

  describe('When recording HTTP request metrics', () => {
    it('Then should increment request counter and record duration', () => {
      service.recordHttpRequest('POST', '/api/payments', 200, 0.5, 'api-key-123');

      const metrics = register.getSingleMetric('http_requests_total');
      expect(metrics).toBeDefined();
    });

    it('Then should handle requests without API key', () => {
      service.recordHttpRequest('GET', '/health', 200, 0.1);

      const metrics = register.getSingleMetric('http_requests_total');
      expect(metrics).toBeDefined();
    });
  });

  describe('When recording payment transaction metrics', () => {
    it('Then should record payment metrics with all labels', () => {
      service.recordPaymentTransaction(
        'purchase',
        'completed',
        'authorize_net',
        'USD',
        100.50,
        2.3
      );

      const transactionMetrics = register.getSingleMetric('payment_transactions_total');
      const durationMetrics = register.getSingleMetric('payment_transaction_duration_seconds');
      const amountMetrics = register.getSingleMetric('payment_transaction_amount');

      expect(transactionMetrics).toBeDefined();
      expect(durationMetrics).toBeDefined();
      expect(amountMetrics).toBeDefined();
    });
  });

  describe('When recording security events', () => {
    it('Then should increment security event counter', () => {
      service.recordSecurityEvent('unauthorized_access', 'high', 'api');

      const metrics = register.getSingleMetric('security_events_total');
      expect(metrics).toBeDefined();
    });

    it('Then should record rate limit hits', () => {
      service.recordRateLimitHit('api-key-123', '/api/payments');

      const metrics = register.getSingleMetric('rate_limit_hits_total');
      expect(metrics).toBeDefined();
    });

    it('Then should record authentication attempts', () => {
      service.recordAuthenticationAttempt('api_key', 'success');

      const metrics = register.getSingleMetric('authentication_attempts_total');
      expect(metrics).toBeDefined();
    });
  });

  describe('When managing system metrics', () => {
    it('Then should set active connections gauge', () => {
      service.setActiveConnections('http', 10);

      const metrics = register.getSingleMetric('active_connections');
      expect(metrics).toBeDefined();
    });

    it('Then should set queue size gauge', () => {
      service.setQueueSize('webhook_processing', 5);

      const metrics = register.getSingleMetric('queue_size');
      expect(metrics).toBeDefined();
    });

    it('Then should record errors', () => {
      service.recordError('payment', 'ValidationError');

      const metrics = register.getSingleMetric('errors_total');
      expect(metrics).toBeDefined();
    });
  });

  describe('When recording database metrics', () => {
    it('Then should set database connections', () => {
      service.setDatabaseConnections(15);

      const metrics = register.getSingleMetric('database_connections_active');
      expect(metrics).toBeDefined();
    });

    it('Then should record database query duration', () => {
      service.recordDatabaseQuery('SELECT', 'transactions', 0.05);

      const metrics = register.getSingleMetric('database_query_duration_seconds');
      expect(metrics).toBeDefined();
    });
  });

  describe('When recording webhook metrics', () => {
    it('Then should record webhook events', () => {
      service.recordWebhookEvent('payment_completed', 'success', 'authorize_net', 1.2);

      const eventMetrics = register.getSingleMetric('webhook_events_total');
      const durationMetrics = register.getSingleMetric('webhook_processing_duration_seconds');

      expect(eventMetrics).toBeDefined();
      expect(durationMetrics).toBeDefined();
    });

    it('Then should record webhook events without duration', () => {
      service.recordWebhookEvent('payment_failed', 'error', 'authorize_net');

      const metrics = register.getSingleMetric('webhook_events_total');
      expect(metrics).toBeDefined();
    });
  });

  describe('When getting metrics', () => {
    it('Then should return metrics in Prometheus format', async () => {
      service.recordHttpRequest('GET', '/metrics', 200, 0.1);
      
      const metricsOutput = await service.getMetrics();
      
      expect(typeof metricsOutput).toBe('string');
      expect(metricsOutput).toContain('http_requests_total');
    });

    it('Then should return registry', () => {
      const registry = service.getRegistry();
      expect(registry).toBe(register);
    });
  });

  describe('When clearing metrics', () => {
    it('Then should clear all metrics', () => {
      service.recordHttpRequest('GET', '/test', 200, 0.1);
      
      service.clearMetrics();
      
      const metrics = register.getMetricsAsArray();
      expect(metrics).toHaveLength(0);
    });
  });
});
