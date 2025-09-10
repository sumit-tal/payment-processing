# Observability Strategy

Enterprise-grade observability implementation for the Payment Processing System, providing comprehensive monitoring, metrics collection, distributed tracing, and structured logging capabilities.

## Table of Contents

- [Overview](#overview)
- [Metrics Strategy](#metrics-strategy)
- [Distributed Tracing](#distributed-tracing)
- [Logging Strategy](#logging-strategy)
- [Monitoring Dashboards](#monitoring-dashboards)
- [Alerting Strategy](#alerting-strategy)
- [Performance Monitoring](#performance-monitoring)
- [Security Monitoring](#security-monitoring)
- [Implementation Guidelines](#implementation-guidelines)

## Overview

The observability stack is designed to provide complete visibility into the payment processing system's health, performance, and security posture. It follows the three pillars of observability:

- **Metrics**: Quantitative measurements of system behavior
- **Traces**: Request flow tracking across distributed components
- **Logs**: Structured event records with contextual information

### Key Principles

- **Correlation IDs**: Every request generates a unique correlation ID for end-to-end tracing
- **PCI Compliance**: Sensitive payment data is masked or excluded from logs and metrics
- **Real-time Monitoring**: Sub-second metric collection and alerting capabilities
- **Structured Data**: All logs and metrics use consistent, queryable formats
- **Performance Impact**: Minimal overhead on payment processing operations

## Metrics Strategy

### Business Metrics

#### Payment Processing Metrics

```typescript
// Core payment metrics
payment_transactions_total{gateway, type, status, currency}
payment_transaction_amount_total{gateway, currency}
payment_processing_duration_seconds{gateway, type}
payment_success_rate{gateway, type}
payment_failure_rate{gateway, type, error_code}

// Authorization metrics
payment_authorization_duration_seconds{gateway}
payment_authorization_success_rate{gateway}
payment_authorization_decline_rate{gateway, reason}

// Capture metrics
payment_capture_duration_seconds{gateway}
payment_capture_success_rate{gateway}
payment_capture_delay_seconds{gateway}

// Refund metrics
payment_refund_duration_seconds{gateway, type}
payment_refund_success_rate{gateway, type}
payment_refund_amount_total{gateway, currency}
```

#### Subscription Metrics

```typescript
// Subscription lifecycle
subscription_created_total{plan_type, billing_cycle}
subscription_cancelled_total{plan_type, reason}
subscription_renewed_total{plan_type, billing_cycle}
subscription_failed_renewals_total{plan_type, reason}

// Subscription revenue
subscription_mrr_total{plan_type, currency}
subscription_churn_rate{plan_type, period}
subscription_ltv_total{plan_type, currency}

// Billing metrics
subscription_billing_attempts_total{plan_type, status}
subscription_billing_retry_count{plan_type}
subscription_dunning_events_total{plan_type, stage}
```

#### Webhook Processing Metrics

```typescript
// Webhook delivery
webhook_events_received_total{source, event_type}
webhook_events_processed_total{source, event_type, status}
webhook_processing_duration_seconds{source, event_type}
webhook_retry_attempts_total{source, event_type}
webhook_dlq_messages_total{source, event_type}

// Queue metrics
sqs_messages_visible{queue_name}
sqs_messages_in_flight{queue_name}
sqs_message_age_seconds{queue_name}
sqs_processing_rate{queue_name}
```

### Technical Metrics

#### Application Performance

```typescript
// HTTP metrics
http_requests_total{method, endpoint, status_code}
http_request_duration_seconds{method, endpoint}
http_request_size_bytes{method, endpoint}
http_response_size_bytes{method, endpoint}

// Database metrics
db_connections_active{pool_name}
db_connections_idle{pool_name}
db_query_duration_seconds{operation, table}
db_query_errors_total{operation, table, error_type}
db_transaction_duration_seconds{operation}

// Cache metrics
redis_commands_total{command, status}
redis_command_duration_seconds{command}
redis_memory_usage_bytes
redis_keyspace_hits_total
redis_keyspace_misses_total
```

#### Infrastructure Metrics

```typescript
// System metrics
process_cpu_usage_percent
process_memory_usage_bytes
process_open_file_descriptors
process_uptime_seconds

// Node.js specific
nodejs_heap_size_total_bytes
nodejs_heap_size_used_bytes
nodejs_external_memory_bytes
nodejs_gc_duration_seconds{gc_type}
nodejs_eventloop_lag_seconds
```

#### Security Metrics

```typescript
// Authentication & Authorization
api_key_validations_total{status, client_id}
api_key_validation_duration_seconds
rate_limit_exceeded_total{endpoint, client_id}
authentication_failures_total{reason, endpoint}

// Security events
security_events_total{event_type, severity}
pci_compliance_violations_total{rule, severity}
audit_log_entries_total{action, entity_type}
suspicious_activity_detected_total{type, severity}
```

### Custom Business Metrics

#### Revenue & Financial

```typescript
// Revenue tracking
daily_revenue_total{currency, gateway}
monthly_revenue_total{currency, gateway}
average_transaction_value{currency, gateway, period}
revenue_per_customer{currency, period}

// Financial reconciliation
settlement_amount_total{gateway, currency, date}
fee_amount_total{gateway, fee_type, currency}
chargeback_amount_total{gateway, currency, reason}
```

#### Operational Efficiency

```typescript
// Processing efficiency
payment_processing_throughput{gateway}
system_capacity_utilization_percent
error_resolution_time_seconds{error_type}
sla_compliance_rate{service, metric}

// Customer experience
customer_checkout_abandonment_rate
payment_retry_success_rate{attempt_number}
customer_support_tickets_total{category, priority}
```

## Distributed Tracing

### Tracing Architecture

The system implements OpenTelemetry-compatible distributed tracing with the following components:

#### Trace Context Propagation

```typescript
interface TraceContext {
  traceId: string; // Unique trace identifier
  spanId: string; // Current span identifier
  parentSpanId?: string; // Parent span identifier
  correlationId: string; // Business correlation ID
  userId?: string; // User identifier (if available)
  sessionId?: string; // Session identifier
  requestId: string; // Request identifier
}
```

#### Span Hierarchy

```
Payment Request Trace
├── HTTP Request Span
│   ├── Authentication Span
│   ├── Rate Limiting Span
│   └── Request Validation Span
├── Payment Processing Span
│   ├── Gateway API Call Span
│   ├── Database Transaction Span
│   └── Audit Logging Span
├── Webhook Processing Span (async)
│   ├── SQS Message Span
│   ├── Event Processing Span
│   └── Notification Span
└── Response Generation Span
```

### Trace Sampling Strategy

#### Production Sampling Rules

```typescript
const samplingRules = {
  // Always trace errors and high-value transactions
  errorTraces: { sampleRate: 1.0 },
  highValueTransactions: {
    sampleRate: 1.0,
    condition: 'amount > 1000',
  },

  // Sample regular transactions
  regularTransactions: { sampleRate: 0.1 },

  // Reduced sampling for health checks
  healthChecks: { sampleRate: 0.01 },

  // Custom sampling for debugging
  debugMode: {
    sampleRate: 1.0,
    condition: 'headers.x-debug-trace = true',
  },
};
```

### Trace Attributes

#### Standard Attributes

```typescript
const standardAttributes = {
  // Service information
  'service.name': 'payment-processing-system',
  'service.version': '1.0.0',
  'service.environment': 'production',

  // HTTP attributes
  'http.method': 'POST',
  'http.url': '/api/v1/payments',
  'http.status_code': 200,
  'http.user_agent': 'client-app/1.0',

  // Database attributes
  'db.system': 'postgresql',
  'db.operation': 'INSERT',
  'db.table': 'payments',
  'db.rows_affected': 1,

  // Payment-specific attributes
  'payment.gateway': 'authorize-net',
  'payment.type': 'purchase',
  'payment.currency': 'USD',
  'payment.amount': 99.99, // Non-PCI sensitive
  'payment.merchant_id': 'merchant_123',
};
```

#### Security & Compliance Attributes

```typescript
const securityAttributes = {
  // PCI-compliant attributes (no sensitive data)
  'payment.card_type': 'visa',
  'payment.card_last_four': '1234',
  'payment.auth_code': 'ABC123',
  'payment.avs_result': 'Y',
  'payment.cvv_result': 'M',

  // Security context
  'security.api_key_id': 'key_123',
  'security.rate_limit_remaining': 95,
  'security.ip_address': '192.168.1.1',
  'security.user_agent_hash': 'sha256:...',

  // Compliance tracking
  'compliance.pci_scope': 'out_of_scope',
  'compliance.data_classification': 'restricted',
  'audit.action': 'payment_created',
  'audit.actor': 'api_client_123',
};
```

## Logging Strategy

### Log Levels & Categories

#### Log Levels

```typescript
enum LogLevel {
  FATAL = 0, // System unusable, immediate attention required
  ERROR = 1, // Error conditions, but system still functional
  WARN = 2, // Warning conditions, potential issues
  INFO = 3, // Informational messages, normal operation
  DEBUG = 4, // Debug information for development
  TRACE = 5, // Detailed trace information
}
```

#### Log Categories

```typescript
enum LogCategory {
  PAYMENT = 'payment', // Payment processing events
  SECURITY = 'security', // Security-related events
  AUDIT = 'audit', // Audit trail events
  PERFORMANCE = 'performance', // Performance-related events
  INTEGRATION = 'integration', // External service integration
  WEBHOOK = 'webhook', // Webhook processing events
  DATABASE = 'database', // Database operations
  CACHE = 'cache', // Cache operations
  QUEUE = 'queue', // Queue processing events
  HEALTH = 'health', // Health check events
}
```

### Structured Log Format

#### Standard Log Structure

```typescript
interface LogEntry {
  timestamp: string; // ISO 8601 timestamp
  level: LogLevel; // Log level
  category: LogCategory; // Log category
  message: string; // Human-readable message
  correlationId: string; // Request correlation ID
  traceId?: string; // Distributed trace ID
  spanId?: string; // Current span ID
  service: string; // Service name
  version: string; // Service version
  environment: string; // Environment (prod/staging/dev)
  metadata: Record<string, any>; // Additional structured data
  error?: ErrorDetails; // Error information (if applicable)
}
```

#### Error Log Structure

```typescript
interface ErrorDetails {
  name: string; // Error class name
  message: string; // Error message
  code?: string; // Error code
  stack?: string; // Stack trace (dev/staging only)
  cause?: ErrorDetails; // Nested error cause
  context: Record<string, any>; // Error context
}
```

### Log Sampling & Retention

#### Sampling Strategy

```typescript
const logSamplingRules = {
  production: {
    FATAL: { sampleRate: 1.0, retention: '7 years' },
    ERROR: { sampleRate: 1.0, retention: '2 years' },
    WARN: { sampleRate: 1.0, retention: '1 year' },
    INFO: { sampleRate: 0.1, retention: '6 months' },
    DEBUG: { sampleRate: 0.01, retention: '1 month' },
    TRACE: { sampleRate: 0.001, retention: '1 week' },
  },

  staging: {
    // Higher sampling for testing
    INFO: { sampleRate: 1.0, retention: '1 month' },
    DEBUG: { sampleRate: 1.0, retention: '1 week' },
    TRACE: { sampleRate: 0.1, retention: '3 days' },
  },
};
```

### PCI-Compliant Logging

#### Data Classification

```typescript
enum DataClassification {
  PUBLIC = 'public', // No restrictions
  INTERNAL = 'internal', // Internal use only
  CONFIDENTIAL = 'confidential', // Restricted access
  RESTRICTED = 'restricted', // Highest security level
}

// PCI DSS sensitive data - NEVER LOG
const prohibitedData = [
  'credit_card_number',
  'cvv',
  'pin',
  'magnetic_stripe_data',
  'chip_data',
];

// Allowed payment data for logging
const allowedPaymentData = [
  'transaction_id',
  'authorization_code',
  'last_four_digits',
  'card_type',
  'expiry_month_year', // Masked: XX/XX
  'amount',
  'currency',
  'merchant_id',
  'gateway_response_code',
];
```

#### Log Masking Rules

```typescript
const maskingRules = {
  // Credit card numbers - show only last 4 digits
  creditCard: /(\d{4})\d{8,12}(\d{4})/g,
  replacement: '****-****-****-$2',

  // Email addresses - mask domain
  email: /([^@]+)@(.+)/g,
  replacement: '$1@***',

  // Phone numbers - mask middle digits
  phone: /(\d{3})\d{3}(\d{4})/g,
  replacement: '$1-***-$2',

  // API keys - show only prefix
  apiKey: /(sk_|pk_)\w{2}(\w+)/g,
  replacement: '$1**...**',
};
```

## Monitoring Dashboards

### Executive Dashboard

#### Key Performance Indicators

```typescript
const executiveKPIs = {
  // Revenue metrics
  dailyRevenue: {
    query: 'sum(payment_transaction_amount_total{status="success"})',
    timeRange: '24h',
    target: 100000,
    unit: 'USD',
  },

  // Success rate
  paymentSuccessRate: {
    query:
      'rate(payment_transactions_total{status="success"}[5m]) / rate(payment_transactions_total[5m])',
    timeRange: '1h',
    target: 0.99,
    unit: 'percentage',
  },

  // System availability
  systemUptime: {
    query:
      '1 - rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])',
    timeRange: '24h',
    target: 0.999,
    unit: 'percentage',
  },
};
```

### Operations Dashboard

#### System Health Metrics

```typescript
const operationsMetrics = {
  // Application performance
  responseTime: {
    query:
      'histogram_quantile(0.95, http_request_duration_seconds_bucket{endpoint="/api/v1/payments"})',
    threshold: 2.0,
    unit: 'seconds',
  },

  // Database performance
  dbConnectionPool: {
    query: 'db_connections_active / db_connections_max',
    threshold: 0.8,
    unit: 'percentage',
  },

  // Queue health
  webhookQueueDepth: {
    query: 'sqs_messages_visible{queue_name="webhook-processing"}',
    threshold: 1000,
    unit: 'messages',
  },
};
```

### Security Dashboard

#### Security Monitoring Metrics

```typescript
const securityMetrics = {
  // Authentication failures
  authFailures: {
    query: 'rate(authentication_failures_total[5m])',
    threshold: 10,
    unit: 'failures/second',
  },

  // Rate limiting
  rateLimitViolations: {
    query: 'rate(rate_limit_exceeded_total[5m])',
    threshold: 50,
    unit: 'violations/second',
  },

  // Suspicious activity
  suspiciousActivity: {
    query: 'rate(security_events_total{severity="high"}[5m])',
    threshold: 1,
    unit: 'events/second',
  },
};
```

## Alerting Strategy

### Alert Severity Levels

```typescript
enum AlertSeverity {
  CRITICAL = 'critical', // Immediate response required
  HIGH = 'high', // Response within 15 minutes
  MEDIUM = 'medium', // Response within 1 hour
  LOW = 'low', // Response within 24 hours
  INFO = 'info', // Informational only
}
```

### Critical Alerts

#### Payment Processing Alerts

```typescript
const criticalAlerts = {
  paymentGatewayDown: {
    condition:
      'rate(payment_transactions_total{status="gateway_error"}[5m]) > 0.5',
    severity: AlertSeverity.CRITICAL,
    description: 'Payment gateway experiencing high error rates',
    runbook: 'https://wiki.company.com/runbooks/payment-gateway-down',
  },

  highPaymentFailureRate: {
    condition:
      'rate(payment_transactions_total{status="failed"}[5m]) / rate(payment_transactions_total[5m]) > 0.1',
    severity: AlertSeverity.HIGH,
    description: 'Payment failure rate exceeds 10%',
    runbook: 'https://wiki.company.com/runbooks/high-failure-rate',
  },

  databaseConnectionFailure: {
    condition: 'db_connections_active == 0',
    severity: AlertSeverity.CRITICAL,
    description: 'Database connection pool exhausted',
    runbook: 'https://wiki.company.com/runbooks/database-issues',
  },
};
```

### Performance Alerts

```typescript
const performanceAlerts = {
  highResponseTime: {
    condition:
      'histogram_quantile(0.95, http_request_duration_seconds_bucket) > 5',
    severity: AlertSeverity.HIGH,
    description: '95th percentile response time exceeds 5 seconds',
    duration: '5m',
  },

  memoryUsageHigh: {
    condition: 'process_memory_usage_bytes / process_memory_limit_bytes > 0.9',
    severity: AlertSeverity.MEDIUM,
    description: 'Memory usage exceeds 90%',
    duration: '10m',
  },

  webhookQueueBacklog: {
    condition: 'sqs_messages_visible{queue_name="webhook-processing"} > 10000',
    severity: AlertSeverity.HIGH,
    description: 'Webhook processing queue has significant backlog',
    duration: '5m',
  },
};
```

### Security Alerts

```typescript
const securityAlerts = {
  bruteForceAttack: {
    condition:
      'rate(authentication_failures_total{reason="invalid_credentials"}[1m]) > 100',
    severity: AlertSeverity.CRITICAL,
    description: 'Potential brute force attack detected',
    duration: '1m',
  },

  pciComplianceViolation: {
    condition: 'rate(pci_compliance_violations_total[5m]) > 0',
    severity: AlertSeverity.CRITICAL,
    description: 'PCI DSS compliance violation detected',
    duration: '0s',
  },

  suspiciousApiUsage: {
    condition: 'rate(api_key_validations_total{status="suspicious"}[5m]) > 10',
    severity: AlertSeverity.HIGH,
    description: 'Suspicious API key usage pattern detected',
    duration: '5m',
  },
};
```

## Performance Monitoring

### Application Performance Monitoring (APM)

#### Key Performance Indicators

```typescript
const performanceKPIs = {
  // Latency metrics
  p50ResponseTime:
    'histogram_quantile(0.50, http_request_duration_seconds_bucket)',
  p95ResponseTime:
    'histogram_quantile(0.95, http_request_duration_seconds_bucket)',
  p99ResponseTime:
    'histogram_quantile(0.99, http_request_duration_seconds_bucket)',

  // Throughput metrics
  requestsPerSecond: 'rate(http_requests_total[1m])',
  transactionsPerSecond: 'rate(payment_transactions_total[1m])',

  // Error rates
  errorRate:
    'rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])',
  paymentErrorRate:
    'rate(payment_transactions_total{status="failed"}[5m]) / rate(payment_transactions_total[5m])',
};
```

### Database Performance Monitoring

```typescript
const databaseMetrics = {
  // Connection pool metrics
  activeConnections: 'db_connections_active',
  idleConnections: 'db_connections_idle',
  connectionUtilization:
    'db_connections_active / (db_connections_active + db_connections_idle)',

  // Query performance
  slowQueries: 'rate(db_query_duration_seconds_bucket{le="1.0"}[5m])',
  queryErrorRate:
    'rate(db_query_errors_total[5m]) / rate(db_queries_total[5m])',

  // Transaction metrics
  transactionDuration:
    'histogram_quantile(0.95, db_transaction_duration_seconds_bucket)',
  deadlockRate: 'rate(db_deadlocks_total[5m])',
};
```

## Security Monitoring

### Security Event Categories

```typescript
enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'auth_failure',
  AUTHORIZATION_FAILURE = 'authz_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  PCI_VIOLATION = 'pci_violation',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  MALICIOUS_PAYLOAD = 'malicious_payload',
}
```

### Security Metrics

```typescript
const securityMetrics = {
  // Authentication security
  failedLoginAttempts: 'rate(authentication_failures_total[5m])',
  accountLockouts: 'rate(account_lockouts_total[5m])',
  passwordResetRequests: 'rate(password_reset_requests_total[5m])',

  // API security
  invalidApiKeyUsage: 'rate(api_key_validations_total{status="invalid"}[5m])',
  expiredApiKeyUsage: 'rate(api_key_validations_total{status="expired"}[5m])',
  rateLimitViolations: 'rate(rate_limit_exceeded_total[5m])',

  // Payment security
  fraudulentTransactions:
    'rate(payment_transactions_total{fraud_score=">80"}[5m])',
  chargebackRequests: 'rate(chargeback_requests_total[1d])',

  // System security
  unauthorizedAccess:
    'rate(security_events_total{type="unauthorized_access"}[5m])',
  dataExfiltrationAttempts:
    'rate(security_events_total{type="data_exfiltration"}[5m])',
};
```

## Implementation Guidelines

### Metrics Collection

#### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - 'payment_processing_rules.yml'

scrape_configs:
  - job_name: 'payment-processing-system'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 5s
    metrics_path: /metrics

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
```

#### Custom Metrics Implementation

```typescript
// metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly paymentCounter = new Counter({
    name: 'payment_transactions_total',
    help: 'Total number of payment transactions',
    labelNames: ['gateway', 'type', 'status', 'currency'],
  });

  private readonly paymentDuration = new Histogram({
    name: 'payment_processing_duration_seconds',
    help: 'Payment processing duration in seconds',
    labelNames: ['gateway', 'type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  });

  private readonly activeConnections = new Gauge({
    name: 'db_connections_active',
    help: 'Number of active database connections',
  });

  recordPaymentTransaction(
    gateway: string,
    type: string,
    status: string,
    currency: string,
  ): void {
    this.paymentCounter.inc({ gateway, type, status, currency });
  }

  recordPaymentDuration(gateway: string, type: string, duration: number): void {
    this.paymentDuration.observe({ gateway, type }, duration);
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }
}
```

### Tracing Implementation

#### OpenTelemetry Setup

```typescript
// tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint:
      process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    // Add custom payment processing instrumentation
  ],
});

sdk.start();
```

### Logging Implementation

#### Structured Logger

```typescript
// logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface LogContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<LogContext>();

  log(message: string, context?: string, metadata?: Record<string, any>): void {
    this.writeLog('INFO', message, context, metadata);
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog('ERROR', message, context, { ...metadata, stack: trace });
  }

  warn(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog('WARN', message, context, metadata);
  }

  debug(
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog('DEBUG', message, context, metadata);
  }

  private writeLog(
    level: string,
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    const logContext = this.asyncLocalStorage.getStore();
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      correlationId: logContext?.correlationId,
      traceId: logContext?.traceId,
      spanId: logContext?.spanId,
      userId: logContext?.userId,
      service: 'payment-processing-system',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      metadata: this.sanitizeMetadata(metadata),
    };

    console.log(JSON.stringify(logEntry));
  }

  private sanitizeMetadata(
    metadata?: Record<string, any>,
  ): Record<string, any> {
    if (!metadata) return {};

    // Remove PCI sensitive data
    const sanitized = { ...metadata };
    const sensitiveFields = ['creditCardNumber', 'cvv', 'pin', 'ssn'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    });

    return sanitized;
  }
}
```

### Health Check Implementation

```typescript
// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.checkRedis(),
      () => this.checkSQS(),
      () => this.checkPaymentGateways(),
    ]);
  }

  private async checkRedis(): Promise<any> {
    // Redis health check implementation
  }

  private async checkSQS(): Promise<any> {
    // SQS health check implementation
  }

  private async checkPaymentGateways(): Promise<any> {
    // Payment gateway health check implementation
  }
}
```

This comprehensive observability strategy provides complete visibility into your payment processing system while maintaining PCI compliance and security best practices. The implementation follows your coding standards with TypeScript types, structured logging, and comprehensive monitoring coverage.
