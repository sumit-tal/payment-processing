# Payment Processing System Architecture

## Overview

This document provides a comprehensive overview of the Payment Processing System architecture, including API endpoints, database schema, payment flows, design decisions, and compliance considerations.

## System Architecture

### Technology Stack
- **Framework**: NestJS (Node.js/TypeScript)
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis
- **Payment Gateway**: Authorize.Net
- **Queue**: AWS SQS (for webhook processing)
- **Authentication**: API Key-based
- **Containerization**: Docker & Docker Compose

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │───▶│  Payment API    │───▶│  Authorize.Net  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              ▼                         │
                       ┌─────────────────┐              │
                       │   PostgreSQL    │              │
                       └─────────────────┘              │
                              │                         │
                              ▼                         │
                       ┌─────────────────┐              │
                       │     Redis       │              │
                       └─────────────────┘              │
                              │                         │
                              ▼                         │
                       ┌─────────────────┐              │
                       │   AWS SQS       │◀─────────────┘
                       └─────────────────┘
```

## API Endpoints

### 1. Payment Operations (`/payments`)

#### Core Payment Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payments/purchase` | Create purchase transaction (Auth + Capture) | ✅ |
| POST | `/payments/authorize` | Create authorization transaction | ✅ |
| POST | `/payments/capture` | Capture authorized payment | ✅ |
| POST | `/payments/refund` | Process refund (full or partial) | ✅ |
| POST | `/payments/cancel` | Cancel/void authorized payment | ✅ |
| GET | `/payments/:id` | Get transaction details | ✅ |

#### Request/Response Examples

**Create Purchase:**
```http
POST /payments/purchase
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "amount": 99.99,
  "currency": "USD",
  "paymentMethod": "credit_card",
  "customerId": "cust_123",
  "orderId": "order_456",
  "description": "Product purchase",
  "idempotencyKey": "unique-key-123",
  "metadata": {
    "productId": "prod_789"
  }
}
```

**Response:**
```json
{
  "transactionId": "txn_abc123",
  "status": "completed",
  "amount": 99.99,
  "currency": "USD",
  "gatewayTransactionId": "auth_net_123",
  "authCode": "ABC123",
  "responseText": "This transaction has been approved",
  "createdAt": "2025-09-11T01:05:49Z"
}
```

### 2. Payment Methods (`/payment-methods`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payment-methods` | Create payment method | ✅ |
| GET | `/payment-methods/:id` | Get payment method by ID | ✅ |
| GET | `/payment-methods?customerId=:id` | Get customer payment methods | ✅ |
| PUT | `/payment-methods/:id` | Update payment method | ✅ |
| DELETE | `/payment-methods/:id` | Delete payment method | ✅ |

### 3. Subscriptions (`/subscriptions`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/subscriptions` | Create subscription | ✅ |
| GET | `/subscriptions/:id` | Get subscription by ID | ✅ |
| GET | `/subscriptions?customerId=:id` | Get customer subscriptions | ✅ |
| PUT | `/subscriptions/:id` | Update subscription | ✅ |
| PUT | `/subscriptions/:id/cancel` | Cancel subscription | ✅ |

### 4. Subscription Plans (`/subscription-plans`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/subscription-plans` | Create subscription plan | ✅ |
| GET | `/subscription-plans` | Get all plans (with filters) | ✅ |
| GET | `/subscription-plans/:id` | Get plan by ID | ✅ |
| PUT | `/subscription-plans/:id` | Update plan | ✅ |
| PUT | `/subscription-plans/:id/deactivate` | Deactivate plan | ✅ |
| PUT | `/subscription-plans/:id/archive` | Archive plan | ✅ |
| DELETE | `/subscription-plans/:id` | Delete plan (permanent) | ✅ |

### 5. Webhooks (`/webhooks`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/webhooks/authorize-net` | Receive Authorize.Net webhook | ❌ |
| GET | `/webhooks/events` | Get webhook events (with filters) | ✅ |
| GET | `/webhooks/events/:id` | Get webhook event by ID | ✅ |
| POST | `/webhooks/events/:id/retry` | Retry webhook event | ✅ |
| GET | `/webhooks/stats` | Get webhook statistics | ✅ |
| GET | `/webhooks/health` | Webhook service health check | ❌ |

### 6. API Key Management (`/api-keys`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api-keys` | Create API key | ✅ (Admin) |
| GET | `/api-keys` | Get all API keys | ✅ (Admin) |
| GET | `/api-keys/:id` | Get API key by ID | ✅ (Admin) |
| PUT | `/api-keys/:id` | Update API key | ✅ (Admin) |
| PUT | `/api-keys/:id/deactivate` | Deactivate API key | ✅ (Admin) |
| DELETE | `/api-keys/:id` | Delete API key | ✅ (Admin) |

