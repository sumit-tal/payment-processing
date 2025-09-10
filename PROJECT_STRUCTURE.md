# Project Structure

This document provides a comprehensive overview of the payment processing system's architecture, folder structure, and the purpose of each component.

## 📁 Root Directory Structure

```
payment-processing-system/
├── docs/                           # Documentation and compliance guides
├── scripts/                        # Database initialization and utility scripts
├── src/                            # Main application source code
├── tasks/                          # Project development tasks and milestones
├── test/                           # End-to-end testing configuration
├── .env.example                    # Environment variables template
├── .eslintrc.js                    # ESLint configuration for code quality
├── .prettierrc                     # Prettier configuration for code formatting
├── Dockerfile                      # Docker container configuration
├── README.md                       # Project overview and setup instructions
├── business.prd.md                 # Business Product Requirements Document
├── docker-compose.yml              # Multi-container Docker application setup
├── jest.config.js                  # Jest testing framework configuration
├── nest-cli.json                   # NestJS CLI configuration
├── package.json                    # Node.js dependencies and scripts
├── progress.md                     # Development progress tracking
├── technical.prd.md                # Technical Product Requirements Document
├── tsconfig.json                   # TypeScript compiler configuration
└── tsconfig.spec.json              # TypeScript configuration for tests
```

## 🏗️ Source Code Architecture (`src/`)

The application follows a modular architecture with clear separation of concerns:

```
src/
├── __tests__/                      # Application-level unit tests
├── common/                         # Shared utilities and cross-cutting concerns
├── config/                         # Configuration management and setup
├── database/                       # Database entities, migrations, and schemas
├── modules/                        # Feature-specific business logic modules
├── app.controller.ts               # Root application controller
├── app.module.ts                   # Main application module (dependency injection)
├── app.service.ts                  # Root application service
└── main.ts                         # Application entry point and bootstrap
```

### 🔧 Common Utilities (`src/common/`)

Shared components used across the entire application:

```
common/
├── decorators/                     # Custom TypeScript decorators
├── filters/                        # Exception filters for error handling
├── guards/                         # Authentication and authorization guards
├── interceptors/                   # Request/response interceptors
└── pipes/                          # Data transformation and validation pipes
```

**Purpose**: Provides reusable components that implement cross-cutting concerns like authentication, logging, error handling, and data validation across all modules.

### ⚙️ Configuration (`src/config/`)

Application configuration and environment management:

```
config/
├── __test__/                       # Configuration unit tests
├── configuration.ts                # Main application configuration
├── database.config.ts              # Database connection and TypeORM setup
├── datasource.ts                   # TypeORM data source configuration
└── security.config.ts              # Security settings and API key management
```

**Purpose**: Centralizes all configuration management, including database connections, security settings, and environment-specific variables with type safety.

### 🗄️ Database Layer (`src/database/`)

Data persistence and database management:

```
database/
├── entities/                       # TypeORM entity definitions
│   ├── api-key.entity.ts          # API key management for authentication
│   ├── audit-log.entity.ts        # Comprehensive audit trail logging
│   ├── payment-method.entity.ts   # Customer payment method storage
│   ├── subscription-payment.entity.ts # Individual subscription payments
│   ├── subscription-plan.entity.ts # Subscription plan definitions
│   ├── subscription.entity.ts     # Customer subscription instances
│   ├── transaction.entity.ts      # Payment transaction records
│   ├── webhook-event.entity.ts    # Webhook event processing tracking
│   └── index.ts                   # Entity exports
└── migrations/                     # Database schema migrations
```

**Purpose**: Defines the data model with TypeORM entities representing core business objects like transactions, subscriptions, and audit logs. Migrations ensure database schema versioning.

## 🏢 Business Modules (`src/modules/`)

Feature-specific modules implementing core business logic:

### 💳 Payments Module (`src/modules/payments/`)

Core payment processing functionality:

```
payments/
├── controllers/                    # HTTP endpoints for payment operations
├── dto/                           # Data Transfer Objects for API contracts
├── services/                      # Business logic for payment processing
├── payments.module.ts             # Module configuration and dependencies
├── README.md                      # Payment flows documentation
└── README-subscriptions.md        # Subscription-specific documentation
```

**Purpose**: Handles all payment operations including:
- Purchase (Auth + Capture in one step)
- Authorize + Capture (two-step process)
- Cancellations (void before capture)
- Refunds (full and partial)
- Subscription management and recurring billing
- Integration with Authorize.Net payment gateway

### 🔗 Webhooks Module (`src/modules/webhooks/`)

Asynchronous webhook processing system:

```
webhooks/
├── controllers/                    # Webhook endpoint handlers
├── dto/                           # Webhook payload data structures
├── services/                      # Webhook processing and queue management
└── webhooks.module.ts             # Module configuration
```

**Purpose**: Manages asynchronous webhook processing with:
- AWS SQS integration for reliable message queuing
- Dead letter queue handling for failed events
- Exponential backoff retry logic
- Webhook signature validation
- Event deduplication and idempotency

### 🔐 Security Module (`src/modules/security/`)

Security and compliance implementation:

