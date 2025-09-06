import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register, collectDefaultMetrics } from 'prom-client';

export interface MetricLabels {
  [key: string]: string | number;
}

/**
 * Prometheus metrics service for system performance monitoring
 */
@Injectable()
export class MetricsService {
  // HTTP request metrics
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  
  // Payment metrics
  private readonly paymentTransactionsTotal: Counter<string>;
  private readonly paymentTransactionDuration: Histogram<string>;
  private readonly paymentTransactionAmount: Histogram<string>;
  
  // Security metrics
  private readonly securityEventsTotal: Counter<string>;
  private readonly rateLimitHitsTotal: Counter<string>;
  private readonly authenticationAttemptsTotal: Counter<string>;
  
  // System metrics
  private readonly activeConnections: Gauge<string>;
  private readonly queueSize: Gauge<string>;
  private readonly errorRate: Counter<string>;
  
  // Database metrics
  private readonly databaseConnectionsActive: Gauge<string>;
  private readonly databaseQueryDuration: Histogram<string>;
  
  // Webhook metrics
  private readonly webhookEventsTotal: Counter<string>;
  private readonly webhookProcessingDuration: Histogram<string>;

  constructor() {
    // Enable default metrics collection
    collectDefaultMetrics({ register });

    // HTTP request metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'api_key_id'],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    // Payment metrics
    this.paymentTransactionsTotal = new Counter({
      name: 'payment_transactions_total',
      help: 'Total number of payment transactions',
      labelNames: ['type', 'status', 'gateway', 'currency'],
    });

    this.paymentTransactionDuration = new Histogram({
      name: 'payment_transaction_duration_seconds',
      help: 'Payment transaction processing duration in seconds',
      labelNames: ['type', 'gateway'],
      buckets: [0.5, 1, 2, 5, 10, 30],
    });

    this.paymentTransactionAmount = new Histogram({
      name: 'payment_transaction_amount',
      help: 'Payment transaction amounts',
      labelNames: ['currency', 'type'],
      buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000],
    });

    // Security metrics
    this.securityEventsTotal = new Counter({
      name: 'security_events_total',
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity', 'source'],
    });

    this.rateLimitHitsTotal = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['api_key_id', 'endpoint'],
    });

    this.authenticationAttemptsTotal = new Counter({
      name: 'authentication_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['type', 'status'],
    });

    // System metrics
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
    });

    this.queueSize = new Gauge({
      name: 'queue_size',
      help: 'Current queue size',
      labelNames: ['queue_name'],
    });

    this.errorRate = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['component', 'error_type'],
    });

    // Database metrics
    this.databaseConnectionsActive = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
    });

    this.databaseQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    // Webhook metrics
    this.webhookEventsTotal = new Counter({
      name: 'webhook_events_total',
      help: 'Total number of webhook events',
      labelNames: ['event_type', 'status', 'source'],
    });

    this.webhookProcessingDuration = new Histogram({
      name: 'webhook_processing_duration_seconds',
      help: 'Webhook processing duration in seconds',
      labelNames: ['event_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    });

    // Register all metrics
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.paymentTransactionsTotal);
    register.registerMetric(this.paymentTransactionDuration);
    register.registerMetric(this.paymentTransactionAmount);
    register.registerMetric(this.securityEventsTotal);
    register.registerMetric(this.rateLimitHitsTotal);
    register.registerMetric(this.authenticationAttemptsTotal);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.queueSize);
    register.registerMetric(this.errorRate);
    register.registerMetric(this.databaseConnectionsActive);
    register.registerMetric(this.databaseQueryDuration);
    register.registerMetric(this.webhookEventsTotal);
    register.registerMetric(this.webhookProcessingDuration);
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    apiKeyId?: string
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      api_key_id: apiKeyId || 'anonymous',
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
  }

  /**
   * Record payment transaction metrics
   */
  recordPaymentTransaction(
    type: string,
    status: string,
    gateway: string,
    currency: string,
    amount: number,
    duration: number
  ): void {
    this.paymentTransactionsTotal.inc({ type, status, gateway, currency });
    this.paymentTransactionDuration.observe({ type, gateway }, duration);
    this.paymentTransactionAmount.observe({ currency, type }, amount);
  }

  /**
   * Record security event metrics
   */
  recordSecurityEvent(eventType: string, severity: string, source: string): void {
    this.securityEventsTotal.inc({ event_type: eventType, severity, source });
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(apiKeyId: string, endpoint: string): void {
    this.rateLimitHitsTotal.inc({ api_key_id: apiKeyId, endpoint });
  }

  /**
   * Record authentication attempt
   */
  recordAuthenticationAttempt(type: string, status: string): void {
    this.authenticationAttemptsTotal.inc({ type, status });
  }

  /**
   * Set active connections gauge
   */
  setActiveConnections(type: string, count: number): void {
    this.activeConnections.set({ type }, count);
  }

  /**
   * Set queue size gauge
   */
  setQueueSize(queueName: string, size: number): void {
    this.queueSize.set({ queue_name: queueName }, size);
  }

  /**
   * Record error
   */
  recordError(component: string, errorType: string): void {
    this.errorRate.inc({ component, error_type: errorType });
  }

  /**
   * Set database connections gauge
   */
  setDatabaseConnections(count: number): void {
    this.databaseConnectionsActive.set(count);
  }

  /**
   * Record database query duration
   */
  recordDatabaseQuery(operation: string, table: string, duration: number): void {
    this.databaseQueryDuration.observe({ operation, table }, duration);
  }

  /**
   * Record webhook event
   */
  recordWebhookEvent(eventType: string, status: string, source: string, duration?: number): void {
    this.webhookEventsTotal.inc({ event_type: eventType, status, source });
    
    if (duration !== undefined) {
      this.webhookProcessingDuration.observe({ event_type: eventType }, duration);
    }
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Get metrics registry
   */
  getRegistry() {
    return register;
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    register.clear();
  }
}