### 7. Audit Logs (`/audit-logs`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/audit-logs` | Get audit logs (with filters) | ✅ (Admin) |
| GET | `/audit-logs/statistics` | Get audit statistics | ✅ (Admin) |
| GET | `/audit-logs/:id` | Get audit log by ID | ✅ (Admin) |

### 8. Health Check (`/health`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Application health check | ❌ |
| GET | `/health/database` | Database connectivity check | ❌ |

## Database Schema & Entity Relationships

### Entity Relationship Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ApiKey        │    │  PaymentMethod  │    │ SubscriptionPlan│
│                 │    │                 │    │                 │
│ - id (PK)       │    │ - id (PK)       │    │ - id (PK)       │
│ - clientId      │    │ - customerId    │    │ - name          │
│ - keyHash       │    │ - cardLastFour  │    │ - amount        │
│ - permissions   │    │ - cardBrand     │    │ - billingInterval│
│ - rateLimit     │    │ - isDefault     │    │ - trialPeriodDays│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              │                         │
                              ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Transaction   │    │  Subscription   │────│SubscriptionPlan │
│                 │    │                 │    │                 │
│ - id (PK)       │    │ - id (PK)       │    │                 │
│ - merchantTxnId │    │ - customerId    │    │                 │
│ - gatewayTxnId  │    │ - planId (FK)   │    │                 │
│ - type          │    │ - paymentMethodId│    │                 │
│ - status        │    │ - status        │    │                 │
│ - amount        │    │ - nextBillingDate│   │                 │
│ - currency      │    │ - trialStart    │    │                 │
│ - customerId    │    │ - trialEnd      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              │
                              ▼
                       ┌─────────────────┐
                       │ PaymentMethod   │
                       │                 │
                       └─────────────────┘