```
security/
├── controllers/                    # Security-related endpoints
├── middleware/                     # Security middleware (rate limiting, etc.)
├── services/                      # Security services (API key management, crypto)
└── security.module.ts             # Module configuration
```

**Purpose**: Implements PCI DSS compliance features:
- API key generation and validation
- Rate limiting and throttling
- Cryptographic operations
- Security headers and CORS configuration
- Input sanitization and validation

### 📋 Audit Module (`src/modules/audit/`)

Comprehensive audit logging system:

```
audit/
├── controllers/                    # Audit log query endpoints
├── dto/                           # Audit log data structures
├── services/                      # Audit logging services
└── audit.module.ts               # Module configuration
```

**Purpose**: Provides complete audit trail functionality:
- Automatic logging of all system operations
- User action tracking with correlation IDs
- Compliance reporting capabilities
- Audit log querying and filtering
- Data retention and archival policies

### 🔍 Observability Module (`src/modules/observability/`)

Monitoring and metrics collection:

```
observability/
├── controllers/                    # Metrics and health check endpoints
├── services/                      # Monitoring and metrics services
└── observability.module.ts        # Module configuration
```

**Purpose**: Implements comprehensive system monitoring:
- Prometheus metrics collection
- Distributed tracing with correlation IDs
- Application performance monitoring
- Custom business metrics
- Health check endpoints for system status

### 🏥 Health Module (`src/modules/health/`)

System health monitoring:

```
health/
├── controllers/                    # Health check endpoints
├── services/                      # Health check services
└── health.module.ts               # Module configuration
```

**Purpose**: Provides health monitoring capabilities:
- Database connectivity checks
- External service dependency monitoring
- System resource utilization
- Readiness and liveness probes for Kubernetes

### 🔑 Auth Module (`src/modules/auth/`)

Authentication and authorization:

```
auth/
├── controllers/                    # Authentication endpoints
├── services/                      # Authentication services
└── auth.module.ts                 # Module configuration
```

**Purpose**: Handles authentication and authorization:
- API key validation
- JWT token management
- Role-based access control
- Session management

## 📚 Documentation (`docs/`)

```
docs/
└── PCI-DSS-COMPLIANCE.md          # PCI DSS compliance guidelines and implementation
```

**Purpose**: Contains compliance documentation and security guidelines required for payment processing systems.

## 🛠️ Scripts (`scripts/`)

```
scripts/
└── init-db.sql                    # Database initialization script
```

**Purpose**: Contains utility scripts for database setup, data migration, and system maintenance tasks.

## 📋 Tasks (`tasks/`)

Project development and milestone tracking:

```
tasks/
├── 001-project-setup.md           # Initial project setup tasks
├── 002-core-payment-flows.md      # Core payment functionality implementation
├── 003-subscription-module.md     # Subscription system development
├── 004-webhook-async-processing.md # Webhook processing implementation
├── 005-security-compliance.md     # Security and compliance features
└── 006-observability-metrics.md   # Monitoring and observability setup
```

**Purpose**: Tracks development progress and provides detailed implementation guides for each major feature.

## 🧪 Testing (`test/`)

```
test/
└── e2e/                           # End-to-end testing configuration
```

**Purpose**: Contains end-to-end testing setup and configuration files for comprehensive system testing.

## 🔧 Configuration Files

### Development & Build Configuration

- **`package.json`**: Node.js project configuration with dependencies, scripts, and metadata
- **`tsconfig.json`**: TypeScript compiler configuration with strict type checking
- **`tsconfig.spec.json`**: TypeScript configuration specifically for test files
- **`nest-cli.json`**: NestJS CLI configuration for project generation and build settings
- **`jest.config.js`**: Jest testing framework configuration with coverage settings

### Code Quality & Formatting

- **`.eslintrc.js`**: ESLint configuration for code quality and consistency
- **`.prettierrc`**: Prettier configuration for automatic code formatting
- **`.gitignore`**: Git ignore patterns for excluding build artifacts and sensitive files

### Deployment & Infrastructure

- **`Dockerfile`**: Docker container configuration for application deployment
- **`docker-compose.yml`**: Multi-container setup including PostgreSQL, Redis, and application services
- **`.env.example`**: Template for environment variables with security best practices

### Documentation

- **`README.md`**: Project overview, setup instructions, and development guidelines
- **`business.prd.md`**: Business requirements and functional specifications
- **`technical.prd.md`**: Technical architecture and implementation details
- **`progress.md`**: Development progress tracking and milestone completion

## 🏛️ Architecture Principles

### Modular Design
Each module is self-contained with its own controllers, services, DTOs, and tests, promoting maintainability and scalability.

### Separation of Concerns
Clear separation between business logic (services), API contracts (DTOs), HTTP handling (controllers), and data persistence (entities).

### Type Safety
Comprehensive TypeScript usage with strict typing, interfaces, and validation to prevent runtime errors.

### Security First
PCI DSS compliance built into the architecture with secure API key management, audit logging, and data protection.

### Observability
Comprehensive monitoring, logging, and metrics collection for production readiness and debugging.

### Testing Strategy
Unit tests for individual components, integration tests for module interactions, and end-to-end tests for complete workflows.

This structure supports the system's core objectives of providing secure, scalable payment processing with comprehensive monitoring and compliance features.