┌─────────────────┐    ┌─────────────────┐
│  WebhookEvent   │    │   AuditLog      │
│                 │    │                 │
│ - id (PK)       │    │ - id (PK)       │
│ - eventType     │    │ - action        │
│ - externalId    │    │ - entityType    │
│ - payload       │    │ - entityId      │
│ - status        │    │ - userId        │
│ - retryCount    │    │ - success       │
│ - errorMessage  │    │ - metadata      │
└─────────────────┘    └─────────────────┘
```

### Core Entities

#### 1. Transaction Entity
```typescript
{
  id: string (UUID, PK)
  merchantTransactionId: string (Unique)
  gatewayTransactionId?: string
  parentTransactionId?: string
  type: TransactionType (purchase, authorization, capture, refund, void)
  status: TransactionStatus (pending, processing, completed, failed, cancelled)
  paymentMethod: PaymentMethod (credit_card, debit_card, bank_transfer)
  amount: decimal(10,2)
  refundedAmount: decimal(10,2)
  currency: string(3)
  customerId?: string
  orderId?: string
  description?: string
  metadata?: jsonb
  gatewayResponse?: jsonb
  failureReason?: string
  idempotencyKey: string (Unique)
  processedAt?: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 2. PaymentMethod Entity
```typescript
{
  id: string (UUID, PK)
  customerId: string
  gatewayPaymentMethodId: string
  cardLastFour?: string(4)
  cardBrand?: string
  cardExpiryMonth?: number
  cardExpiryYear?: number
  billingAddress?: jsonb
  isDefault: boolean
  isActive: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 3. Subscription Entity
```typescript
{
  id: string (UUID, PK)
  customerId: string
  subscriptionPlanId: string (FK)
  paymentMethodId: string (FK)
  gatewaySubscriptionId: string (Unique)
  status: SubscriptionStatus (active, past_due, cancelled, expired, suspended, trial)
  currentPeriodStart: timestamp
  currentPeriodEnd: timestamp
  nextBillingDate: timestamp
  trialStart?: timestamp
  trialEnd?: timestamp
  cancelledAt?: timestamp
  endedAt?: timestamp
  billingCycleCount: number
  failedPaymentCount: number
  lastPaymentDate?: timestamp
  lastPaymentAmount?: decimal(10,2)
  metadata?: jsonb
  gatewayResponse?: jsonb
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 4. WebhookEvent Entity
```typescript
{
  id: string (UUID, PK)
  eventType: WebhookEventType
  externalId: string
  payload: jsonb
  signature: string
  status: WebhookEventStatus (pending, processing, processed, failed, retrying)
  retryCount: number
  maxRetries: number
  processedAt?: timestamp
  errorMessage?: string
  processingResult?: jsonb
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Database Indexes
- **Transactions**: merchantTransactionId (unique), gatewayTransactionId, status, type, createdAt
- **PaymentMethods**: customerId, isDefault
- **Subscriptions**: customerId, status, gatewaySubscriptionId, nextBillingDate, createdAt
- **WebhookEvents**: eventType + status, createdAt, externalId
- **ApiKeys**: keyHash (unique), clientId
- **AuditLogs**: action, entityType + entityId, userId, createdAt, ipAddress

## Payment Flows

### 1. Purchase Flow (Auth + Capture)
```
Client Request → API Validation → Idempotency Check → Create Transaction Record
     ↓
Authorize.Net API Call → Update Transaction Status → Return Response
     ↓
Audit Logging → Metrics Collection → Webhook Processing (if configured)
```

### 2. Authorization Flow
```
Client Request → API Validation → Idempotency Check → Create Auth Transaction
     ↓
Authorize.Net Auth API → Update Transaction Status → Return Auth Response
     ↓
[Later] Capture Request → Validate Auth Transaction → Authorize.Net Capture API
     ↓
Update Transaction Status → Return Capture Response
```

### 3. Subscription Flow
```
Create Subscription Plan → Customer Selects Plan → Create Payment Method
     ↓
Create Subscription → Authorize.Net Subscription API → Store Subscription Record
     ↓
Recurring Billing (Authorize.Net) → Webhook Notification → Process Payment Event
     ↓
Update Subscription Status → Generate Invoice → Send Notifications
```

### 4. Webhook Processing Flow
```
Authorize.Net Webhook → Signature Validation → Idempotency Check
     ↓
Store Webhook Event → Queue for Processing (SQS) → Background Worker
     ↓
Process Event → Update Related Records → Mark as Processed
     ↓
Retry Logic (if failed) → Dead Letter Queue (max retries exceeded)
```

### 5. Refund Flow
```
Refund Request → Validate Original Transaction → Check Refund Eligibility
     ↓
Create Refund Transaction → Authorize.Net Refund API → Update Transaction Status
     ↓
Update Original Transaction (refundedAmount) → Audit Logging → Return Response
```

## Design Trade-offs & Architectural Decisions

### 1. Synchronous vs Asynchronous Processing

#### Payment Operations (Synchronous)
- **Decision**: Process payments synchronously
- **Rationale**: 
  - Immediate feedback required for payment decisions
  - Real-time transaction status needed for user experience
  - Simpler error handling and retry logic
- **Trade-offs**: 
  - Higher latency for API responses
  - Direct dependency on payment gateway availability
  - Limited scalability for high-volume scenarios

#### Webhook Processing (Asynchronous)
- **Decision**: Process webhooks asynchronously using SQS
- **Rationale**:
  - Webhooks can be high-volume and bursty
  - Processing can be time-intensive (database updates, notifications)
  - Allows for reliable retry mechanisms
  - Decouples webhook receipt from processing
- **Trade-offs**:
  - Eventual consistency for webhook-driven updates
  - Additional infrastructure complexity (SQS)
  - Requires careful handling of duplicate events

### 2. Database Design Decisions

#### Single Database vs Microservices
- **Decision**: Single PostgreSQL database with modular service architecture
- **Rationale**:
  - ACID compliance for financial transactions
  - Simplified deployment and maintenance
  - Strong consistency for payment operations
  - Easier to implement complex queries across entities
- **Trade-offs**:
  - Single point of failure
  - Scaling limitations compared to distributed databases
  - Potential for service coupling through shared schema

#### JSON Storage for Metadata
- **Decision**: Use JSONB columns for flexible metadata storage
- **Rationale**:
  - Payment gateways return variable response structures
  - Extensibility for future payment methods
  - Efficient querying with PostgreSQL JSONB operators
- **Trade-offs**:
  - Less type safety compared to structured columns
  - Potential for inconsistent data structures
  - More complex validation logic required

### 3. Authentication & Authorization

#### API Key-based Authentication
- **Decision**: Implement API key authentication instead of OAuth/JWT
- **Rationale**:
  - Simpler implementation for B2B payment API
  - Long-lived credentials suitable for server-to-server communication
  - Fine-grained permissions per API key
  - Better rate limiting and usage tracking
- **Trade-offs**:
  - Less suitable for user-facing applications
  - Key management complexity
  - No built-in token expiration (manual key rotation required)

### 4. Retry Strategies

#### Exponential Backoff for Webhooks
- **Decision**: Implement exponential backoff with jitter for webhook retries
- **Rationale**:
  - Reduces load on downstream systems during outages
  - Prevents thundering herd problems
  - Increases success rate for transient failures
- **Configuration**:
  - Initial delay: 1 second
  - Maximum delay: 300 seconds (5 minutes)
  - Maximum retries: 3
  - Jitter: ±25% to prevent synchronized retries

#### Circuit Breaker for Payment Gateway
- **Decision**: Implement circuit breaker pattern for Authorize.Net API calls
- **Rationale**:
  - Prevents cascading failures during gateway outages
  - Faster failure detection and recovery
  - Protects system resources during high error rates
- **Configuration**:
  - Failure threshold: 5 consecutive failures
  - Timeout: 30 seconds
  - Half-open retry interval: 60 seconds

### 5. Caching Strategy

#### Redis for Rate Limiting and Sessions
- **Decision**: Use Redis for distributed rate limiting and session storage
- **Rationale**:
  - High-performance in-memory storage
  - Built-in expiration for rate limit windows
  - Atomic operations for counter increments
  - Horizontal scaling support
- **Trade-offs**:
  - Additional infrastructure dependency
  - Data volatility (not persistent by default)
  - Memory usage considerations for large datasets

### 6. Idempotency Implementation

#### Database-based Idempotency
- **Decision**: Store idempotency keys in database with unique constraints
- **Rationale**:
  - Guarantees exactly-once processing for payments
  - Persistent across application restarts
  - Supports complex idempotency scenarios
- **Implementation**:
  - 24-hour idempotency window
  - Unique constraint on idempotency key per operation type
  - Returns cached response for duplicate requests

## Compliance Considerations

### PCI DSS Compliance (SAQ A)

#### Data Handling
- **No Cardholder Data Storage**: System never stores, processes, or transmits cardholder data
- **Tokenization**: All sensitive data handled by PCI-compliant Authorize.Net
- **Data Minimization**: Only store transaction references and business metadata

#### Security Measures
- **Encryption in Transit**: TLS 1.2+ for all external communications
- **Encryption at Rest**: AES-256-GCM for sensitive configuration data
- **Access Controls**: Role-based API key permissions with principle of least privilege
- **Audit Logging**: Comprehensive logging of all payment-related activities

#### Network Security
- **Firewall Configuration**: Restrict access to payment processing endpoints
- **Network Segmentation**: Isolate payment processing components
- **Secure Headers**: Implement security headers (HSTS, CSP, etc.)

### Data Retention & Privacy

#### Retention Policies
- **Transaction Data**: 7 years (regulatory requirement)
- **Audit Logs**: 1 year (compliance requirement)
- **Webhook Events**: 90 days (operational requirement)
- **API Keys**: Indefinite (until manually deleted)

#### Data Privacy
- **PII Minimization**: Collect only necessary customer information
- **Data Anonymization**: Remove or hash PII in logs and analytics
- **Right to Deletion**: Support for customer data deletion requests
- **Data Portability**: Export capabilities for customer data

### Monitoring & Alerting

#### Security Monitoring
- **Failed Authentication Attempts**: Alert on suspicious API key usage
- **Rate Limit Violations**: Monitor for potential abuse patterns
- **Unusual Transaction Patterns**: Detect anomalous payment behavior
- **System Anomalies**: Monitor for performance and availability issues

#### Compliance Monitoring
- **Automated Compliance Checks**: Regular validation of security configurations
- **Vulnerability Scanning**: Automated security vulnerability assessments
- **Dependency Monitoring**: Track security updates for third-party libraries
- **Audit Trail Integrity**: Ensure completeness and immutability of audit logs

## Deployment Architecture

### Container Strategy
- **Multi-stage Docker builds** for optimized production images
- **Docker Compose** for local development environment
- **Health checks** for all services with proper startup dependencies

### Environment Configuration
- **Environment-specific configurations** using environment variables
- **Secrets management** for sensitive configuration (API keys, database credentials)
- **Configuration validation** at application startup

### Scalability Considerations
- **Horizontal scaling** support for application instances
- **Database connection pooling** for efficient resource utilization
- **Redis clustering** for high-availability caching
- **Load balancing** for distributed request handling

## API Documentation

### OpenAPI/Swagger Integration
- **Comprehensive API documentation** with Swagger UI
- **Request/response schemas** with validation rules
- **Authentication examples** and error response formats
- **Interactive testing** capabilities for development

### Postman Collection
A complete Postman collection is available with:
- **Pre-configured environments** (development, staging, production)
- **Authentication setup** with API key variables
- **Sample requests** for all endpoints
- **Test scripts** for response validation
- **Environment variables** for dynamic data

### Rate Limiting
- **Per-API-key limits**: Configurable rate limits per client
- **Global limits**: System-wide protection against abuse
- **Rate limit headers**: Standard HTTP headers for client awareness
- **Graceful degradation**: Proper error responses when limits exceeded

---

**Document Version**: 1.0  
**Last Updated**: September 11, 2025  
**Architecture Review**: Quarterly  
**Compliance Status**: PCI DSS SAQ A Compliant
